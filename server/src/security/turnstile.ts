import { SECURITY, appHost, isTurnstileEnabled, type AppEnv } from "../config";
import { structuredLog } from "../observability/log";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface SiteverifyResponse {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export function createSiteverifyRequest(secret: string, token: string, remoteIp: string | null): Request {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp !== null) body.set("remoteip", remoteIp);
  return new Request(SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
}

/**
 * Verification is skipped entirely while Turnstile is not configured. Once it is
 * configured every failure, including provider and network errors, rejects the
 * request.
 */
export async function verifyTurnstile(
  env: AppEnv,
  token: string | undefined,
  remoteIp: string | null,
  action: string,
  requestId: string
): Promise<boolean> {
  if (!isTurnstileEnabled(env)) return true;
  if (token === undefined || token.length === 0) {
    structuredLog("warn", { event: "turnstile_rejected", requestId, action, reason: "missing_token" });
    return false;
  }

  let payload: SiteverifyResponse;
  try {
    const response = await fetch(
      createSiteverifyRequest(env.TURNSTILE_SECRET_KEY ?? "", token, remoteIp),
      { signal: AbortSignal.timeout(SECURITY.outboundRequestTimeoutMs) }
    );
    payload = (await response.json()) as SiteverifyResponse;
  } catch {
    structuredLog("error", { event: "turnstile_rejected", requestId, action, reason: "siteverify_unavailable" });
    return false;
  }

  if (payload.success !== true) {
    structuredLog("warn", {
      event: "turnstile_rejected",
      requestId,
      action,
      reason: "siteverify_rejected",
      errorCodes: (payload["error-codes"] ?? []).join(",")
    });
    return false;
  }
  if (env.ENVIRONMENT !== "local" && payload.hostname !== appHost(env)) {
    structuredLog("warn", { event: "turnstile_rejected", requestId, action, reason: "hostname_mismatch" });
    return false;
  }
  if (payload.action !== undefined && payload.action !== action) {
    structuredLog("warn", { event: "turnstile_rejected", requestId, action, reason: "action_mismatch" });
    return false;
  }
  return true;
}
