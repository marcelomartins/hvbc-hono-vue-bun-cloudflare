# SETUP

How to turn this framework into a new project. Written for an AI agent to follow, and readable by a person who wants to do it by hand.

This file applies only while `scripts/init.ts` exists. Both are deleted at the end.

## How to run this

Assume the person you are helping has never used Cloudflare, Workers, or D1.

- Ask one question at a time and wait for the answer.
- Use plain language, and explain a term the first time it appears.
- Never answer on their behalf. If they say they do not know, choose the documented default, tell them what you chose, and tell them how to change it later.
- Show what a command does before running it. Stop for confirmation before anything that touches their Cloudflare account, costs money, or cannot be undone.
- `AGENTS.md` applies here too. In particular: never deploy, set production secrets, or use remote D1 on your own initiative.

## 1. Interview

**1. What are you building?** One sentence is enough. From the answer, propose:

- `--title`: the product name as a person would write it, for example `Task Tracker`.
- `--name`: the same name in lowercase with dashes, for example `task-tracker`. It becomes the package names, the Worker name, and the D1 database name.

Show both and ask them to confirm or correct.

**2. Do you already have a domain for it?**

- Yes: `--host` is that hostname, with no `https://` and no path, for example `app.example.com`.
- No, or unsure: use the default `<name>.invalid`. Explain that it is a deliberately unusable placeholder, that local development does not need a real domain, and that it is changed in `wrangler.jsonc` once they have one.

**3. Do you have a Cloudflare account?**

- No, or unsure: tell them plainly that they do not need one to start. Everything runs offline on their machine, and the account is only needed to publish. Skip step 3 entirely.
- Yes: you will do step 3 together.

**4. What language should the interface be in?** The framework ships in English. If they want another one, note it now and handle it in step 5.

## 2. Rename the project

Always preview first:

```bash
bun run init --name <name> --title "<Title>" --host <host> --dry-run
```

Show them the summary, then run the same command without `--dry-run`.

This rewrites the package names, the Worker name, the D1 database name, the session cookie, the package scope, and the product name in code, and creates `.dev.vars` with a freshly generated `SESSION_SECRET`. It does **not** rewrite Markdown files; step 5 covers those.

## 3. Cloudflare (skip when they have no account)

Ask them to run the login themselves. It opens a browser and the authorization is theirs to give:

```bash
bunx wrangler login
```

Then create the database:

```bash
bunx wrangler d1 create <name>
```

Copy the `database_id` from the output into `wrangler.jsonc`, replacing the zeroed placeholder. Re-running step 2 with `--create-d1` does both in one pass instead.

Stop there. Do not deploy, do not set production secrets, and do not run migrations with `--remote`. Deployment is documented in the README and is a separate decision the person makes explicitly.

## 4. Install and check

```bash
bun install
```

```bash
bun run verify
```

`verify` has to pass before going further. If it fails, read the failure and fix the cause. Never skip the step or weaken a check to get past it.

Then start the app and have them register the first user at `/register`:

```bash
bun run dev
```

## 5. Make the docs describe their project

`bun run init` does not touch Markdown, so do it here.

- `README.md`: replace the title, the opening description, and the attribution line so they describe their project instead of the framework. Drop the parts that only exist to explain the framework itself: the "Starting a new project from this framework" subsection, "Running Outside Cloudflare" unless they care about leaving Cloudflare, and "Contributing" unless the project takes contributions. Keep everything that describes how their application works: architecture, repository layout, routing, API surface, database, testing, scripts, and deployment.
- `AGENTS.md`: nothing to change. It holds generic rules that stay valid.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `.github/ISSUE_TEMPLATE/`: these describe contributing to the framework and name its maintainer. Delete them unless the project takes outside contributions; if it does, rewrite the contact details and the project-specific parts.
- If they asked for a non-English interface in question 4, translate the visible strings in `web-vue/src/**/*.vue`, the message map in `web-vue/src/i18n/messages.ts`, and the welcome email in `server/src/email/messages.ts`, then set the matching `lang` in `web-vue/index.html`, `web-vue/index-spa.html`, and `web-vue/src/App.vue`. Code, tests, and logs stay in English.

## 6. Clean up

Delete the `scripts/` directory and this file. Deleting only `scripts/init.ts` leaves `scripts/tsconfig.json` without inputs and breaks `bun run typecheck`, so also:

- in `package.json`, remove the `init` script and the `tsc --noEmit -p scripts/tsconfig.json && ` prefix of `typecheck`;
- in `README.md`, remove the `bun run init` row of the scripts table;
- in `AGENTS.md`, remove the setup bullet that points here and the invariant about `scripts/init.ts`.

If the repository was created from the template, clear the leftover issue and pull request templates you decided not to keep. Then run `bun run verify` one last time.

Finish by telling them what they now have: a working local application with registration, login, an account page, and a protected area. Point them at the README for adding a public route, adding a protected route, and deploying when they are ready.
