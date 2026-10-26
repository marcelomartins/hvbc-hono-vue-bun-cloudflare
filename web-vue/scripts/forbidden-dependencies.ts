// The contracts package also holds the server's Zod schemas. This catches a browser
// import of them, which would ship Zod to every page only to repeat checks the
// server makes anyway; the forms import their limits from @hvbc/contracts/limits.
const FORBIDDEN_BROWSER_PACKAGES = ["zod"];

export const FORBIDDEN_CHUNK_PREFIX = "forbidden-dependency";

export function forbiddenDependencyChunk(id: string): string | undefined {
  const normalized = id.replaceAll("\\", "/");
  const forbidden = FORBIDDEN_BROWSER_PACKAGES.find((name) =>
    normalized.includes(`/node_modules/${name}/`)
  );
  if (forbidden === undefined) return undefined;
  return `${FORBIDDEN_CHUNK_PREFIX}-${forbidden.replaceAll(/[^a-z0-9]+/giu, "-")}`;
}
