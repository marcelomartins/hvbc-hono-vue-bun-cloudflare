import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * The production APP_ORIGIN used for absolute public URLs: the APP_ORIGIN environment
 * variable when set (a Docker build argument for the Bun target), otherwise
 * vars.APP_ORIGIN from wrangler.jsonc.
 */
export function appOrigin(wranglerConfigPath: string): string {
  const fromEnvironment = process.env.APP_ORIGIN;
  if (fromEnvironment !== undefined && fromEnvironment !== "") {
    if (URL.parse(fromEnvironment)?.origin !== fromEnvironment) {
      throw new Error("The APP_ORIGIN environment variable must be a bare origin");
    }
    return fromEnvironment;
  }
  // wrangler.jsonc keeps comments, so it needs a JSONC-aware parser.
  const parsed = ts.parseConfigFileTextToJson(wranglerConfigPath, readFileSync(wranglerConfigPath, "utf8"));
  const origin: unknown = (parsed.config as { vars?: { APP_ORIGIN?: unknown } } | undefined)?.vars?.APP_ORIGIN;
  if (parsed.error !== undefined || typeof origin !== "string" || URL.parse(origin)?.origin !== origin) {
    throw new Error(`${wranglerConfigPath} must define vars.APP_ORIGIN as a bare origin`);
  }
  return origin;
}
