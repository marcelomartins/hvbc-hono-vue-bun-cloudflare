import { describe, expect, test } from "bun:test";

import { assertRuntimeConfiguration, type RuntimeVariables } from "./config";

const base: RuntimeVariables = {
  ENVIRONMENT: "production",
  APP_HOST: "app.example",
  APP_ORIGIN: "https://app.example",
  SESSION_SECRET: "test-session-secret-that-is-at-least-32-bytes",
  EMAIL_DRIVER: "none",
  SES_REGION: "",
  SES_FROM: "",
  TURNSTILE_SITE_KEY: ""
};

const lanHttp = { APP_HOST: "192.168.0.10", APP_ORIGIN: "http://192.168.0.10:3000" };

describe("auth rate limit", () => {
  const limiter = { limit: async () => ({ success: true }) };

  test("refuses to start when enabled on a runtime without the binding", () => {
    expect(() => assertRuntimeConfiguration({ ...base, AUTH_RATE_LIMIT: "true" })).toThrow("AUTH_RATE_LIMITER");
    assertRuntimeConfiguration({ ...base, AUTH_RATE_LIMIT: "true", AUTH_RATE_LIMITER: limiter });
  });

  test("rejects values other than true or false", () => {
    expect(() => assertRuntimeConfiguration({ ...base, AUTH_RATE_LIMIT: "yes", AUTH_RATE_LIMITER: limiter })).toThrow(
      "AUTH_RATE_LIMIT must be true or false"
    );
    assertRuntimeConfiguration({ ...base, AUTH_RATE_LIMIT: "false" });
  });
});

describe("plain HTTP", () => {
  test("is refused outside local development unless explicitly allowed", () => {
    expect(() => assertRuntimeConfiguration({ ...base, ...lanHttp })).toThrow("ALLOW_INSECURE_HTTP");
    expect(() => assertRuntimeConfiguration({ ...base, ...lanHttp, ALLOW_INSECURE_HTTP: "false" })).toThrow(
      "ALLOW_INSECURE_HTTP"
    );
    assertRuntimeConfiguration({ ...base, ...lanHttp, ALLOW_INSECURE_HTTP: "true" });
  });

  test("needs no opt-in for HTTPS or local development", () => {
    assertRuntimeConfiguration(base);
    assertRuntimeConfiguration({ ...base, ENVIRONMENT: "local", APP_HOST: "localhost", APP_ORIGIN: "http://localhost" });
  });
});
