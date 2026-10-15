import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AssetFetcher } from "../types";
import { staticAssets } from "./assets";

let root: string;
let assets: AssetFetcher;

const FILES: Record<string, string> = {
  "index.html": "home",
  "404.html": "not found",
  "index-spa.html": "shell",
  "pricing.html": "pricing",
  "docs/index.html": "docs",
  "assets/main-abc123.js": "console.log(1)",
  "_headers": "/*\n  X-Test: 1",
  ".env": "SECRET=1",
  "assets/.hidden.js": "hidden"
};

async function get(path: string, method = "GET"): Promise<Response> {
  return assets.fetch(new Request(`http://localhost${path}`, { method }));
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "hvbc-assets-"));
  await Promise.all(Object.entries(FILES).map(([path, body]) => Bun.write(join(root, path), body)));
  assets = await staticAssets(root);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("static assets", () => {
  test("serves pages by their extensionless URL", async () => {
    expect(await (await get("/")).text()).toBe("home");
    expect(await (await get("/pricing")).text()).toBe("pricing");
    expect(await (await get("/docs/")).text()).toBe("docs");
    expect(await (await get("/index-spa")).text()).toBe("shell");
  });

  test("matches paths exactly and case-sensitively", async () => {
    for (const path of ["/INDEX-SPA.html", "/Index.html", "/Pricing"]) {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("not found");
    }
  });

  test("never serves _headers or dotfiles", async () => {
    for (const path of ["/_headers", "/.env", "/assets/.hidden.js"]) {
      expect((await get(path)).status).toBe(404);
    }
  });

  test("cannot leave the build directory", async () => {
    for (const path of ["/%2e%2e/%2e%2e/etc/passwd", "/assets%2f..%2f..%2fpackage.json", "/..%5c..%5cpackage.json"]) {
      expect((await get(path)).status).toBe(404);
    }
  });

  test("answers malformed encodings and NUL bytes with the 404 page", async () => {
    for (const path of ["/%E0%A4%A", "/pricing%00.html"]) {
      expect((await get(path)).status).toBe(404);
    }
  });

  test("caches fingerprinted assets forever and revalidates everything else", async () => {
    const script = await get("/assets/main-abc123.js");
    expect(script.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(script.headers.get("content-type")).toContain("javascript");
    expect((await get("/pricing")).headers.get("cache-control")).toBe("no-cache");
  });

  test("answers HEAD without a body and refuses other methods", async () => {
    const head = await get("/pricing", "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("7");
    expect(await head.text()).toBe("");
    expect((await get("/pricing", "POST")).status).toBe(405);
  });

  test("refuses to start without the required pages", async () => {
    const empty = await mkdtemp(join(tmpdir(), "hvbc-assets-empty-"));
    try {
      await expect(staticAssets(empty)).rejects.toThrow("bun run build:web");
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
