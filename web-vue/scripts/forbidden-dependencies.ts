const FORBIDDEN_BROWSER_PACKAGES = [
  "axios",
  "pinia",
  "zod",
  "@tanstack/query-core",
  "@tanstack/vue-query"
];

export const FORBIDDEN_CHUNK_PREFIX = "forbidden-dependency";

export function forbiddenDependencyChunk(id: string): string | undefined {
  const normalized = id.replaceAll("\\", "/");
  const forbidden = FORBIDDEN_BROWSER_PACKAGES.find((name) =>
    normalized.includes(`/node_modules/${name}/`)
  );
  if (forbidden === undefined) return undefined;
  return `${FORBIDDEN_CHUNK_PREFIX}-${forbidden.replaceAll(/[^a-z0-9]+/giu, "-")}`;
}
