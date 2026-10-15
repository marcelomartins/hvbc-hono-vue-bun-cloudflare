export const PUBLIC_SSG_ROUTES = [
  "/",
  "/pricing",
  "/contact",
  "/login",
  "/register"
] as const;

export const NOT_FOUND_SSG_ROUTE = "/404";

export const BACKEND_ROUTE_PREFIXES = ["/health", "/auth", "/api"] as const;

export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/settings"
] as const;

export const PROTECTED_SPA_SHELL_ASSET_PATH = "/index-spa";

export const PRIVATE_SPA_SHELL_PATHS = [
  PROTECTED_SPA_SHELL_ASSET_PATH,
  `${PROTECTED_SPA_SHELL_ASSET_PATH}/`,
  `${PROTECTED_SPA_SHELL_ASSET_PATH}.html`
] as const;

const LOGIN_ROUTE: (typeof PUBLIC_SSG_ROUTES)[number] = "/login";

const RETURN_TO_PARAMETER = "next";

// Relative paths are resolved against this placeholder origin; anything that
// resolves elsewhere came from an absolute or protocol-relative URL.
const RETURN_PATH_BASE = "https://return-path.invalid";

export function isProtectedRoutePath(path: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function protectedReturnPath(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value, RETURN_PATH_BASE);
  } catch {
    return null;
  }
  if (url.origin !== RETURN_PATH_BASE || !isProtectedRoutePath(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The login page URL, carrying the protected path to return to after signing in. */
export function loginPath(returnTo: string): string {
  const path = protectedReturnPath(returnTo);
  if (path === null) return LOGIN_ROUTE;
  return `${LOGIN_ROUTE}?${new URLSearchParams({ [RETURN_TO_PARAMETER]: path }).toString()}`;
}

/**
 * Reads the return path from a login page query string. Only same-origin protected
 * paths are accepted, so the parameter can never become an open redirect.
 */
export function returnPathFromQuery(search: string, fallback: string): string {
  const value = new URLSearchParams(search).get(RETURN_TO_PARAMETER);
  return value === null ? fallback : protectedReturnPath(value) ?? fallback;
}
