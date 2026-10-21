import type { ApiErrorBody } from "@hvbc/contracts/api";
import { BROWSER_SECURITY_HEADERS, STRICT_TRANSPORT_SECURITY } from "@hvbc/contracts/security-headers";
import type { MiddlewareHandler } from "hono";

import { assertRuntimeConfiguration, isInsecureHttp } from "../config";
import { structuredLog } from "../observability/log";
import { sanitizedRequestPath } from "../observability/request-path";
import { uuidV7 } from "../shared/uuid";
import { AppError } from "./errors";
import type { AppBindings } from "./types";

let configurationChecked = false;

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

export function validateHostAndOrigin(request: Request, environment: AppBindings["Bindings"]): void {
  const url = new URL(request.url);
  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const origin = request.headers.get("origin");
  if (environment.ENVIRONMENT === "local") {
    if (!localHost) throw new AppError(400, "INVALID_HOST");
    if (!isSafeMethod(request.method) && origin !== url.origin) {
      throw new AppError(403, "INVALID_ORIGIN");
    }
    return;
  }
  if (url.hostname !== environment.APP_HOST) throw new AppError(400, "INVALID_HOST");
  if (!isSafeMethod(request.method) && origin !== environment.APP_ORIGIN) {
    throw new AppError(403, "INVALID_ORIGIN");
  }
}

export const requestPipeline: MiddlewareHandler<AppBindings> = async (context, next) => {
  const started = performance.now();
  const requestId = uuidV7();
  context.set("requestId", requestId);
  let status = 500;
  try {
    if (!configurationChecked) {
      assertRuntimeConfiguration(context.env);
      configurationChecked = true;
    }
    validateHostAndOrigin(context.req.raw, context.env);
    await next();
    status = context.res.status;
  } catch (error) {
    // Errors thrown here reach onError only after this middleware returns, so the
    // response status is not known yet when the request is logged.
    if (error instanceof AppError) status = error.status;
    throw error;
  } finally {
    structuredLog(status >= 500 ? "error" : status >= 400 ? "warn" : "info", {
      event: "http_request",
      requestId,
      method: context.req.method,
      path: sanitizedRequestPath(context.req.raw),
      status,
      durationMs: Math.round(performance.now() - started)
    });
  }
};

export const browserSecurityHeaders: MiddlewareHandler<AppBindings> = async (context, next) => {
  await next();
  for (const [name, value] of Object.entries(BROWSER_SECURITY_HEADERS)) {
    context.header(name, value);
  }
  if (context.env.ENVIRONMENT !== "local" && !isInsecureHttp(context.env)) {
    context.header("Strict-Transport-Security", STRICT_TRANSPORT_SECURITY);
  }
  if (context.req.path.startsWith("/auth/") || context.req.path.startsWith("/api/")) {
    context.header("Cache-Control", "private, no-store");
  }
};

export function errorResponse(error: Error, requestId: string): Response {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let details: Record<string, string[]> | undefined;
  if (error instanceof AppError) {
    status = error.status;
    code = error.code;
    details = error.details;
  } else {
    structuredLog("error", {
      event: "unhandled_error",
      requestId,
      name: error.name,
      message: error.message
    });
  }
  const body: ApiErrorBody = {
    error: { code, requestId, ...(details === undefined ? {} : { details }) }
  };
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
