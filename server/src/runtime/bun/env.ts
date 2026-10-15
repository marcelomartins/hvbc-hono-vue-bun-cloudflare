import { join } from "node:path";

import type { RuntimeVariables } from "../../config";

export interface BunServerOptions {
  port: number;
  listenHost: string;
  databasePath: string;
  staticDir: string;
  migrationsDir: string;
  trustedProxyIpHeader: string | null;
}

type Source = Record<string, string | undefined>;

const UNSET_BY_DEFAULT = [
  "ALLOW_INSECURE_HTTP",
  "AUTH_RATE_LIMIT",
  "TURNSTILE_SECRET_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY"
] as const;

// Error messages name the variable but never echo its value.
function required(source: Source, name: string): string {
  const value = source[name];
  if (value === undefined || value.trim() === "") throw new Error(`${name} is required`);
  return value;
}

function optional(source: Source, name: string, fallback: string): string {
  const value = source[name];
  return value === undefined || value === "" ? fallback : value;
}

/** Reads the process environment with the same names and defaults as wrangler.jsonc. */
export function readBunEnvironment(source: Source): { variables: RuntimeVariables; options: BunServerOptions } {
  const variables: RuntimeVariables = {
    ENVIRONMENT: required(source, "ENVIRONMENT"),
    APP_HOST: required(source, "APP_HOST"),
    APP_ORIGIN: required(source, "APP_ORIGIN"),
    SESSION_SECRET: required(source, "SESSION_SECRET"),
    EMAIL_DRIVER: optional(source, "EMAIL_DRIVER", "none"),
    SES_REGION: optional(source, "SES_REGION", ""),
    SES_FROM: optional(source, "SES_FROM", ""),
    TURNSTILE_SITE_KEY: optional(source, "TURNSTILE_SITE_KEY", "")
  };
  for (const name of UNSET_BY_DEFAULT) {
    const value = source[name];
    if (value !== undefined) variables[name] = value;
  }

  const port = Number(optional(source, "PORT", "3000"));
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PORT must be an integer between 0 and 65535");
  }
  const trustedProxyIpHeader = optional(source, "TRUSTED_PROXY_IP_HEADER", "").trim().toLowerCase();

  return {
    variables,
    options: {
      port,
      listenHost: optional(source, "LISTEN_HOST", "127.0.0.1"),
      databasePath: optional(source, "DATABASE_PATH", ".data/app.sqlite"),
      staticDir: optional(source, "STATIC_DIR", "dist/web-vue"),
      migrationsDir: optional(source, "MIGRATIONS_DIR", "server/migrations"),
      trustedProxyIpHeader: trustedProxyIpHeader === "" ? null : trustedProxyIpHeader
    }
  };
}

/**
 * Canonical URLs, Open Graph tags, robots.txt and sitemap.xml are baked in at build
 * time, so a production server must run with the origin its frontend was built for.
 */
export async function assertBuildOrigin(variables: RuntimeVariables, staticDir: string): Promise<void> {
  if (variables.ENVIRONMENT === "local") return;
  const buildInfo = Bun.file(join(staticDir, "..", "build-info.json"));
  const builtFor = (await buildInfo.exists())
    ? ((await buildInfo.json()) as { appOrigin?: unknown }).appOrigin
    : undefined;
  if (builtFor !== variables.APP_ORIGIN) {
    throw new Error("APP_ORIGIN differs from the origin the frontend was built for; rebuild it with the same APP_ORIGIN");
  }
}
