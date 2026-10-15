import { CONTENT_SECURITY_POLICY } from "@hvbc/contracts/security-headers";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";

import type { AppEnv } from "../config";
import { browserSecurityHeaders, errorResponse, requestPipeline, validateHostAndOrigin } from "./middleware";
import { AppError } from "./errors";
import type { AppBindings } from "./types";

const localEnv = { ENVIRONMENT: "local" } as AppEnv;
const productionEnv = {
  ENVIRONMENT: "production",
  APP_HOST: "app.example",
  APP_ORIGIN: "https://app.example"
} as AppEnv;

function request(url: string, method = "GET", origin?: string): Request {
  return new Request(url, {
    method,
    ...(origin === undefined ? {} : { headers: { origin } })
  });
}

describe("request pipeline", () => {
  const configuredEnv = {
    ...productionEnv,
    SESSION_SECRET: "test-session-secret-that-is-at-least-32-bytes",
    EMAIL_DRIVER: "none",
    TURNSTILE_SITE_KEY: ""
  } as AppEnv;

  const app = new Hono<AppBindings>();
  app.use("*", browserSecurityHeaders);
  app.use("*", requestPipeline);
  app.post("/auth/login", (context) => context.body(null, 204));
  app.onError((error, context) => errorResponse(error, context.get("requestId")));

  afterEach(() => {
    spyOn(console, "warn").mockRestore();
  });

  test("logs the real status of a rejected request and still sends security headers", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await app.request(
      "https://app.example/auth/login",
      { method: "POST", headers: { origin: "https://other.example" } },
      configuredEnv
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_ORIGIN" } });
    expect(response.headers.get("content-security-policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get("strict-transport-security")).not.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "http_request", status: 403, level: "warn" })
    );
  });

  test("omits HSTS when plain HTTP was explicitly allowed", async () => {
    const info = spyOn(console, "info").mockImplementation(() => undefined);
    const origin = "http://192.168.0.10:3000";
    const response = await app.request(
      `${origin}/auth/login`,
      { method: "POST", headers: { origin } },
      { ...configuredEnv, APP_HOST: "192.168.0.10", APP_ORIGIN: origin, ALLOW_INSECURE_HTTP: "true" } as AppEnv
    );
    info.mockRestore();

    expect(response.status).toBe(204);
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });
});

describe("validateHostAndOrigin", () => {
  test("local: accepts localhost and same-origin mutations", () => {
    validateHostAndOrigin(request("http://localhost:5173/"), localEnv);
    validateHostAndOrigin(
      request("http://localhost:5173/auth/login", "POST", "http://localhost:5173"),
      localEnv
    );
  });

  test("local: rejects other hosts and cross-origin mutations", () => {
    expect(() => validateHostAndOrigin(request("http://app.example/"), localEnv)).toThrow(AppError);
    expect(() =>
      validateHostAndOrigin(request("http://localhost/auth/login", "POST", "http://evil.example"), localEnv)
    ).toThrow(AppError);
    expect(() =>
      validateHostAndOrigin(request("http://localhost/auth/login", "POST"), localEnv)
    ).toThrow(AppError);
  });

  test("production: pins the configured host and origin", () => {
    validateHostAndOrigin(request("https://app.example/"), productionEnv);
    validateHostAndOrigin(
      request("https://app.example/auth/login", "POST", "https://app.example"),
      productionEnv
    );
    expect(() => validateHostAndOrigin(request("https://other.example/"), productionEnv)).toThrow(AppError);
    expect(() =>
      validateHostAndOrigin(request("https://app.example/auth/login", "POST", "https://other.example"), productionEnv)
    ).toThrow(AppError);
  });
});
