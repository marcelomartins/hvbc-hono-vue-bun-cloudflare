// The server applies these headers to its responses and the frontend build writes
// them into `_headers` for the pages Cloudflare serves without running the Worker,
// so both share one policy.

// Allowed even while Turnstile is disabled: public pages become a SPA after
// hydration, so every public document must already permit the widget, and a
// build-time switch could drift from the server's runtime configuration.
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `frame-src ${TURNSTILE_ORIGIN}`,
  "img-src 'self' data:",
  "object-src 'none'",
  `script-src 'self' ${TURNSTILE_ORIGIN}`,
  // Vue renders style attributes (v-show) and Vite injects <style> elements during
  // development; scripts stay restricted to 'self'.
  "style-src 'self' 'unsafe-inline'"
].join("; ");

export const BROWSER_SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
} as const;

// includeSubDomains also covers subdomains of the application host; on an apex
// domain that means every subdomain must serve HTTPS.
export const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains";
