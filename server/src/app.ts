import {
  BACKEND_ROUTE_PREFIXES,
  loginPath,
  PRIVATE_SPA_SHELL_PATHS,
  PROTECTED_ROUTE_PREFIXES,
  PROTECTED_SPA_SHELL_ASSET_PATH
} from "@hvbc/contracts/routes";
import { Hono } from "hono";
import type { Context } from "hono";

import { accountRoutes } from "./account/routes";
import { requireAuthentication, resolveAuthenticatedUser } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { AppError } from "./http/errors";
import { browserSecurityHeaders, errorResponse, requestPipeline } from "./http/middleware";
import type { AppBindings } from "./http/types";
import type { RuntimeHooks } from "./runtime/types";

function serveAsset(context: Context<AppBindings>, assetPath: string): Promise<Response> {
  const url = new URL(context.req.url);
  url.pathname = assetPath;
  url.search = "";
  return context.env.ASSETS.fetch(new Request(url, context.req.raw));
}

function publicAssetPath(path: string): string {
  return `${path.replace(/\/+$/u, "")}.html`;
}

function isPrivateShellPath(path: string): boolean {
  return (
    PRIVATE_SPA_SHELL_PATHS.some((candidate) => path === candidate) ||
    path.startsWith(`${PROTECTED_SPA_SHELL_ASSET_PATH}/`)
  );
}

function isBackendPath(path: string): boolean {
  return BACKEND_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function hasFileExtension(path: string): boolean {
  return /\/[^/]+\.[^/]+$/u.test(path);
}

async function serveProtectedShell(context: Context<AppBindings>): Promise<Response> {
  if (await resolveAuthenticatedUser(context) === null) {
    const url = new URL(context.req.url);
    context.header("Cache-Control", "private, no-store");
    return context.redirect(loginPath(`${url.pathname}${url.search}`), 302);
  }
  return serveAsset(context, PROTECTED_SPA_SHELL_ASSET_PATH);
}

/** Builds the application; each runtime entry point passes what differs between runtimes. */
export function createApp(hooks: RuntimeHooks): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // Registered first so the headers also cover the errors raised by the pipeline.
  app.use("*", browserSecurityHeaders);
  app.use("*", requestPipeline);
  app.use("*", async (context, next) => {
    context.set("clientIp", hooks.clientIp(context.req.raw));
    await next();
  });

  // Liveness only: it must keep answering while the database is unavailable.
  app.get("/health", (context) => context.json({ status: "ok", service: "hvbc" }));

  app.get("/health/ready", async (context) => {
    const row = await context.env.DB
      .prepare("SELECT max(id) AS applied FROM d1_migrations")
      .first<{ applied: number | null }>();
    if ((row?.applied ?? null) === null) throw new AppError(503, "NOT_READY");
    return context.json({ status: "ready" });
  });

  app.route("/auth", authRoutes);

  const api = new Hono<AppBindings>();
  api.use("*", requireAuthentication);
  api.route("/", accountRoutes);
  app.route("/api/v1", api);

  app.get("/", async (context) => {
    if (await resolveAuthenticatedUser(context)) {
      context.header("Cache-Control", "private, no-store");
      return context.redirect("/dashboard", 302);
    }
    return serveAsset(context, "/");
  });

  for (const prefix of PROTECTED_ROUTE_PREFIXES) {
    app.get(prefix, serveProtectedShell);
    app.get(`${prefix}/*`, serveProtectedShell);
  }

  app.onError((error, context) => {
    if (!(error instanceof Error)) {
      return errorResponse(new Error("unknown error"), context.get("requestId"));
    }
    return errorResponse(error, context.get("requestId"));
  });

  // On Cloudflare the asset layer serves public pages before the Worker runs, so a
  // public path only reaches this handler when its prerendered file is missing. On
  // Bun every request reaches it, and the private shell must still never be served.
  app.notFound((context) => {
    const path = context.req.path;
    if (isBackendPath(path)) return errorResponse(new AppError(404, "NOT_FOUND"), context.get("requestId"));
    if (isPrivateShellPath(path)) return context.text("Not Found", 404);
    if (context.req.method === "GET" && !hasFileExtension(path)) {
      return serveAsset(context, publicAssetPath(path));
    }
    return context.env.ASSETS.fetch(context.req.raw);
  });

  return app;
}
