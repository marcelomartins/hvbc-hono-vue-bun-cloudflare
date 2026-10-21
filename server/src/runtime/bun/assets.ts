import { NOT_FOUND_SSG_ROUTE, PROTECTED_SPA_SHELL_ASSET_PATH } from "@hvbc/contracts/routes";
import { IMMUTABLE_ASSETS_CACHE_CONTROL, IMMUTABLE_ASSETS_PREFIX } from "@hvbc/contracts/static-assets";
import { lstat } from "node:fs/promises";
import { join } from "node:path";

import type { AssetFetcher } from "../types";

const NOT_FOUND_PAGE = `${NOT_FOUND_SSG_ROUTE}.html`;
const REQUIRED_FILES = ["/index.html", NOT_FOUND_PAGE, `${PROTECTED_SPA_SHELL_ASSET_PATH}.html`];

// Only regular files found at boot can ever be served, matched exactly and
// case-sensitively. Resolving request paths against the file system instead would
// serve /INDEX-SPA.html on case-insensitive disks, past the private shell check.
async function indexFiles(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const relative of new Bun.Glob("**/*").scan({ cwd: root, onlyFiles: true, dot: false })) {
    const urlPath = `/${relative.replaceAll("\\", "/")}`;
    // _headers configures the Cloudflare asset layer and is never public.
    if (urlPath === "/_headers" || urlPath.split("/").some((segment) => segment.startsWith("."))) continue;
    const absolute = join(root, relative);
    if (!(await lstat(absolute)).isFile()) continue;
    files.set(urlPath, absolute);
  }
  return files;
}

function decodedPath(request: Request): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return null;
  }
  return path.includes("\0") ? null : path;
}

// Mirrors the extensionless URLs of the Cloudflare asset layer: /pricing serves pricing.html.
function candidatePaths(path: string): string[] {
  if (path.endsWith("/")) return [`${path}index.html`];
  return [path, `${path}.html`, `${path}/index.html`];
}

function fileResponse(request: Request, urlPath: string, absolutePath: string, status: number): Response {
  const file = Bun.file(absolutePath);
  const headers = new Headers({
    "content-type": file.type,
    "content-length": String(file.size),
    // Fingerprinted assets never change; everything else must revalidate after a deploy.
    "cache-control": urlPath.startsWith(IMMUTABLE_ASSETS_PREFIX) ? IMMUTABLE_ASSETS_CACHE_CONTROL : "no-cache"
  });
  return new Response(request.method === "HEAD" ? null : file, { status, headers });
}

/**
 * Serves the frontend build the way the Cloudflare asset layer does. It never decides
 * who may see a page: the Hono routes run first and keep the private shell gated.
 */
export async function staticAssets(root: string): Promise<AssetFetcher> {
  const files = await indexFiles(root);
  const missing = REQUIRED_FILES.filter((path) => !files.has(path));
  if (missing.length > 0) {
    throw new Error(`The frontend build in STATIC_DIR is incomplete; run bun run build:web (missing ${missing.join(", ")})`);
  }
  const notFoundPage = files.get(NOT_FOUND_PAGE) ?? "";

  return {
    fetch: async (request) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
      }
      const path = decodedPath(request);
      for (const candidate of path === null ? [] : candidatePaths(path)) {
        const absolute = files.get(candidate);
        if (absolute !== undefined) return fileResponse(request, candidate, absolute, 200);
      }
      return fileResponse(request, NOT_FOUND_PAGE, notFoundPage, 404);
    }
  };
}
