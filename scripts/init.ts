/**
 * Turns this framework into a new project: renames every identifier, generates the
 * local session secret and optionally provisions the D1 database.
 *
 *   bun run init --name minha-app --title "Minha App" --host app.minhaapp.com
 */
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SELF = resolve(import.meta.dir, "init.ts");

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".github",
  ".idea",
  ".logs",
  ".wrangler",
  ".wrangler-config",
  "coverage",
  "dist"
]);

const TEXT_EXTENSIONS = [".ts", ".vue", ".html", ".css", ".json", ".jsonc", ".sql", ".yml", ".yaml"];

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,44}[a-z0-9])$/u;
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/u;
const SCOPE_PATTERN = /^@[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/u;
const DATABASE_ID_PATTERN = /database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/u;

interface Options {
  name: string;
  title: string;
  scope: string;
  host: string;
  createDatabase: boolean;
  dryRun: boolean;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function readArguments(argv: string[]): Options {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (!argument.startsWith("--")) fail(`unexpected argument: ${argument}`);
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags.add(key);
    } else {
      values.set(key, next);
      index += 1;
    }
  }

  const name = values.get("name");
  if (name === undefined) {
    fail('missing --name. Example: bun run init --name minha-app --title "Minha App"');
  }
  if (!NAME_PATTERN.test(name)) {
    fail("--name must be lowercase letters, digits and dashes (2 to 46 characters)");
  }

  const title = values.get("title") ??
    name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  const scope = values.get("scope") ?? `@${name}`;
  if (!SCOPE_PATTERN.test(scope)) fail("--scope must look like @my-scope");
  const host = values.get("host") ?? `${name}.invalid`;
  if (!HOST_PATTERN.test(host)) fail("--host must be a bare hostname, without protocol or path");

  return {
    name,
    title,
    scope,
    host,
    createDatabase: flags.has("create-d1"),
    dryRun: flags.has("dry-run")
  };
}

/** Ordered on purpose: the longest identifiers must be replaced first. */
function replacements(options: Options): Array<[string, string]> {
  return [
    ["hvbc.invalid", options.host],
    ["__Host-hvbc-session", `__Host-${options.name}-session`],
    ["@hvbc/", `${options.scope}/`],
    ["HVBC framework", options.title],
    ["HVBC", options.title],
    ["hvbc", options.name]
  ];
}

async function* textFiles(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      yield* textFiles(path);
      continue;
    }
    // The script holds the identifiers being replaced, so it must skip itself.
    if (path === SELF) continue;
    if (TEXT_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) yield path;
  }
}

async function rename(options: Options): Promise<string[]> {
  const rules = replacements(options);
  const changed: string[] = [];
  for await (const path of textFiles(ROOT)) {
    const original = await Bun.file(path).text();
    let updated = original;
    for (const [from, to] of rules) updated = updated.replaceAll(from, to);
    if (updated === original) continue;
    changed.push(relative(ROOT, path).replaceAll("\\", "/"));
    if (!options.dryRun) await Bun.write(path, updated);
  }
  return changed.sort();
}

async function writeDevVars(dryRun: boolean): Promise<boolean> {
  const path = resolve(ROOT, ".dev.vars");
  if (await Bun.file(path).exists()) return false;
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const example = await Bun.file(resolve(ROOT, ".dev.vars.example")).text();
  if (!dryRun) await Bun.write(path, example.replace("SESSION_SECRET=", `SESSION_SECRET=${secret}`));
  return true;
}

function createDatabase(name: string): string | null {
  const result = spawnSync("bunx", ["wrangler", "d1", "create", name], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    return null;
  }
  return DATABASE_ID_PATTERN.exec(result.stdout)?.[1] ?? null;
}

async function applyDatabaseId(databaseId: string): Promise<void> {
  const path = resolve(ROOT, "wrangler.jsonc");
  const source = await Bun.file(path).text();
  await Bun.write(path, source.replace("00000000-0000-0000-0000-000000000000", databaseId));
}

const options = readArguments(process.argv.slice(2));

console.log(
  `${options.dryRun ? "Previewing" : "Applying"}: name=${options.name} title="${options.title}" scope=${options.scope} host=${options.host}`
);

const changed = await rename(options);
for (const path of changed) console.log(`  updated ${path}`);
console.log(`${changed.length} files ${options.dryRun ? "would change" : "changed"}.`);

const createdDevVars = await writeDevVars(options.dryRun);
console.log(
  createdDevVars
    ? `  ${options.dryRun ? "would create" : "created"} .dev.vars with a fresh SESSION_SECRET`
    : "  .dev.vars already exists and was kept"
);

if (options.createDatabase && !options.dryRun) {
  const databaseId = createDatabase(options.name);
  if (databaseId === null) {
    console.warn("  could not create the D1 database; run `bunx wrangler d1 create` manually");
  } else {
    await applyDatabaseId(databaseId);
    console.log(`  created D1 database and wrote database_id ${databaseId}`);
  }
}

console.log("\nNext steps:");
console.log("  1. Review README.md and AGENTS.md; they still describe the framework.");
if (!options.createDatabase) {
  console.log(`  2. Run: bunx wrangler d1 create ${options.name} and copy database_id into wrangler.jsonc`);
}
console.log("  3. Run: bun install && bun run verify");
console.log("  4. Remove the bootstrap tooling as described in README.md (Quick Start).");
