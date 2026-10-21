import { INSECURE_SESSION_COOKIE, isInsecureHttp, SECURITY, SESSION_COOKIE, type AppEnv } from "../config";
import { hmacSha256 } from "./crypto";
import { base64UrlDecode, base64UrlEncode, timingSafeEqual, utf8 } from "./encoding";

export interface SessionClaims {
  sub: string;
  version: number;
  authenticatedAt: number;
  exp: number;
}

function parseClaims(value: unknown): SessionClaims | null {
  if (typeof value !== "object" || value === null) return null;
  const claims = value as Partial<SessionClaims>;
  if (
    typeof claims.sub !== "string" ||
    !Number.isSafeInteger(claims.version) ||
    !Number.isSafeInteger(claims.authenticatedAt) ||
    !Number.isSafeInteger(claims.exp)
  ) return null;
  return claims as SessionClaims;
}

export async function createSessionToken(
  env: AppEnv,
  userUuid: string,
  sessionVersion: number,
  now = Date.now()
): Promise<string> {
  const claims: SessionClaims = {
    sub: userUuid,
    version: sessionVersion,
    authenticatedAt: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SECURITY.sessionDays * 86_400
  };
  const payload = base64UrlEncode(utf8(JSON.stringify(claims)));
  const signature = base64UrlEncode(await hmacSha256(env.SESSION_SECRET, payload));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  env: AppEnv,
  token: string,
  now = Date.now()
): Promise<SessionClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (payload === undefined || signature === undefined) return null;
  try {
    const expected = await hmacSha256(env.SESSION_SECRET, payload);
    if (!timingSafeEqual(base64UrlDecode(signature), expected)) return null;
    const claims = parseClaims(JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as unknown);
    if (claims === null || claims.exp <= Math.floor(now / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

function sessionCookieName(env: AppEnv): string {
  return isInsecureHttp(env) ? INSECURE_SESSION_COOKIE : SESSION_COOKIE;
}

function cookieHeader(env: AppEnv, value: string, maxAgeSeconds: number): string {
  const secure = isInsecureHttp(env) ? "" : " Secure;";
  return `${sessionCookieName(env)}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly;${secure} SameSite=Lax`;
}

export function readSessionCookie(env: AppEnv, request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (cookie === null) return null;
  const name = sessionCookieName(env);
  for (const item of cookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim();
    }
  }
  return null;
}

export function sessionCookie(env: AppEnv, token: string): string {
  return cookieHeader(env, token, SECURITY.sessionDays * 86_400);
}

export function clearedSessionCookie(env: AppEnv): string {
  return cookieHeader(env, "", 0);
}
