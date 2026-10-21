// Vite fingerprints every file under /assets/, so a URL there never changes content.
// The `_headers` file on Cloudflare and the Bun static adapter share this rule.
export const IMMUTABLE_ASSETS_PREFIX = "/assets/";

export const IMMUTABLE_ASSETS_CACHE_CONTROL = "public, max-age=31536000, immutable";
