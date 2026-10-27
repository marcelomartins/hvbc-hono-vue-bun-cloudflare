# HVBC

**Hono + Vue to build. Bun or Cloudflare to run.**

Full-stack TypeScript architecture with a Hono API and an authenticated Vue SPA. Backend and frontend are separate in code and deployed as a single app. Runs self-hosted on Bun or on Cloudflare Workers. Created by [Marcelo Martins](https://minhainternet.com/marcelomartins).

## Start with an AI agent

Any AI coding agent can take you from a short prompt to a live app in about 30 minutes:

```text
Create a new app in this folder using the framework
https://github.com/marcelomartins/hvbc-hono-vue-bun-cloudflare.

It's a task list where each user signs in and manages their own tasks.
```

## Why HVBC

- **One repository, one deploy.** Frontend and backend are developed separately, then ship together as a single app on one origin.
- **Fast public pages, protected app.** Public pages are prerendered for speed and SEO, while private pages run as a single-page app.
- **Vue by default, but you can change it.** The server only uses the pages the frontend build outputs, so any framework that outputs the same pages works.
- **Authentication included.** Registration, login, logout, profile, and password change, with secure cookies and server-side validation.
- **Secure by default.** Signed sessions revocable per user, PBKDF2 password hashing, Host and Origin checks, security headers (CSP, HSTS) defined in one place, and a configuration that refuses to run when incomplete.
- **Runs on Cloudflare Workers, without lock-in.** The same code also runs on your own server with Bun and SQLite.

Built with Bun, Hono, Vue 3 with Vue Router and vite-ssg, Zod, D1 or SQLite, Vitest on the Workers runtime, oxlint, and knip.

## Project layout

```text
web-vue/                  Vue app: prerendered public pages and the SPA under /app
server/                   Hono API, authentication, migrations, Cloudflare and Bun entry points
server-shared/contracts/  Owned by the server: route registry and API types used by both sides, and the Zod schemas the server validates with
```

## Getting started

Requirements: [Bun](https://bun.sh/) and [Node.js](https://nodejs.org/) 22.12 or newer. No Cloudflare account is needed to run it locally.

```bash
bun install
```

```bash
bun run dev
```

Open the URL shown in the terminal and create the first account at `/register`. On the first run, `bun run dev` creates `.dev.vars` with a session secret generated on your machine.

### Start a new project

Clone the repository and turn it into your own project, previewing first with `--dry-run`:

```bash
bun run init --name my-app --title "My App" --host app.example.com
```

It renames the packages, the Worker, the database, the session cookie, and the product name, then removes itself and this section. Finish with `bun install` and `bun run verify`.

## Adding pages and endpoints

- **Public page:** create it in [`web-vue/src/public-pages`](./web-vue/src/public-pages), register it in [`routes-public.ts`](./web-vue/src/router/routes-public.ts), and add its path to `PUBLIC_SSG_ROUTES` in [`routes.ts`](./server-shared/contracts/src/router/routes.ts) so it is prerendered.
- **Signed-in page:** create it in [`web-vue/src/app/pages`](./web-vue/src/app/pages) and add it as a child of `/app` in [`routes-spa.ts`](./web-vue/src/router/routes-spa.ts). It is protected with no other change.
- **API endpoint:** add the request schema to [`server-shared/contracts/src/schemas`](./server-shared/contracts/src/schemas) and the response type to [`api.ts`](./server-shared/contracts/src/types/api.ts). Then write the queries in a repository with prepared statements, and mount the routes on the `/api/v1` app in [`app.ts`](./server/src/app.ts), where every route requires a session. Read request bodies with `readJson`, as [`account/routes.ts`](./server/src/account/routes.ts) does.
- **Schema change:** create a migration with `bunx wrangler d1 migrations create <database_name> <description>`, using the `database_name` from `wrangler.jsonc`, and apply it with `bun run db:migrate:local`. Never edit an applied migration. The Bun server applies pending migrations when it boots.

## Email

The framework sends no email. A project that needs to, for example for a verification link or a password reset, calls `sendEmail` from [`sender.ts`](./server/src/email/sender.ts), and `EMAIL_DRIVER` decides how the message leaves:

| `EMAIL_DRIVER` | Runtime | What it needs |
| --- | --- | --- |
| `none` (default) | Both | Nothing; messages are dropped |
| `console` | Local development | Nothing; messages are printed in the terminal |
| `cloudflare` | Workers | `EMAIL_FROM`, the `send_email` binding commented in `wrangler.jsonc`, and the sender's domain onboarded to Cloudflare Email Service, which needs the Workers Paid plan |
| `ses` | Both | `EMAIL_FROM`, `SES_REGION`, the sender's domain verified in Amazon SES, and the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets of an IAM user allowed only `ses:SendEmail` |

`EMAIL_FROM` is an address or `Name <address>`. A driver that is enabled but misconfigured stops the server instead of dropping mail. Whoever signs up chooses the address, so an email sent at sign-up can be aimed at someone else's inbox: enable Turnstile or rate limiting before adding one.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Run the app locally with hot reload, on the Workers runtime |
| `bun run start` | Build the frontend and run the app on Bun with a local SQLite database |
| `bun run build` | Build the frontend and the Bun server, and check the Worker bundle |
| `bun run test:all` | Run unit and integration tests |
| `bun run verify` | Run everything: lint, typecheck, tests, build, and boot check |
| `bun run deploy` | Build and deploy to Cloudflare Workers |

## Deploy

### Cloudflare Workers

```bash
bunx wrangler login
```

```bash
bunx wrangler d1 create my-app
```

Put the returned `database_id` in [`wrangler.jsonc`](./wrangler.jsonc) and set `APP_ORIGIN` to the origin of your domain, such as `https://app.example.com`. The app answers only on that domain, so attach it to the Worker as a custom domain: on `*.workers.dev`, every request gets `400 INVALID_HOST`. Then set the session secret, apply the migrations, and deploy:

```bash
bunx wrangler secret put SESSION_SECRET
```

```bash
bun run db:migrate:remote
```

```bash
bun run deploy
```

### Bun

Build with the public origin of the app, which the canonical URLs, `robots.txt`, and `sitemap.xml` are generated from:

```bash
APP_ORIGIN=https://app.example.com bun run build
```

Then run the bundled server from the repository root:

```bash
bun dist/server/bun.js
```

It reads its configuration from the environment. A `.env` file in the working directory works too: Bun loads it, and it stays out of version control.

```text
ENVIRONMENT=production
APP_ORIGIN=https://app.example.com
SESSION_SECRET=<at least 32 random bytes>
```

At boot the server applies pending migrations, and it refuses to start when `APP_ORIGIN` differs from the origin the frontend was built for. By default it listens on `127.0.0.1:3000` and keeps the database in `.data/app.sqlite`; `LISTEN_HOST`, `PORT`, and `DATABASE_PATH` change that. It refuses plain HTTP outside local development unless `ALLOW_INSECURE_HTTP=true`.

Put a reverse proxy that terminates HTTPS in front of it, and set `TRUSTED_PROXY_IP_HEADER` to a header the proxy overwrites with the client address on every request, such as `X-Real-IP`; without it, every request appears to come from the proxy.

## Before going live

The included authentication is a secure baseline, not a complete account system. It has no password recovery, no email verification, and no multi-factor authentication, and anyone can register. Login and registration have no rate limit by default: enable Cloudflare Turnstile, and rate limiting on Cloudflare or in your proxy on Bun.

Turnstile, rate limiting, and email delivery are optional and off by default; the comments in [`wrangler.jsonc`](./wrangler.jsonc) and [`.dev.vars.example`](./.dev.vars.example) show how to turn them on. Once enabled, a misconfigured one stops the server instead of running without it.

Responses carry HSTS for one year with `includeSubDomains`. On an apex domain, that requires every subdomain to serve HTTPS; if that is not true, change `STRICT_TRANSPORT_SECURITY` in [`security-headers.ts`](./server-shared/contracts/src/http/security-headers.ts) before the first deploy.

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first, and report security problems privately as described in [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE).
