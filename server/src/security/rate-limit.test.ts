import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";

import type { AppEnv } from "../config";
import { errorResponse } from "../http/middleware";
import type { AppBindings } from "../http/types";
import type { RateLimiter } from "../runtime/types";
import { clientIpSubject, enforceAuthRateLimit } from "./rate-limit";

function limiterAllowing(allowedKeys: string[]): RateLimiter & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    limit: async ({ key }) => {
      keys.push(key);
      return { success: allowedKeys.includes(key) };
    }
  };
}

const app = new Hono<AppBindings>();
app.post("/login", async (context) => {
  context.set("requestId", "request-1");
  context.set("clientIp", "203.0.113.7");
  await enforceAuthRateLimit(context, "login", [clientIpSubject(context), "email:user@example.com"]);
  return context.body(null, 204);
});
app.onError((error, context) => errorResponse(error, context.get("requestId")));

async function login(env: Partial<AppEnv>): Promise<Response> {
  return app.request("http://localhost/login", { method: "POST" }, env as AppEnv);
}

afterEach(() => {
  spyOn(console, "warn").mockRestore();
});

describe("auth rate limit", () => {
  test("does nothing while disabled", async () => {
    const limiter = limiterAllowing([]);
    expect((await login({ AUTH_RATE_LIMIT: "false", AUTH_RATE_LIMITER: limiter })).status).toBe(204);
    expect(limiter.keys).toEqual([]);
  });

  test("counts the client address and the account separately", async () => {
    const limiter = limiterAllowing(["login:ip:203.0.113.7", "login:email:user@example.com"]);
    expect((await login({ AUTH_RATE_LIMIT: "true", AUTH_RATE_LIMITER: limiter })).status).toBe(204);
    expect(limiter.keys).toEqual(["login:ip:203.0.113.7", "login:email:user@example.com"]);
  });

  test("answers 429 when any key is over the limit", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    const limiter = limiterAllowing(["login:ip:203.0.113.7"]);
    const response = await login({ AUTH_RATE_LIMIT: "true", AUTH_RATE_LIMITER: limiter });
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: "rate_limited", action: "login" }));
  });

  test("fails closed when enabled without a limiter", async () => {
    const error = spyOn(console, "error").mockImplementation(() => undefined);
    expect((await login({ AUTH_RATE_LIMIT: "true" })).status).toBe(500);
    error.mockRestore();
  });
});
