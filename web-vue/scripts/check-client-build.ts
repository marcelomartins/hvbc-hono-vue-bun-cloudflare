import { readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";

import { NOT_FOUND_SSG_ROUTE, PUBLIC_SSG_ROUTES } from "@hvbc/contracts/routes";

import { appOrigin } from "./app-origin";
import { FORBIDDEN_CHUNK_PREFIX } from "./forbidden-dependencies";
import { removeDuplicateAssetTags } from "./head-assets";

const decoder = new TextDecoder();
const outputDirectory = "../dist/web-vue";
const origin = appOrigin("../wrangler.jsonc");

function outputPath(relativePath: string): string {
  return `${outputDirectory}/${relativePath}`;
}

function htmlFile(route: string): string {
  return route === "/" ? "index.html" : `${route.slice(1)}.html`;
}

async function text(path: string): Promise<string> {
  return decoder.decode(await Bun.file(path).arrayBuffer());
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hasTag(html: string, element: string, attributes: Record<string, string>): boolean {
  return [...html.matchAll(new RegExp(`<${element}\\b[^>]*>`, "gu"))].some(([tag]) =>
    Object.entries(attributes).every(([name, value]) => tag.includes(`${name}="${value}"`))
  );
}

const publicHtmlFiles = [...PUBLIC_SSG_ROUTES, NOT_FOUND_SSG_ROUTE].map(htmlFile);
const expectedHtmlFiles = [...publicHtmlFiles, "index-spa.html"];
const emittedHtml = new Map<string, string>();
for (const relativePath of expectedHtmlFiles) {
  const path = outputPath(relativePath);
  assert(await Bun.file(path).exists(), `${path} was not emitted`);
  emittedHtml.set(relativePath, await text(path));
}

for (const relativePath of publicHtmlFiles) {
  const html = emittedHtml.get(relativePath) ?? "";
  const path = outputPath(relativePath);
  assert(/<html[^>]+lang="[a-z]{2}(-[A-Z]{2})?"/u.test(html), `${path} must declare a language`);
  assert(html.includes('data-server-rendered="true"'), `${path} must contain SSG markup`);
  assert(/<meta name="description" content="[^"]+"/u.test(html), `${path} must have a description`);
  assert(removeDuplicateAssetTags(html) === html, `${path} references the same asset twice`);
}

function pageTitle(html: string): string | undefined {
  return /<title[^>]*>([^<]*)<\/title>/u.exec(html)?.[1];
}

const notFoundTitle = pageTitle(emittedHtml.get(htmlFile(NOT_FOUND_SSG_ROUTE)) ?? "");
assert(notFoundTitle !== undefined, "the 404 page must have a title");

for (const route of PUBLIC_SSG_ROUTES) {
  const html = emittedHtml.get(htmlFile(route)) ?? "";
  // A registry route without its own Vue route falls through to the catch-all and
  // would be published as the not-found page with status 200.
  assert(
    pageTitle(html) !== notFoundTitle,
    `${outputPath(htmlFile(route))} renders the not-found page; register a Vue route for ${route}`
  );
  const url = `${origin}${route}`;
  assert(
    hasTag(html, "link", { rel: "canonical", href: url }) && hasTag(html, "meta", { property: "og:url", content: url }),
    `${outputPath(htmlFile(route))} must declare ${url} as its canonical URL`
  );
}
assert(
  hasTag(emittedHtml.get(htmlFile(NOT_FOUND_SSG_ROUTE)) ?? "", "meta", { name: "robots", content: "noindex" }),
  "the 404 page must not be indexed"
);

const privateShell = emittedHtml.get("index-spa.html") ?? "";
assert(!privateShell.includes('data-server-rendered="true"'), "the private shell must not be pre-rendered");
for (const file of ["_headers", "robots.txt", "sitemap.xml"]) {
  assert(await Bun.file(outputPath(file)).exists(), `${outputPath(file)} was not emitted`);
}

const assetFiles = await readdir(outputPath("assets"));
assert(
  !assetFiles.some((file) => file.startsWith(FORBIDDEN_CHUNK_PREFIX)),
  "a forbidden dependency reached the browser graph"
);
assert(!assetFiles.some((file) => file.endsWith(".map")), "browser source maps must not be emitted");

const javascriptFiles = assetFiles.filter((file) => file.endsWith(".js"));
const totalGzipBytes = (
  await Promise.all(javascriptFiles.map(async (file) => gzipSync(await Bun.file(outputPath(`assets/${file}`)).arrayBuffer()).byteLength))
).reduce((total, size) => total + size, 0);
assert(totalGzipBytes <= 300_000, `client JavaScript exceeds 300 kB gzip: ${totalGzipBytes}`);

console.log(JSON.stringify({ publicSsgPages: publicHtmlFiles.length, clientJavaScriptGzipBytes: totalGzipBytes }));
