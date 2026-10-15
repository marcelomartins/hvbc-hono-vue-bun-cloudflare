import type { Context } from "hono";

import { isAuthRateLimitEnabled } from "../config";
import { AppError } from "../http/errors";
import type { AppBindings } from "../http/types";
import { structuredLog } from "../observability/log";

/**
 * Rejects the request with 429 once any of its keys is over the limit. Counting by
 * IP alone would lock out users behind a shared address, and by account alone would
 * let one client try many accounts, so login counts both.
 */
export async function enforceAuthRateLimit(
  context: Context<AppBindings>,
  action: "login" | "register",
  subjects: string[]
): Promise<void> {
  if (!isAuthRateLimitEnabled(context.env)) return;
  const limiter = context.env.AUTH_RATE_LIMITER;
  // assertRuntimeConfiguration already rejects this; failing here keeps it closed regardless.
  if (limiter === undefined) throw new Error("AUTH_RATE_LIMITER is not available");

  const outcomes = await Promise.all(subjects.map((subject) => limiter.limit({ key: `${action}:${subject}` })));
  if (outcomes.some((outcome) => !outcome.success)) {
    structuredLog("warn", { event: "rate_limited", requestId: context.get("requestId"), action });
    throw new AppError(429, "RATE_LIMITED");
  }
}

export function clientIpSubject(context: Context<AppBindings>): string {
  return `ip:${context.get("clientIp") ?? "unknown"}`;
}
