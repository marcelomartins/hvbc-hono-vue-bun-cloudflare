# HVBC

**Hono + Vue to build. Bun or Cloudflare to run.**

Full-stack TypeScript architecture with a Hono API and an authenticated Vue SPA. Backend and frontend are separate in code and deployed as a single app. Runs self-hosted on Bun or on Cloudflare Workers. Created by [Marcelo Martins](https://minhainternet.com/marcelomartins).

## Why HVBC

- **One repository, one deploy.** Frontend and backend are developed separately, then ship together as a single app on one origin.
- **Fast public pages, protected app.** Public pages are prerendered for speed and SEO, while private pages run as a single-page app.
- **Authentication included.** Registration, login, logout, profile, and password change, with secure cookies and server-side validation.
- **Secure by default.** Signed sessions revocable per user, PBKDF2 password hashing, Host and Origin checks, security headers (CSP, HSTS) defined in one place, and a configuration that refuses to run when incomplete.
- **Runs on Cloudflare Workers, without lock-in.** The same code also runs on your own server with Bun, Docker image included.

Built with Bun, Hono, Vue 3 with Vue Router and vite-ssg, Zod, D1 or SQLite, Vitest on the Workers runtime, oxlint, and knip.

## Project layout

```text
web-vue/                  Vue app: prerendered public pages and the SPA under /app
server/                   Hono API, authentication, migrations, Cloudflare and Bun entry points
server-shared/contracts/  Shared by frontend and backend: route registry, API types, and validation schemas
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

## Adding pages

- **Public page:** create it in [`web-vue/src/public-pages`](./web-vue/src/public-pages), register it in [`routes-public.ts`](./web-vue/src/router/routes-public.ts), and add its path to `PUBLIC_SSG_ROUTES` in [`routes.ts`](./server-shared/contracts/src/router/routes.ts) so it is prerendered.
- **Signed-in page:** create it in [`web-vue/src/app/pages`](./web-vue/src/app/pages) and add it as a child of `/app` in [`routes-spa.ts`](./web-vue/src/router/routes-spa.ts). It is protected with no other change.

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

Put the returned `database_id` in [`wrangler.jsonc`](./wrangler.jsonc) and set `APP_HOST` and `APP_ORIGIN` to your domain. The app answers only on that domain, so attach it to the Worker as a custom domain: on `*.workers.dev`, every request gets `400 INVALID_HOST`. Then set the session secret, apply the migrations, and deploy:

```bash
bunx wrangler secret put SESSION_SECRET
```

```bash
bun run db:migrate:remote
```

```bash
bun run deploy
```

### Bun with Docker

Build the image with the public origin of the app, and run it with a volume for the database:

```bash
docker build --build-arg APP_ORIGIN=https://app.example.com -t my-app .
```

```bash
docker run -d -p 3000:3000 -v my-app-data:/data --env-file production.env my-app
```

`production.env` stays out of version control:

```text
ENVIRONMENT=production
APP_HOST=app.example.com
APP_ORIGIN=https://app.example.com
SESSION_SECRET=<at least 32 random bytes>
```

Put a reverse proxy that terminates HTTPS in front of the container. Without Docker, run `bun run build` and then `bun dist/server/bun.js` with the same variables.

## Before going live

The included authentication is a secure baseline, not a complete account system. It has no password recovery, no email verification, and no multi-factor authentication, and anyone can register. Login and registration have no rate limit by default: enable Cloudflare Turnstile, and rate limiting on Cloudflare or in your proxy on Bun.

Email delivery through Amazon SES, Turnstile, and rate limiting are optional and off by default; the comments in [`wrangler.jsonc`](./wrangler.jsonc) and [`.dev.vars.example`](./.dev.vars.example) show how to turn them on. Once enabled, a misconfigured one stops the server instead of running without it.

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first, and report security problems privately as described in [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE).
