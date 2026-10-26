import { describe, expect, test } from "bun:test";
import { parseConfigFileTextToJson } from "typescript";

import {
  BACKEND_ROUTE_PREFIXES,
  isBackendRoutePath,
  isProtectedRoutePath,
  loginPath,
  NOT_FOUND_SSG_ROUTE,
  PRIVATE_SPA_SHELL_PATHS,
  PROTECTED_ROUTE_PREFIXES,
  PROTECTED_SPA_SHELL_ASSET_PATH,
  PUBLIC_SSG_ROUTES,
  returnPathFromQuery
} from "./routes";

describe("login return path", () => {
  test("recognizes protected paths by whole segments", () => {
    expect(isProtectedRoutePath("/app")).toBe(true);
    expect(isProtectedRoutePath("/app/settings/profile")).toBe(true);
    expect(isProtectedRoutePath("/appx")).toBe(false);
    expect(isProtectedRoutePath("/pricing")).toBe(false);
  });

  test("carries protected paths and drops everything else", () => {
    expect(loginPath("/app/settings/profile?tab=security")).toBe(
      "/login?next=%2Fapp%2Fsettings%2Fprofile%3Ftab%3Dsecurity"
    );
    expect(loginPath("/pricing")).toBe("/login");
    expect(loginPath("//evil.example/app")).toBe("/login");
  });

  test("accepts only same-origin protected paths from the query string", () => {
    expect(returnPathFromQuery("?next=%2Fapp%2Faccount%3Fx%3D1", "/app")).toBe("/app/account?x=1");
    for (const value of [
      "https://evil.example/app",
      "//evil.example/app",
      "/\\evil.example/app",
      "/app/../login",
      "/pricing",
      "javascript:alert(1)"
    ]) {
      expect(returnPathFromQuery(`?${new URLSearchParams({ next: value })}`, "/app")).toBe("/app");
    }
    expect(returnPathFromQuery("", "/app")).toBe("/app");
  });
});

describe("route registry", () => {
  test("recognizes backend paths by whole segments", () => {
    expect(isBackendRoutePath("/health")).toBe(true);
    expect(isBackendRoutePath("/api/v1/me")).toBe(true);
    expect(isBackendRoutePath("/authors")).toBe(false);
    expect(isBackendRoutePath("/pricing")).toBe(false);
  });

  test("keeps public, backend and protected routes disjoint", () => {
    const groups = [PUBLIC_SSG_ROUTES, BACKEND_ROUTE_PREFIXES, PROTECTED_ROUTE_PREFIXES];
    const all = groups.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(NOT_FOUND_SSG_ROUTE);
    expect(PRIVATE_SPA_SHELL_PATHS).toContain("/index-spa.html");
  });

  test("matches Worker-first asset routes exactly", async () => {
    // wrangler.jsonc keeps comments, so it needs a JSONC-aware parser.
    const source = await Bun.file("wrangler.jsonc").text();
    const parsed = parseConfigFileTextToJson("wrangler.jsonc", source);
    expect(parsed.error).toBeUndefined();
    const config = parsed.config as { assets: { run_worker_first: string[] } };

    // A leftover pattern would keep invoking the Worker for a route the registry no
    // longer has, so the list must equal what the registry needs, not just contain it.
    const expected = [
      // The home page is public but redirects signed-in visitors to the protected area.
      "/",
      ...[...BACKEND_ROUTE_PREFIXES, ...PROTECTED_ROUTE_PREFIXES, PROTECTED_SPA_SHELL_ASSET_PATH].flatMap(
        (route) => [route, `${route}/*`]
      ),
      ...PRIVATE_SPA_SHELL_PATHS.filter(
        (shellPath) => shellPath !== PROTECTED_SPA_SHELL_ASSET_PATH && !shellPath.endsWith("/")
      ),
      "!/assets/*"
    ];
    expect(config.assets.run_worker_first.toSorted()).toEqual(expected.toSorted());
  });
});
