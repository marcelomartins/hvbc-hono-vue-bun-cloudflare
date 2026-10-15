# AGENTS

## Instructions

- Act as a Senior Full-Stack Software Engineer with experience in TypeScript, Bun, Hono, Cloudflare Workers, D1, Vue 3, and web application security.
- IMPORTANT: Critically evaluate all prompts, requirements, and proposed solutions. If anything is incomplete, incorrect, insecure, inconsistent with the existing architecture, unnecessarily complex, or otherwise open to improvement, you MUST raise the concern, clearly explain the issue, and propose the most appropriate alternative before implementing it.
- Only do what is explicitly requested. Do not create features that were not requested.
- Only add comments when they explain decisions, risks, or non-obvious invariants; comments that merely describe the code are not necessary.
- There should be no unnecessary or unused code, and no unused files.
- Do not create documentation files unless they are clearly requested.
- Do not use Git to commit changes. Git may only be used to view or inspect changes.
- If `scripts/init.ts` still exists, this is either the framework itself or a project created from it that has not been initialized yet. Unless the user has said which, ask before changing anything; for a new project, follow [`SETUP.md`](./SETUP.md) before any other work.
- Read [`README.md`](./README.md) for the stack, the architecture, the routing model, and the API surface before changing code.

## Architecture Invariants

- Keep `wrangler.jsonc` at the repository root, the Cloudflare entry point at `server/src/cloudflare.ts`, and the Bun entry point at `server/src/bun.ts`. Both build the app with `createApp` from `server/src/app.ts`, and the framework must keep running fully without Cloudflare. Shared code never imports `bun:*` or `cloudflare:*`; Bun-specific code lives only in `server/src/bun.ts` and `server/src/runtime/bun/`.
- Derive every routing decision from the route registry in `server-shared/contracts/src/router/routes.ts`. Where a file cannot import it (`wrangler.jsonc`), keep a test that validates that file against the registry; never maintain an unchecked route list.
- Never pre-render a protected page, never serve the SPA shell before the server has checked the session, and keep `/index-spa*` returning 404 to direct browser requests.
- The Bun static adapter serves only regular files indexed at boot from the build output, matched exactly and case-sensitively, and never `_headers` or dotfiles. Access decisions stay in the Hono routes.
- Keep `HttpOnly`, `Path=/`, and `SameSite=Lax` on the session cookie, and the `__Host-` prefix and `Secure` whenever `APP_ORIGIN` is HTTPS or `ENVIRONMENT=local`. They are dropped only for plain HTTP outside local development, which `assertRuntimeConfiguration` accepts only with `ALLOW_INSECURE_HTTP=true`, and HSTS is not sent then. Never relax this further.
- Sessions are stateless HMAC tokens bound to `users.session_version`, with no session table. This is a deliberate trade-off: a single device cannot be signed out on its own, and `SESSION_SECRET` can mint a session for any user, so a leaked secret must be rotated, which signs every user out. Changing this model is an explicit decision, not a refactor.
- Revocation must not be weakened: logout increments `session_version` and invalidates every token of that user on every device; a password change does the same and reissues a token for the current session only. Neither may report success unless its write happened.
- Security-sensitive account changes (the password today; email or session management if added) require the current password in the same request.
- Keep the optional integrations optional: disabled by default, validated by `assertRuntimeConfiguration` only when enabled, failing closed once enabled, and never required by a default flow.
- Validate the host and the `Origin` header in the server (`validateHostAndOrigin`) on every mutation. Frontend controls never replace authorization or validation in the server.
- Keep `assertRuntimeConfiguration` rejecting missing or inconsistent `ENVIRONMENT`, `SESSION_SECRET`, `APP_HOST`, and `APP_ORIGIN`. Absence of secrets must never enable permissive fallbacks. The Bun server runs it before listening and exits on failure; in production it also refuses to start when `APP_ORIGIN` differs from the origin the frontend was built for.
- An integration that needs something only one runtime provides (the `AUTH_RATE_LIMITER` binding today) receives it through the environment, and enabling it on a runtime without it must stop the server from starting.
- On Bun, trust a proxy IP header only when `TRUSTED_PROXY_IP_HEADER` names it. Never read `x-forwarded-for` by default.
- Use D1 prepared statements with `.bind()` for all external values. Never build SQL by concatenation.
- Writes that can lose a race must detect it: a conditional `UPDATE` or `DELETE` uses `RETURNING` or checks the affected rows, and an insert under a `UNIQUE` constraint uses `ON CONFLICT`. A lost race returns `409`, never a false success or a `500`.
- Never accept numeric database ids from clients; the UUID v7 `uuid` column is the only public identifier.
- Read external bodies through `readJson` with the shared Zod schemas, never `request.json()` directly.
- Keep API error codes stable and in English; user-facing messages belong in the frontend i18n map.
- Do not log request/response bodies, passwords, tokens, cookies, codes, or raw email addresses. Use `structuredLog` with non-sensitive diagnostic fields and `sanitizedRequestPath`; it writes objects for Workers Logs and one JSON line per event on Bun.
- Keep everything in English: technical names, code, tests, logs, documentation, and visible application text. Never hardcode a locale.
- Use Bun for package management, scripts, and unit tests. Do not switch the package manager or generate another lockfile.
- Keep `bun audit` free of advisories. Every entry in the root `overrides` must be listed in [`CONTRIBUTING.md`](./CONTRIBUTING.md#dependencies) with why it exists and when to remove it.
- Prefer Web APIs in shared code. Bun APIs, and the Node APIs Bun offers no alternative to, belong only in the Bun entry point and `server/src/runtime/bun/`. Elsewhere, Node-specific APIs require a concrete need.
- Do not add browser dependencies casually: `check-client-build` enforces the forbidden-dependency list and the client JavaScript budget.
- Treat existing migrations as applied. Schema changes require a new additive migration, unless the user explicitly confirms the database can be recreated.
- Do not put secrets in `wrangler.jsonc`, code, or committed files.
- Declare every optional binding in `server/vitest.config.ts` and pin every optional variable in `server/scripts/boot-smoke.ts`, so neither depends on the developer's `.dev.vars` or `.env`.
- Define browser security headers only in `server-shared/contracts/src/http/security-headers.ts`: the Worker applies them and the build generates `_headers` from them. Never hand-write `_headers`, `robots.txt`, or `sitemap.xml`; the build generates them.
- `scripts/init.ts` holds the identifiers it rewrites, so it must keep excluding itself from the walk. Update it whenever a new framework identifier is introduced.
- Never pass secrets as Docker build arguments or bake them into the image; `APP_ORIGIN` is the only build argument.
- Do not add remote bindings, deploy, use remote D1, set secrets, change DNS, or push images to a registry without explicit authorization.

## Verification

Run `bun run verify` before completing shared changes; the [Available Scripts](./README.md#available-scripts) table lists the individual steps to use while iterating. Also confirm the Worker still bundles with `DB` and `ASSETS`, and that the Bun server bundles and boots (`bun run test:boot`, part of `verify`).

Targeted tests are appropriate while iterating. All integration tests must use local workerd/Miniflare bindings. The Bun target is covered by unit tests of its adapters and by `bun run test:boot`; do not duplicate the integration suite for it. Do not start `bun run dev` or run browser tests unless the task explicitly requires runtime validation.
