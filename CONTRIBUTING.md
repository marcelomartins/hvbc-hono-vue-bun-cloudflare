# Contributing

Issues and pull requests are welcome. For significant changes, open an issue first so the design can be discussed before implementation.

## Before you open a pull request

Install and run the full pipeline. It has to pass from a clean checkout, with no `.dev.vars` — that is exactly what CI does.

```bash
bun install
```

```bash
bun run verify
```

`verify` runs type generation, lint (oxlint + knip), typecheck across every workspace, unit tests, integration tests against real workerd with migrated D1, the build with its guards, a boot check of the bundled Bun server, and local migrations. Fix the cause of a failure; never weaken a check to get past it.

## What must stay stable

The conventions the framework depends on are documented in [`AGENTS.md`](./AGENTS.md) under *Architecture Invariants*. They are deliberate, and a pull request that breaks one will be asked to change. In particular, preserve the routing model:

- only public pages are pre-rendered
- protected routes still pass through the Worker before the SPA shell is served
- the Worker still bundles with `DB` and `ASSETS`

Some other rules worth knowing before you start: everything is in English, including visible application text; no locale is hardcoded; all D1 access uses prepared statements with `.bind()`; request bodies are read through `readJson` with the shared Zod schemas; and nothing that could identify a user — bodies, passwords, tokens, cookies, raw email addresses — is ever logged.

## Dependencies

Dependabot opens weekly pull requests for Bun packages and GitHub Actions, and the `audit` workflow runs `bun audit` on every pull request and once a week. A change may not leave a known advisory in `bun.lock`.

When a fixed version exists but a dependency pins the vulnerable one, force the fixed version with `overrides` in the root `package.json` and record it here. Remove the entry as soon as the pinning package ships the fix.

| Override | Why | Remove when |
| --- | --- | --- |
| `sharp@0.35.5`, `undici@7.29.1` | `@cloudflare/vitest-pool-workers@0.23.0` pins a Miniflare release with vulnerable versions; these are the versions the current Miniflare already ships | `@cloudflare/vitest-pool-workers` depends on a Miniflare that pins these versions or later |

Dependabot skips the major versions the toolchain cannot run yet. [`.github/dependabot.yml`](./.github/dependabot.yml) names the blocking dependency next to each rule; drop the rule once that dependency supports the new major.

## Reporting a security issue

Do not open a public issue. See [`SECURITY.md`](./SECURITY.md).
