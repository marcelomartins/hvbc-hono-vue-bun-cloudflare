import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { RateLimiter } from "../src/runtime/types";

describe("Cloudflare rate limiting binding", () => {
  it("counts each key separately in local development", async () => {
    // vitest.config.ts declares the binding with a limit of 2 per period.
    const limiter: RateLimiter = (env as unknown as { AUTH_RATE_LIMITER: RateLimiter }).AUTH_RATE_LIMITER;
    const outcomes = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      outcomes.push((await limiter.limit({ key: "login:ip:203.0.113.7" })).success);
    }
    expect(outcomes).toEqual([true, true, false]);
    expect((await limiter.limit({ key: "login:ip:203.0.113.8" })).success).toBe(true);
  });
});
