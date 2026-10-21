import { afterEach, describe, expect, spyOn, test } from "bun:test";

import type { AppEnv } from "../config";
import { createSiteverifyRequest, verifyTurnstile } from "./turnstile";

const disabled = { ENVIRONMENT: "production", APP_HOST: "app.example" } as AppEnv;
const enabled = { ...disabled, TURNSTILE_SECRET_KEY: "secret-value" } as AppEnv;

function siteverifyResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => {
  spyOn(globalThis, "fetch").mockRestore();
  spyOn(console, "warn").mockRestore();
  spyOn(console, "error").mockRestore();
});

describe("createSiteverifyRequest", () => {
  test("uses the canonical URL-encoded format", async () => {
    const request = createSiteverifyRequest("secret-value", "client-token", "203.0.113.10");
    const body = new URLSearchParams(await request.text());
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(body.get("secret")).toBe("secret-value");
    expect(body.get("response")).toBe("client-token");
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  test("omits the remote address when it is unknown", async () => {
    const request = createSiteverifyRequest("secret-value", "client-token", null);
    expect(new URLSearchParams(await request.text()).has("remoteip")).toBe(false);
  });
});

describe("verifyTurnstile", () => {
  test("skips verification while Turnstile is not configured", async () => {
    const fetchMock = spyOn(globalThis, "fetch");
    expect(await verifyTurnstile(disabled, undefined, null, "login", "req-1")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("accepts a valid token for the configured host", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      siteverifyResponse({ success: true, hostname: "app.example", action: "login" })
    );
    expect(await verifyTurnstile(enabled, "client-token", null, "login", "req-1")).toBe(true);
  });

  test("rejects a missing token once configured", async () => {
    spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = spyOn(globalThis, "fetch");
    expect(await verifyTurnstile(enabled, undefined, null, "login", "req-1")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects provider failures, hostname and action mismatches", async () => {
    spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValue(siteverifyResponse({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await verifyTurnstile(enabled, "client-token", null, "login", "req-1")).toBe(false);

    fetchMock.mockResolvedValue(siteverifyResponse({ success: true, hostname: "evil.example" }));
    expect(await verifyTurnstile(enabled, "client-token", null, "login", "req-1")).toBe(false);

    fetchMock.mockResolvedValue(siteverifyResponse({ success: true, hostname: "app.example", action: "register" }));
    expect(await verifyTurnstile(enabled, "client-token", null, "login", "req-1")).toBe(false);
  });

  test("fails closed when siteverify is unreachable", async () => {
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await verifyTurnstile(enabled, "client-token", null, "login", "req-1")).toBe(false);
  });
});
