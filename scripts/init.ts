/**
 * Turns this framework into a new project: renames every identifier and then
 * removes itself.
 *
 *   bun run init --name my-app --title "My App" --host app.example.com
 */
import { readdir, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SELF = resolve(import.meta.dir, "init.ts");

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
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

const VALUE_OPTIONS = new Set(["name", "title", "scope", "host"]);
const FLAG_OPTIONS = new Set(["dry-run"]);

// The clean-up finds these by their exact text, so README.md and AGENTS.md must keep it.
const README_SECTIONS = ["## Start with an AI agent", "### Start a new project"];
const AGENTS_INVARIANT = "- `scripts/init.ts` ";
const TYPECHECK_PREFIX = "tsc --noEmit -p scripts/tsconfig.json && ";

interface Options {
  name: string;
  title: string;
  scope: string;
  host: string;
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
    const isFlag = next === undefined || next.startsWith("--");
    // A misspelled or retired option must stop the run instead of being ignored.
    if (!(isFlag ? FLAG_OPTIONS : VALUE_OPTIONS).has(key)) {
      fail(isFlag && VALUE_OPTIONS.has(key) ? `${argument} needs a value` : `unknown option: ${argument}`);
    }
    if (isFlag) {
      flags.add(key);
    } else {
      values.set(key, next);
      index += 1;
    }
  }

  const name = values.get("name");
  if (name === undefined) {
    fail('missing --name. Example: bun run init --name my-app --title "My App"');
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
    dryRun: flags.has("dry-run")
  };
}

/** Ordered on purpose: the longest identifiers must be replaced first. */
function replacements(options: Options): Array<[string, string]> {
  return [
    ["hvbc.invalid", options.host],
    ["__Host-hvbc-session", `__Host-${options.name}-session`],
    ["@hvbc/", `${options.scope}/`],
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

async function rewrite(path: string, edit: (source: string) => string, dryRun: boolean): Promise<boolean> {
  const source = await Bun.file(path).text();
  const updated = edit(source);
  if (updated === source) return false;
  if (!dryRun) await Bun.write(path, updated);
  return true;
}

function newlineOf(source: string): string {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function editLines(source: string, edit: (lines: string[]) => string[]): string {
  return edit(source.split(/\r?\n/u)).join(newlineOf(source));
}

function withoutReadmeSection(lines: string[], heading: string): string[] {
  const start = lines.indexOf(heading);
  if (start === -1) return lines;
  const length = lines.slice(start + 1).findIndex((line) => line.startsWith("## ") || line.startsWith("### "));
  return [...lines.slice(0, start), ...(length === -1 ? [] : lines.slice(start + 1 + length))];
}

function withoutInitScript(source: string): string {
  const manifest = JSON.parse(source) as { scripts: Record<string, string> };
  const typecheck = manifest.scripts["typecheck"];
  if (manifest.scripts["init"] === undefined && !typecheck?.includes(TYPECHECK_PREFIX)) return source;
  delete manifest.scripts["init"];
  if (typecheck !== undefined) manifest.scripts["typecheck"] = typecheck.replace(TYPECHECK_PREFIX, "");
  const newline = newlineOf(source);
  return `${JSON.stringify(manifest, null, 2).replaceAll("\n", newline)}${newline}`;
}

/** Removes this script and every reference to it, which only make sense before initialization. */
async function removeBootstrapTooling(dryRun: boolean): Promise<void> {
  const verb = dryRun ? "would remove" : "removed";
  const steps: Array<[string, string, (source: string) => string]> = [
    ["package.json", "the init script from package.json", withoutInitScript],
    ...README_SECTIONS.map((heading): [string, string, (source: string) => string] => [
      "README.md",
      `the "${heading.replace(/^#+ /u, "")}" section from README.md`,
      (source) => editLines(source, (lines) => withoutReadmeSection(lines, heading))
    ]),
    [
      "AGENTS.md",
      "the scripts/init.ts invariant from AGENTS.md",
      (source) => editLines(source, (lines) => lines.filter((line) => !line.startsWith(AGENTS_INVARIANT)))
    ]
  ];
  for (const [file, description, edit] of steps) {
    const changed = await rewrite(resolve(ROOT, file), edit, dryRun);
    console.log(changed ? `  ${verb} ${description}` : `  could not find ${description}; remove it by hand`);
  }
  if (!dryRun) await rm(import.meta.dir, { recursive: true, force: true });
  console.log(`  ${verb} scripts/`);
}

const options = readArguments(process.argv.slice(2));

console.log(
  `${options.dryRun ? "Previewing" : "Applying"}: name=${options.name} title="${options.title}" scope=${options.scope} host=${options.host}`
);

const changed = await rename(options);
for (const path of changed) console.log(`  updated ${path}`);
console.log(`${changed.length} files ${options.dryRun ? "would change" : "changed"}.`);

await removeBootstrapTooling(options.dryRun);

const nextSteps = [
  "Review the Markdown files and .github/; they still describe the framework and name its maintainer.",
  "Run: bun install && bun run verify",
  `To deploy on Cloudflare, run bunx wrangler d1 create ${options.name} and copy database_id into wrangler.jsonc`
];
console.log("\nNext steps:");
nextSteps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
