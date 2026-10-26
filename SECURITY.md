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

Out of scope: the placeholder values a fresh clone ships with. `hvbc.invalid` as the host and the zeroed `database_id` in `wrangler.jsonc` are deliberate placeholders, which a project replaces with its own domain and the id returned by `bunx wrangler d1 create`. A project that deploys those unchanged is misconfigured, not vulnerable.

Also out of scope: findings that depend on secrets being committed. `.dev.vars` is gitignored, production values belong in `wrangler secret`, and the server refuses to serve requests when `SESSION_SECRET`, `APP_ORIGIN`, or `ENVIRONMENT` are missing or invalid.

Deliberate trade-offs are not vulnerabilities either:

- Sessions are stateless and can only be revoked for every device at once (see `AGENTS.md`).
- Passwords are hashed with PBKDF2 at 100,000 iterations, the most Workers allows.
- There is no rate limit, password recovery, or email verification by default, as the README describes under "Before going live".
