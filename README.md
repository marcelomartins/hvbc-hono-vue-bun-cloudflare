# HVBC: Hono Vue Bun Cloudflare Framework

An opinionated full-stack framework, a ready-to-use architecture you copy into a new project, for building Cloudflare-native applications with Bun, Hono, Vue, and D1 Database, built by [Marcelo Martins](mailto:marcelo@martins.net.br).

HVBC combines pre-rendered public pages, authenticated SPA routes, a Worker-first request pipeline, shared TypeScript contracts, and a complete verification pipeline in a single repository. It is designed for teams that want one codebase for marketing pages, application pages, and API endpoints without giving up edge-native deployment.

The design rests on a few deliberate choices: public pages are pre-rendered and served straight from Cloudflare's asset layer, protected routes pass through the Worker before the SPA shell is served, a single route registry is the source of truth for every routing decision, and API contracts and validation schemas are shared between frontend and backend through a workspace package.

## Contents

- [Tech Stack](#tech-stack)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Repository Layout](#repository-layout)
- [Authentication Limits](#authentication-limits)
- [Quick Start](#quick-start)
- [Features](#features)
- [Optional Features](#optional-features)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Available Scripts](#available-scripts)
- [Routing Model](#routing-model)
- [API Surface](#api-surface)
- [Database](#database)
- [Testing and Verification](#testing-and-verification)
- [Deployment](#deployment)
- [Running Outside Cloudflare](#running-outside-cloudflare)
- [Contributing](#contributing)
- [License](#license)

## Tech Stack

- Bun workspaces for package management, scripts, and unit tests
- Vue 3, Vue Router, vite-ssg, and @unhead/vue for the web client
- Hono on Cloudflare Workers for the API and route orchestration
- Cloudflare D1 Database for persistence
- Zod for shared validation schemas
- Vitest with `@cloudflare/vitest-pool-workers` for integration tests against real workerd
- oxlint and knip for linting and dead-code detection
- TypeScript (strict, shared root config) across all packages

## Architecture at a Glance

```text
Browser request
  |
  +-> Public route (/pricing, /contact, /login, /register)
  |      -> Cloudflare asset layer resolves prerendered HTML without invoking the Worker
  |
  +-> Home (/)
  |      -> Worker redirects authenticated users to /app, otherwise serves the SSG page
  |
  +-> Protected area (/app, /app/account, /app/settings)
  |      -> Worker checks the session cookie first; anonymous visitors go to /login?next=<path>
  |      -> Worker fetches the canonical /index-spa asset
  |      -> Vue SPA loads protected modules
  |
  +-> Backend route (/auth/*, /api/v1/*, /health)
         -> requestPipeline (config check, host/origin validation, request id, structured log)
         -> Route modules with Zod-validated bodies
         -> D1 Database access through repositories
```

The root [`wrangler.jsonc`](./wrangler.jsonc) scopes `run_worker_first` to `/`, backend namespaces, protected routes, and the private SPA shell. Public SSG pages and hashed assets are served directly by Cloudflare's asset layer.

Self-hosted on Bun, every request reaches the same Hono app through `Bun.serve` in [`server/src/bun.ts`](./server/src/bun.ts). The same routes gate protected pages and the private shell, and a static adapter serves the prerendered files from `dist/web-vue` in place of the asset layer. See [Self-hosted with Bun and Docker](#self-hosted-with-bun-and-docker).

## Repository Layout

```text
.
|- web-vue/                    # Vue application
|  |- src/public-pages/        # SSG public pages, layouts, and components
|  |- src/app/                 # Protected SPA layouts and pages
|  |- src/api/                 # Typed API client and error types
|  |- src/i18n/                # Error-code to message map
|  |- src/router/              # Public and SPA route groups
|  |- scripts/                 # Build tooling: generated static files, post-build guards
|  |- static/                  # Files copied verbatim into the build (favicon)
|- server/                     # Hono API
|  |- src/app.ts               # createApp: middleware pipeline and request routing
|  |- src/cloudflare.ts        # Cloudflare Workers entry point
|  |- src/bun.ts               # Bun entry point: configuration, migrations, Bun.serve
|  |- src/runtime/             # Runtime-neutral types and the Bun adapters (SQLite, static files)
|  |- src/config.ts            # SECURITY constants and fail-closed env validation
|  |- src/http/                # Middleware pipeline, error contract, JSON reader
|  |- src/auth/                # Registration, login, session middleware
|  |- src/account/             # /api/v1/me
|  |- src/security/            # Password hashing, session tokens, encodings
|  |- src/observability/       # Structured logs and path sanitization
|  |- migrations/              # D1 migrations
|  |- test/                    # Integration tests (vitest-pool-workers)
|  |- scripts/                 # Boot check of the bundled Bun server
|- server-shared/contracts/    # Owned by the server, consumed by the frontend: route registry,
|                              # API types, Zod schemas
|- wrangler.jsonc              # Root Cloudflare configuration
|- Dockerfile                  # Self-hosted image for the Bun target
|- knip.json                   # Dead-code detection configuration
```

## Authentication Limits

The included authentication is a secure baseline, not a complete account system. Read this before you put it in front of real users:

- **No password recovery.** A user who forgets the password cannot get back in; there is no reset flow.
- **No email verification.** Registration accepts any well-formed address without proving that the user owns it.
- **No multi-factor authentication.**
- **Open registration.** Anyone who reaches `/register` can create an account; there is no invitation or approval step.
- **Registration reveals registered emails.** `POST /auth/register` answers `409 EMAIL_ALREADY_REGISTERED` for an address that already has an account, so anyone can check whether an email is registered.
- **Logout signs out every device.** Sessions are stateless tokens revoked through `users.session_version`, so a single device cannot be signed out on its own (see [Authentication and security](#authentication-and-security)).
- **No rate limiting by default.** `/auth/login` and `/auth/register` run PBKDF2 on every request, including for unknown users, with no limit on attempts. Enable [Turnstile](#turnstile) and [rate limiting](#rate-limiting) before going to production.
- **A weak password policy.** Passwords need 8 to 128 characters and are not checked against a list of common or breached passwords. That is below NIST SP 800-63B-4, which asks for at least 15 characters when the password is the only factor and a blocklist check, and below OWASP ASVS level 1, which also requires checking against common passwords.

## Quick Start

Requirements: [Bun](https://bun.sh/), [Node.js](https://nodejs.org/) 22.12 or newer for the Vite toolchain, and a Cloudflare account (only for deploying — local development is fully offline).

### Starting a new project from this framework

Clone the repository and rename every identifier with the bootstrap script:

```bash
bun run init --name minha-app --title "Minha App" --host app.minhaapp.com
```

It rewrites the package names, the Worker name, the D1 database name, the session cookie, the shared package scope, and the visible product name; creates `.dev.vars` with a freshly generated `SESSION_SECRET`; and prints the remaining manual steps. Preview everything first with `--dry-run`, and add `--create-d1` to also run `wrangler d1 create` and write the returned `database_id` into `wrangler.jsonc`.

| Flag | Purpose |
| --- | --- |
| `--name` | Required. Lowercase project identifier used for packages, Worker, and database |
| `--title` | Visible product name (defaults to a title-cased `--name`) |
| `--scope` | Workspace package scope (defaults to `@<name>`) |
| `--host` | Production hostname used for `APP_HOST`/`APP_ORIGIN` (defaults to `<name>.invalid`) |
| `--create-d1` | Create the D1 database and write its `database_id` |
| `--dry-run` | List the files that would change without writing anything |

Afterwards, review `README.md` and `AGENTS.md` (they still describe the framework), then remove the bootstrap tooling. Delete the `scripts/` directory; deleting only `scripts/init.ts` leaves `scripts/tsconfig.json` without inputs and breaks `bun run typecheck`, so also:

- in `package.json`, remove the `init` script and the `tsc --noEmit -p scripts/tsconfig.json && ` prefix of `typecheck`;
- in this README, remove this subsection and the `bun run init` row of the scripts table;
- in `AGENTS.md`, remove the invariant about `scripts/init.ts`.

Then run `bun run verify`.

### Running it

1. Install workspace dependencies.

```bash
bun install
```

2. Create your local environment file if the bootstrap script did not.

```bash
cp .dev.vars.example .dev.vars
```

Generate a value for `SESSION_SECRET` (at least 32 bytes):

```bash
bun --print "require('node:crypto').randomBytes(32).toString('base64url')"
```

3. Start the integrated local development server. This applies local D1 migrations and starts Vue with HMR together with the Worker running in `workerd` on the same origin.

```bash
bun run dev
```

4. Open the local Vite URL and register the first user at `/register`.

## Features

### Routing and rendering

- Public pages generated with SSG: `/`, `/pricing`, `/contact`, `/login`, `/register`, plus a prerendered `404` page.
- Protected SPA routes served only after Worker-side auth, all under `/app`: `/app`, `/app/account`, `/app/settings`.
- A single route registry in [`server-shared/contracts/src/router/routes.ts`](./server-shared/contracts/src/router/routes.ts) drives the Worker, the Vue router, the SSG page list, and a contract test that validates `wrangler.jsonc` coverage.
- Authenticated visitors hitting `/` are redirected to `/app` by the Worker, which is also where signing in and registering lead. Anonymous visitors of a protected route are sent to `/login?next=<path>`, and signing in returns them there; only same-origin protected paths are accepted as `next`, so it cannot become an open redirect.
- The Worker gate decides who receives the SPA shell, not who can read the protected pages' code. Their JavaScript chunks are public files under `/assets/*`, like any other static asset. Protection comes from the Worker and the API, never from keeping the bundle secret: put no secrets, private data, or authorization decisions in frontend code.

### Authentication and security

- Cookie-based sessions with a `__Host-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- Stateless session tokens signed with HMAC-SHA256 (`SESSION_SECRET`); no session table. A `session_version` column on `users` is the revocation mechanism: **logging out revokes every session of the user**, and changing the password revokes the sessions of all other devices while the current one receives a fresh token. The trade-off is deliberate: no single device can be signed out on its own, and `SESSION_SECRET` can mint a session for any user, so a leaked secret must be rotated, which signs every user out.
- Passwords hashed with PBKDF2-SHA256 (100k iterations, per-password salt, timing-safe compare, equalized work for unknown users).
- Host and Origin validation on every request replaces separate CORS/CSRF layers: the Worker only serves its configured host and rejects cross-origin mutations.
- Fail-closed runtime configuration: the Worker refuses to serve if `ENVIRONMENT`, `SESSION_SECRET`, `APP_HOST`, or `APP_ORIGIN` are missing or inconsistent.
- Request bodies are validated with shared Zod schemas and size-limited during read.
- Security headers (CSP, X-Frame-Options, Referrer-Policy, HSTS) defined once in [`server-shared/contracts/src/http/security-headers.ts`](./server-shared/contracts/src/http/security-headers.ts): the Worker applies them to its responses (HSTS outside local), and the build writes them into the `_headers` file for statically served pages. HSTS uses `includeSubDomains`, so deploying on an apex domain requires every subdomain to serve HTTPS.

### Frontend

- Typed API client (`apiFetch<T>`) with an `ApiError` carrying code, requestId, and field details; 401 responses redirect to `/login` with the current protected path as `next`.
- Error codes map to user-facing messages in [`web-vue/src/i18n/messages.ts`](./web-vue/src/i18n/messages.ts).
- No client-side auth store: the Worker is the source of truth, and the SPA shell loads the current user from `/api/v1/me`.
- Per-page title, description, canonical URL, and Open Graph tags via `@unhead/vue`, built from `APP_ORIGIN` in `wrangler.jsonc`; `robots.txt` and `sitemap.xml` are generated from the route registry.

### Build guards and observability

- `check-client-build.ts` runs after every frontend build and fails if: an SSG page is missing or not prerendered, the private SPA shell was prerendered, a public page lacks its description or canonical URL or loads an asset twice, `_headers`, `robots.txt`, or `sitemap.xml` is missing, source maps leak, a forbidden dependency (pinia, zod, axios, …) reaches the browser bundle, or client JavaScript exceeds 300 kB gzip.
- Structured JSON logs with request id, sanitized path (UUIDs masked), status, and duration; Workers observability enabled in `wrangler.jsonc`.

## Optional Features

Every integration below is off by default and the framework runs with none of them configured. The runtime validates their configuration only when they are enabled, so an unconfigured project still boots.

### Email

Set `EMAIL_DRIVER` in [`wrangler.jsonc`](./wrangler.jsonc) (production) or `.dev.vars` (local):

- `none`: no delivery. Calls are logged and skipped.
- `console`: prints the message in the terminal. Allowed only when `ENVIRONMENT=local`.
- `ses`: delivers through Amazon SES using SigV4-signed HTTPS requests, with no AWS SDK dependency. Requires `SES_REGION`, `SES_FROM`, and the `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets.

Messages live in [`server/src/email/messages.ts`](./server/src/email/messages.ts); registration sends a welcome message as a best-effort side effect, so a provider outage never fails a signup. Add new messages there and send them with `sendEmail`.

### Turnstile

1. Create a Turnstile widget in the Cloudflare dashboard.
2. Put the site key in `TURNSTILE_SITE_KEY` (a public var) and the secret with `bunx wrangler secret put TURNSTILE_SECRET_KEY`. Locally, both go in `.dev.vars`.
The CSP always allows the Turnstile origin, so enabling it needs no header change. Once the secret is present, `/auth/register` and `/auth/login` require a valid token and fail closed on any verification error. The frontend widget reads the site key from `GET /auth/config`, so there is no second source of configuration in the build.

### Rate limiting

When enabled, `/auth/login` is limited per client IP and per account email, and `/auth/register` per client IP. The check runs before any password is hashed, and a request over the limit gets `429 RATE_LIMITED`.

On Cloudflare it uses the native Rate Limiting binding, and it works in local development too:

1. Uncomment the `ratelimits` block in [`wrangler.jsonc`](./wrangler.jsonc). It declares `AUTH_RATE_LIMITER` with 20 attempts per key every 60 seconds; `period` must be 10 or 60.
2. Set `AUTH_RATE_LIMIT` to `"true"` in `wrangler.jsonc`, or in `.dev.vars` to try it locally.

Once `AUTH_RATE_LIMIT` is `true`, the server refuses to start without the binding, and it accepts only `true` or `false`, so a typo cannot leave the limiter off silently.

Know its limits:

- **Counters are per Cloudflare location**, not global, so a distributed attack is limited less than the numbers suggest.
- **Users behind one address share the IP limit**, for example an office or a mobile carrier. Raise `limit` if that locks out legitimate users.
- **Trying one password against many accounts from many addresses is not caught.** [Turnstile](#turnstile) covers that case better.

On Bun there is no built-in limiter: with `AUTH_RATE_LIMIT=true` the server refuses to start. Limit `/auth/login` and `/auth/register` in the reverse proxy in front of it instead.

On Cloudflare there is also a no-code alternative: a WAF rate limiting rule on those two paths blocks requests before the Worker runs. The available options depend on your plan.

## Development Workflow

- `bun run dev`: primary workflow. Applies local D1 migrations, runs Vue with HMR, and runs the Worker in `workerd` through the Cloudflare Vite plugin.
- `bun run dev:web`: runs only the Vue app for isolated frontend work; API and Worker-side route gates are not available.
- `bun run dev:api`: fallback for Worker debugging against the static frontend output in `dist/web-vue`. Run `bun run build:web` first and again after frontend changes.
- `bun run start`: runs the built application on Bun with `.dev.vars` and a local SQLite file in `.data/`, as it runs self-hosted. Run `bun run build:web` first.
- `bun run verify`: the full pipeline. Run it before sharing changes.

The integrated dev server uses one origin, keeps local binding state in the root `.wrangler/state`, and honors the same `run_worker_first` protected-route gate used in production. Public pages render client-side during development because their SSG files only exist after a production build; the dev-only assets fallback accounts for that difference.

## Troubleshooting

**Every request returns `500 INTERNAL_ERROR`.** The Worker validates its configuration on the first request and refuses to serve while it is invalid. The `unhandled_error` log line in the terminal names the problem; fix `.dev.vars` and restart `bun run dev`.

| Message | Fix |
| --- | --- |
| `SESSION_SECRET must contain at least 32 UTF-8 bytes` | `.dev.vars` is missing or `SESSION_SECRET` is empty. Create it as in [Running it](#running-it) |
| `ENVIRONMENT must be one of: local, production` | Set `ENVIRONMENT=local` in `.dev.vars` |
| `APP_ORIGIN and APP_HOST must identify the same origin`, or an invalid URL error | `APP_ORIGIN` must be an origin with no path or trailing slash (`http://localhost`), and its hostname must equal `APP_HOST` |
| `EMAIL_DRIVER=console prints message bodies and is only allowed when ENVIRONMENT=local` | Use `none` or `ses` outside local |
| `EMAIL_DRIVER=ses requires …` | Set the SES variables and AWS secrets listed in [Email](#email), or switch back to `none` |
| `TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together` | Set both values or leave both empty |
| `AUTH_RATE_LIMIT must be true or false` | Fix the value of `AUTH_RATE_LIMIT` |
| `AUTH_RATE_LIMIT=true requires the AUTH_RATE_LIMITER binding, …` | Uncomment the `ratelimits` block in `wrangler.jsonc`, or set `AUTH_RATE_LIMIT=false`. On Bun, rate limiting belongs in the reverse proxy |

**`400 INVALID_HOST` locally.** With `ENVIRONMENT=local` the server only answers on `localhost` and `127.0.0.1`. Open the app through one of them, not through a LAN address or another hostname.

**Reaching a Bun server through its LAN address.** Use `ENVIRONMENT=production` with `APP_HOST` set to that address and `APP_ORIGIN` to the matching `http://` origin, such as `http://192.168.0.10:3000`, and set `ALLOW_INSECURE_HTTP=true`. Without that last variable the server refuses to start; read [Self-hosted with Bun and Docker](#self-hosted-with-bun-and-docker) for what plain HTTP means for passwords and sessions.

**`403 INVALID_ORIGIN`.** Every `POST`, `PUT`, `PATCH`, and `DELETE` must carry an `Origin` header equal to the app's origin. Browsers send it on their own; tools such as `curl` need `-H "Origin: http://localhost:<port>"`.

**Resetting the local database.** Local D1 data lives in `.wrangler/state` and is disposable. Stop the dev server, delete the directory, and run `bun run dev` again, which reapplies the migrations. Every local user is lost.

**Where the logs are.** The Worker's structured logs print in the terminal running `bun run dev`. Wrangler's own logs go to `.logs/wrangler.log`, and those of the integration tests to `.logs/wrangler-test.log`. Wrangler keeps its configuration in `.wrangler-config` instead of your home directory. All three directories are ignored by Git.

**Integration tests ignore `.dev.vars`.** They pin their own bindings in [`server/vitest.config.ts`](./server/vitest.config.ts), so a test failure is never caused by your local configuration, and a feature enabled in `.dev.vars` is not exercised by the suite.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `bun run init` | Turn this framework into a new project (see Quick Start) |
| `bun run dev` | Run the integrated Vue + Worker server with HMR and local D1 |
| `bun run dev:web` | Run the Vue app directly with Vite |
| `bun run dev:api` | Run the full application through Wrangler |
| `bun run start` | Run the built application on Bun with `.dev.vars` and a local SQLite file (run `bun run build:web` first) |
| `bun run build` | Build the frontend (with guards), bundle the Bun server, and dry-run the Worker bundle |
| `bun run build:web` | Build the frontend into `dist/web-vue` and run `check-client-build` |
| `bun run build:server` | Bundle the Bun server into `dist/server/bun.js` |
| `bun run typecheck` | Typecheck web-vue, server, and contracts |
| `bun run lint` | Run oxlint and knip (dead code, unused dependencies) |
| `bun run test` | Run colocated unit tests with bun:test |
| `bun run test:integration` | Run integration tests in workerd with migrated D1 |
| `bun run test:all` | Unit plus integration tests |
| `bun run test:boot` | Boot the bundled Bun server against the build and check it serves and gates pages |
| `bun run types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `bun run worker:check` | Dry-run the Worker deployment |
| `bun run worker:startup` | Profile Worker startup time |
| `bun run db:migrate:local` | Apply D1 migrations locally |
| `bun run db:migrate:remote` | Apply D1 migrations remotely |
| `bun run verify` | Types, lint, typecheck, all tests, build, the Bun boot check, and local migrations |
| `bun run deploy` | Build and deploy the application |

## Routing Model

### The route registry

Every routing decision derives from [`server-shared/contracts/src/router/routes.ts`](./server-shared/contracts/src/router/routes.ts):

- `PUBLIC_SSG_ROUTES`: prerendered public pages. Consumed by `includedRoutes` in [`web-vue/src/main.ts`](./web-vue/src/main.ts), by the generated `sitemap.xml`, and by `check-client-build`. The asset layer serves these pages without invoking the Worker.
- `NOT_FOUND_SSG_ROUTE`: the prerendered `404` page used by Cloudflare's `not_found_handling`.
- `BACKEND_ROUTE_PREFIXES`: `/health`, `/auth`, `/api`. The Worker returns JSON 404s inside these namespaces instead of falling back to assets.
- `PROTECTED_HOME_ROUTE`: `/app`, where signed-in users land and under which every protected page lives.
- `PROTECTED_ROUTE_PREFIXES`: prefixes gated by Worker auth before the SPA shell is served. Only `/app` by default.
- `PROTECTED_SPA_SHELL_ASSET_PATH` and `PRIVATE_SPA_SHELL_PATHS`: the private shell, never served to direct browser requests.

The contract test [`routes.test.ts`](./server-shared/contracts/src/router/routes.test.ts) keeps the groups disjoint and requires `run_worker_first` in `wrangler.jsonc` to match the registry exactly: it fails when a backend or protected route lacks its patterns, and when a pattern is left over after its route was removed.

### Adding a public route

1. Create the page component under [`web-vue/src/public-pages`](./web-vue/src/public-pages) and call `usePublicHead` with its title and description.
2. Register the Vue route in [`web-vue/src/router/routes-public.ts`](./web-vue/src/router/routes-public.ts).
3. Add the path to `PUBLIC_SSG_ROUTES` in the route registry. SSG generation, the Worker handler, and the build guard all pick it up from there.
4. If the route should appear in the public header, add the link in [`SiteHeader.vue`](./web-vue/src/public-pages/components/SiteHeader.vue).

### Adding a protected route

1. Create the page component under `web-vue/src/app/pages`.
2. Add it as a child of `/app` in [`web-vue/src/router/routes-spa.ts`](./web-vue/src/router/routes-spa.ts). The `/app` prefix and the `/app/*` pattern in `wrangler.jsonc` already gate it, so neither the route registry nor `wrangler.jsonc` changes.
3. If the route should appear in the authenticated navigation, add the link in [`SpaLayout.vue`](./web-vue/src/app/layouts/SpaLayout.vue).

A protected area outside `/app`, such as `/admin`, needs its prefix in `PROTECTED_ROUTE_PREFIXES` and its exact and wildcard patterns in `assets.run_worker_first`. `bun run test` fails when either pattern is missing.

## API Surface

Auth routes live under `/auth/*`, versioned API routes under `/api/v1/*` (everything inside requires authentication by default), and health checks at `/health`.

- `GET /health` — liveness; answers without touching the database
- `GET /health/ready` — readiness; `503 NOT_READY` until the migrations are applied
- `GET /auth/config` — public auth configuration (Turnstile site key, or `null`)
- `POST /auth/register` — creates the user, sets the session cookie, returns the user DTO; `429 RATE_LIMITED` when [rate limiting](#rate-limiting) is on and the limit is reached
- `POST /auth/login` — sets the session cookie; `429 RATE_LIMITED` as above
- `POST /auth/logout` — revokes every session of the user and clears the cookie
- `GET /api/v1/me` — current user DTO
- `PUT /api/v1/me` — updates the profile name; `409 CONFLICT` when another request changed the account first
- `PUT /api/v1/me/password` — changes the password, revokes other sessions, reissues the current one; `409 CONFLICT` when another password change won the race

Errors always follow the shared contract, and the `requestId` also appears in the structured server log for correlation:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "requestId": "0198…", "details": { "email": ["invalid_format"] } } }
```

Request payloads are validated with the Zod schemas exported from `@hvbc/contracts/auth`, so frontend and backend cannot drift.

## Database

- Tables use numeric `INTEGER PRIMARY KEY` ids internally and a unique UUID v7 `uuid` column as the public identifier. Numeric ids never cross the API boundary.
- All D1 access uses prepared statements with `.bind()`.
- Migrations live in [`server/migrations`](./server/migrations) and are treated as applied: schema changes get a new additive migration.
- Integration tests apply the real migrations to an in-memory D1 before every run, so schema drift fails fast.

## Testing and Verification

- Unit tests use `bun:test` and live next to the module as `*.test.ts` (worker, contracts, and web).
- Integration tests live in [`server/test`](./server/test) and run through `@cloudflare/vitest-pool-workers`: real workerd runtime, real Hono app, real D1 with migrations applied. They pin every optional feature off in their own bindings, so the suite ignores whatever sits in your local `.dev.vars` and stays reproducible.
- The route contract test validates `wrangler.jsonc` against the route registry, and `check-client-build` guards the frontend build output.
- The Bun target is covered by unit tests of its adapters and by `bun run test:boot`, which starts the bundled server against the real build and an empty database, then checks health, static pages, the private shell gate, and a registration.

Before sharing changes, run:

```bash
bun run verify
```

[`.github/workflows/verify.yml`](./.github/workflows/verify.yml) runs the same command on every push to `main` and on every pull request. It deliberately does not create a `.dev.vars`, which keeps the pipeline honest: the repository must verify from a clean checkout, exactly as a new contributor experiences it. [`.github/workflows/audit.yml`](./.github/workflows/audit.yml) runs `bun audit` on every pull request and once a week, and Dependabot keeps dependencies current; [`CONTRIBUTING.md`](./CONTRIBUTING.md#dependencies) describes the policy.

## Deployment

### Cloudflare Workers

1. Authenticate Wrangler and create the D1 database.

```bash
bunx wrangler login
```

```bash
bunx wrangler d1 create hvbc
```

2. Update [`wrangler.jsonc`](./wrangler.jsonc) with the returned `database_id`, and set `APP_HOST` and `APP_ORIGIN` to your production domain.

3. Set the session secret, plus the secrets of any optional feature you enabled (`TURNSTILE_SECRET_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

```bash
bunx wrangler secret put SESSION_SECRET
```

4. Apply remote migrations and deploy.

```bash
bun run db:migrate:remote
```

```bash
bun run deploy
```

Keep the framework's placeholder values in version control if you are publishing this repository as a reusable template. Local-only runtime configuration belongs in `.dev.vars`; production values belong in Wrangler secrets and `wrangler.jsonc` vars.

#### Production checklist

Go through this list before the first deploy and again whenever the configuration changes:

- [ ] **Database.** `database_id` in `wrangler.jsonc` is the id of the real D1 database, not the zeroed placeholder.
- [ ] **Host and origin.** `APP_HOST` and `APP_ORIGIN` name the production domain, and the Worker is reachable at that domain through a custom domain or route. Any other hostname, including `*.workers.dev`, gets `400 INVALID_HOST` from the Worker. The build also uses `APP_ORIGIN` for canonical URLs, Open Graph tags, `robots.txt`, and `sitemap.xml`, which `bun run deploy` rebuilds.
- [ ] **Environment.** `ENVIRONMENT` is `production`, and `EMAIL_DRIVER` is not `console`.
- [ ] **Secrets.** `SESSION_SECRET` is set with `wrangler secret put`, holds at least 32 random bytes, is unique to this environment, and never appears in a committed file. The secrets of every enabled integration are set too. Rotating `SESSION_SECRET` signs every user out.
- [ ] **Migrations.** `bun run db:migrate:remote` ran before the deploy that needs them. `GET /health/ready` answers `200` once they are applied.
- [ ] **Turnstile.** Decide whether to enable it. Registration and login are open to anyone, so it is recommended.
- [ ] **Rate limiting.** It is off by default. Enable the binding or add a WAF rule as described in [Rate limiting](#rate-limiting).
- [ ] **HSTS.** Every response sends `Strict-Transport-Security` with a one-year `max-age` and `includeSubDomains`. Make sure every subdomain of the application host serves HTTPS first: browsers remember the policy for a year, so it cannot be withdrawn quickly.
- [ ] **Log sampling.** `head_sampling_rate` in `wrangler.jsonc` is `1`, so every request is logged. Lower it for high-traffic deployments, and check the retention your Cloudflare plan gives Workers Logs.
- [ ] **Authentication limits.** You have read [Authentication Limits](#authentication-limits) and accept them, or have replaced the parts your application cannot live with.

### Self-hosted with Bun and Docker

The [`Dockerfile`](./Dockerfile) builds an image with the bundled Bun server, the prerendered frontend, and the migrations. The server applies pending migrations to the SQLite database in the `/data` volume before it starts listening.

Build it with the origin the application will be served from. The origin is public and baked into canonical URLs, `robots.txt`, and `sitemap.xml`; never pass secrets as build arguments.

```bash
docker build --build-arg APP_ORIGIN=https://app.example.com -t hvbc .
```

Run it with the configuration in an environment file kept out of version control, and a named volume for the database:

```bash
docker run -d --name hvbc -p 3000:3000 -v hvbc-data:/data --env-file production.env hvbc
```

```text
ENVIRONMENT=production
APP_HOST=app.example.com
APP_ORIGIN=https://app.example.com
SESSION_SECRET=<at least 32 random bytes>
```

The variables keep the names of the `wrangler.jsonc` vars and secrets, with the same defaults and the same validation. The server refuses to start on invalid configuration, and in production when `APP_ORIGIN` differs from the origin the image was built for. These variables exist only on Bun:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `LISTEN_HOST` | `127.0.0.1`, `0.0.0.0` in the image | Address to listen on |
| `DATABASE_PATH` | `.data/app.sqlite`, `/data/app.sqlite` in the image | SQLite database file, created when missing |
| `STATIC_DIR` | `dist/web-vue` | Frontend build to serve |
| `MIGRATIONS_DIR` | `server/migrations` | Migrations applied at startup |
| `TRUSTED_PROXY_IP_HEADER` | unset | Header that carries the client IP, such as `x-real-ip`. Set it only when your proxy overwrites that header on every request; otherwise the socket address is used, and `x-forwarded-for` is never read |
| `ALLOW_INSECURE_HTTP` | unset | `true` accepts an `http://` `APP_ORIGIN` outside local development (see below) |

HTTPS is recommended but not required. What changes is the session cookie:

| `APP_ORIGIN` | Session cookie | Signing in from a browser |
| --- | --- | --- |
| `https://…` | `__Host-` prefix, `Secure` | Works. Put a TLS proxy in front (Caddy, nginx, Traefik, or Cloudflare Tunnel) that keeps the `Host` header |
| `http://localhost` with `ENVIRONMENT=local` | `__Host-` prefix, `Secure` | Works in Chrome and Firefox, which treat `localhost` as secure |
| Any other `http://…`, such as a LAN address | No prefix, no `Secure`, no HSTS; requires `ALLOW_INSECURE_HTTP=true` | Works, but passwords and the session cookie cross the network unencrypted. Use it only on a network you trust |

Operating it:

- **One container per volume.** SQLite runs on a single node; never point two containers at the same database file.
- **Keep the volume.** Without it every deploy starts with an empty database. Back it up from outside the app with SQLite's online backup (`VACUUM INTO` or `.backup`).
- **Health checks.** The image checks `GET /health` (liveness) with `Host: $APP_HOST`, because host validation rejects any other host. Use `GET /health/ready` for readiness: it answers `503 NOT_READY` until the migrations are applied.
- **Logs.** One JSON object per line: `info` events on stdout, `warn` and `error` on stderr.
- **Compression and caching** belong to the proxy. The server sends `Cache-Control: no-cache` for pages and an immutable policy for the fingerprinted files under `/assets/`.
- **Rate limiting** has no built-in implementation on Bun, so `AUTH_RATE_LIMIT=true` stops the server from starting. Limit `/auth/login` and `/auth/register` in the proxy.

Without Docker, run `bun run build` and then `bun dist/server/bun.js` with the same variables. `bun run start` does the same from source with `.dev.vars`, for a production-like local run.

## Running Outside Cloudflare

HVBC runs on Cloudflare Workers or self-hosted on Bun with the same code. [`server/src/app.ts`](./server/src/app.ts) holds the application, and each entry point supplies what its runtime provides: D1 or SQLite (`bun:sqlite`), the asset layer or a static adapter over `dist/web-vue`, and the client IP. The SQL is plain SQLite, so the migrations and the race-detection queries (`RETURNING`, `ON CONFLICT`) run unchanged on both. Moving to Postgres or MySQL is a larger job, because those queries would have to be rewritten.

What changes on Bun:

- **Public pages stop being free.** On Cloudflare, prerendered pages are served by the asset layer without invoking your code. On Bun every request reaches the process; a proxy or CDN in front recovers most of that.
- **Static files are served more simply.** There is no automatic compression, no `ETag`, and no redirect from `/pricing.html` to `/pricing`. Security headers come from the server middleware instead of `_headers`.
- **One SQLite file means one node.** Horizontal scaling requires another database. Backups, volume persistence, and deploys become your responsibility.
- **Development stays on workerd.** `bun run dev` runs the Worker runtime locally and offline, with no Cloudflare account; `bun run start` runs the built application on Bun.

In exchange you lose the edge constraints: no per-request CPU limit (so a heavier password hash such as Argon2id becomes viable), no subrequest ceiling, and long-lived connections without Durable Objects. Turnstile and SES work on both runtimes.

## Contributing

HVBC is a framework you copy into a new project, not a package you install or a finished product. Expect to clone it, adapt the modules, and replace the default authentication, pages, and data model with project-specific behavior.

Issues and pull requests are welcome. [`CONTRIBUTING.md`](./CONTRIBUTING.md) covers what to run before opening one and which conventions have to stay stable. Security problems go to [`SECURITY.md`](./SECURITY.md), privately, never to a public issue.

## License

This repository is licensed under the MIT License. See [LICENSE](./LICENSE) for the full text.
