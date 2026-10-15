import {
  PASSWORD_MAX_CODE_POINTS,
  PASSWORD_MIN_CODE_POINTS
} from "@hvbc/contracts/auth";

import type { AssetFetcher, Database, RateLimiter } from "./runtime/types";

export const SECURITY = {
  passwordIterations: 100_000,
  passwordSaltBytes: 16,
  passwordHashBytes: 32,
  passwordMinCodePoints: PASSWORD_MIN_CODE_POINTS,
  passwordMaxCodePoints: PASSWORD_MAX_CODE_POINTS,
  sessionDays: 30,
  authBodyBytes: 16 * 1024,
  apiBodyBytes: 64 * 1024,
  outboundRequestTimeoutMs: 5_000
} as const;

export const SESSION_COOKIE = "__Host-hvbc-session";

// Browsers drop Secure cookies, and with them every __Host- cookie, on plain HTTP.
export const INSECURE_SESSION_COOKIE = "hvbc-session";

const ENVIRONMENTS = ["local", "production"] as const;

type Environment = (typeof ENVIRONMENTS)[number];

const EMAIL_DRIVERS = ["none", "console", "ses"] as const;

type EmailDriver = (typeof EMAIL_DRIVERS)[number];

export interface RuntimeSecrets {
  SESSION_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
}

/** The configuration every runtime provides, before validation. */
export interface RuntimeEnv extends RuntimeSecrets {
  DB: Database;
  ASSETS: AssetFetcher;
  ENVIRONMENT: string;
  APP_HOST: string;
  APP_ORIGIN: string;
  ALLOW_INSECURE_HTTP?: string;
  AUTH_RATE_LIMIT?: string;
  AUTH_RATE_LIMITER?: RateLimiter;
  EMAIL_DRIVER: string;
  SES_REGION: string;
  SES_FROM: string;
  TURNSTILE_SITE_KEY: string;
}

export type RuntimeVariables = Omit<RuntimeEnv, "DB" | "ASSETS">;

export type AppEnv = Omit<RuntimeEnv, "ENVIRONMENT" | "EMAIL_DRIVER"> & {
  ENVIRONMENT: Environment;
  EMAIL_DRIVER: EmailDriver;
};

function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

function isEmailDriver(value: string): value is EmailDriver {
  return (EMAIL_DRIVERS as readonly string[]).includes(value);
}

function isConfigured(value: string | undefined): boolean {
  return (value ?? "").trim().length > 0;
}

export function isTurnstileEnabled(env: AppEnv): boolean {
  return isConfigured(env.TURNSTILE_SECRET_KEY);
}

export function isAuthRateLimitEnabled(env: Pick<RuntimeVariables, "AUTH_RATE_LIMIT">): boolean {
  return env.AUTH_RATE_LIMIT === "true";
}

/**
 * Plain HTTP outside local development, accepted only with ALLOW_INSECURE_HTTP=true.
 * The session cookie then drops Secure and the __Host- prefix, and HSTS is not sent.
 */
export function isInsecureHttp(env: Pick<RuntimeVariables, "ENVIRONMENT" | "APP_ORIGIN">): boolean {
  return env.ENVIRONMENT !== "local" && URL.parse(env.APP_ORIGIN)?.protocol === "http:";
}

export function assertRuntimeConfiguration(env: RuntimeVariables): void {
  if (!isEnvironment(env.ENVIRONMENT)) {
    throw new Error(`ENVIRONMENT must be one of: ${ENVIRONMENTS.join(", ")}`);
  }
  if (new TextEncoder().encode(env.SESSION_SECRET ?? "").byteLength < 32) {
    throw new Error(
      "SESSION_SECRET must contain at least 32 UTF-8 bytes (set it in .dev.vars locally or with wrangler secret in production)"
    );
  }
  const origin = new URL(env.APP_ORIGIN);
  if (origin.origin !== env.APP_ORIGIN || origin.hostname !== env.APP_HOST) {
    throw new Error("APP_ORIGIN and APP_HOST must identify the same origin");
  }
  if (isInsecureHttp(env) && env.ALLOW_INSECURE_HTTP !== "true") {
    throw new Error(
      "APP_ORIGIN uses http outside ENVIRONMENT=local, which sends passwords and session cookies unencrypted; set ALLOW_INSECURE_HTTP=true to accept that"
    );
  }

  // Optional features validate their own configuration only when enabled, so the
  // framework runs with no email provider and no Turnstile account.
  if (!isEmailDriver(env.EMAIL_DRIVER)) {
    throw new Error(`EMAIL_DRIVER must be one of: ${EMAIL_DRIVERS.join(", ")}`);
  }
  if (env.EMAIL_DRIVER === "console" && env.ENVIRONMENT !== "local") {
    throw new Error("EMAIL_DRIVER=console prints message bodies and is only allowed when ENVIRONMENT=local");
  }
  if (env.EMAIL_DRIVER === "ses") {
    if (!isConfigured(env.SES_REGION) || !isConfigured(env.SES_FROM)) {
      throw new Error("EMAIL_DRIVER=ses requires SES_REGION and SES_FROM");
    }
    if (!isConfigured(env.AWS_ACCESS_KEY_ID) || !isConfigured(env.AWS_SECRET_ACCESS_KEY)) {
      throw new Error("EMAIL_DRIVER=ses requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
    }
  }
  if (isConfigured(env.TURNSTILE_SITE_KEY) !== isConfigured(env.TURNSTILE_SECRET_KEY)) {
    throw new Error("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together");
  }
  // A misspelled value must not silently leave the limiter off.
  if (!["", "true", "false"].includes(env.AUTH_RATE_LIMIT ?? "")) {
    throw new Error("AUTH_RATE_LIMIT must be true or false");
  }
  if (isAuthRateLimitEnabled(env) && env.AUTH_RATE_LIMITER === undefined) {
    throw new Error(
      "AUTH_RATE_LIMIT=true requires the AUTH_RATE_LIMITER binding, which this runtime does not provide"
    );
  }
}
