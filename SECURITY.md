# Security Policy

## Supported versions

HVBC is a framework you copy into a new project, not a versioned library. Only the current `main` branch receives fixes. If you built a project from an older copy, compare it against `main` before reporting.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Email <marcelo@martins.net.br> with:

- what the issue is and which files are involved
- how to reproduce it, ideally against a clean checkout
- what an attacker gains

You will get an acknowledgement. Once a fix is out, you will be credited unless you prefer otherwise.

## Scope

The parts of this repository most worth scrutiny are session issuing and validation, password hashing, the host and `Origin` checks, the fail-closed runtime configuration, the D1 query layer, and the Cloudflare asset and route gating that decides what is served before authentication.

Out of scope: the placeholder values a fresh clone ships with. `hvbc.invalid` as the host and the zeroed `database_id` in `wrangler.jsonc` are deliberate, and `bun run init` replaces them. A project that deploys those unchanged is misconfigured, not vulnerable.

Also out of scope: findings that depend on secrets being committed. `.dev.vars` is gitignored, production values belong in `wrangler secret`, and the runtime refuses to start when `SESSION_SECRET`, `APP_HOST`, `APP_ORIGIN`, or `ENVIRONMENT` are missing or inconsistent.
