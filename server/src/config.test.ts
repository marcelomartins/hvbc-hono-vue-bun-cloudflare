import { describe, expect, test } from "bun:test";

import { assertRuntimeConfiguration, emailSender, type RuntimeVariables } from "./config";

const base: RuntimeVariables = {
  ENVIRONMENT: "production",
  APP_ORIGIN: "https://app.example",
  SESSION_SECRET: "test-session-secret-that-is-at-least-32-bytes",
  EMAIL_DRIVER: "none",
  EMAIL_FROM: "",
  SES_REGION: "",
  TURNSTILE_SITE_KEY: ""
};

describe("email delivery", () => {
  const binding = { send: async () => undefined };
  const ses = {
    EMAIL_DRIVER: "ses",
    EMAIL_FROM: "App <noreply@app.example>",
    SES_REGION: "us-east-1",
    AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
    AWS_SECRET_ACCESS_KEY: "secret"
  };

  test("reads EMAIL_FROM as an address or a display name with one", () => {
    expect(emailSender({ EMAIL_FROM: "noreply@app.example" })).toEqual({ email: "noreply@app.example" });
    expect(emailSender({ EMAIL_FROM: " Aplicação, Inc. <noreply@app.example> " })).toEqual({
      email: "noreply@app.example",
      name: "Aplicação, Inc."
    });
    for (const EMAIL_FROM of ["", "App", "<noreply@app.example>", "App <noreply>", 'A "B" <noreply@app.example>']) {
      expect(emailSender({ EMAIL_FROM })).toBeNull();
    }
  });

  test("needs nothing while off, and allows console only locally", () => {
    assertRuntimeConfiguration(base);
    assertRuntimeConfiguration({ ...base, ENVIRONMENT: "local", EMAIL_DRIVER: "console" });
    expect(() => assertRuntimeConfiguration({ ...base, EMAIL_DRIVER: "console" })).toThrow("ENVIRONMENT=local");
    expect(() => assertRuntimeConfiguration({ ...base, EMAIL_DRIVER: "smtp" })).toThrow("EMAIL_DRIVER must be one of");
  });

  test("cloudflare refuses to start without a sender or on a runtime without the binding", () => {
    const cloudflare = { ...base, EMAIL_DRIVER: "cloudflare", EMAIL_FROM: "noreply@app.example" };
    assertRuntimeConfiguration({ ...cloudflare, EMAIL: binding });
    expect(() => assertRuntimeConfiguration(cloudflare)).toThrow("requires the EMAIL binding");
    expect(() => assertRuntimeConfiguration({ ...cloudflare, EMAIL: binding, EMAIL_FROM: "" })).toThrow("EMAIL_FROM");
  });

  test("ses refuses to start without a sender, a region, or its keys", () => {
    assertRuntimeConfiguration({ ...base, ...ses });
    expect(() => assertRuntimeConfiguration({ ...base, ...ses, EMAIL_FROM: "" })).toThrow("EMAIL_FROM");
    for (const SES_REGION of ["", "us-east-1.evil.example", "US-EAST-1"]) {
      expect(() => assertRuntimeConfiguration({ ...base, ...ses, SES_REGION })).toThrow("SES_REGION");
    }
    expect(() => assertRuntimeConfiguration({ ...base, ...ses, AWS_SECRET_ACCESS_KEY: "" })).toThrow(
      "AWS_SECRET_ACCESS_KEY"
    );
  });
});

const lanHttp = { APP_ORIGIN: "http://192.168.0.10:3000" };

describe("application origin", () => {
  test("must be a bare origin", () => {
    for (const APP_ORIGIN of ["https://app.example/", "https://app.example/app", "app.example", ""]) {
      expect(() => assertRuntimeConfiguration({ ...base, APP_ORIGIN })).toThrow("APP_ORIGIN must be a bare origin");
    }
  });
});

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
    assertRuntimeConfiguration({ ...base, ENVIRONMENT: "local", APP_ORIGIN: "http://localhost" });
  });
});
