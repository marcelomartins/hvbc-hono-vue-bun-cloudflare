import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Boots the bundled Bun server against the real frontend build and an empty
// database, as the Docker image runs it. Run from the repository root after `build`.
const dataDirectory = await mkdtemp(join(tmpdir(), "hvbc-boot-"));

// Every variable the server reads is pinned, so nothing from the shell or a local
// .env file changes what this check exercises.
const server = Bun.spawn([process.execPath, "dist/server/bun.js"], {
  env: {
    ...process.env,
    ENVIRONMENT: "local",
    APP_HOST: "localhost",
    APP_ORIGIN: "http://localhost",
    ALLOW_INSECURE_HTTP: "",
    SESSION_SECRET: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    EMAIL_DRIVER: "none",
    SES_REGION: "",
    SES_FROM: "",
    AWS_ACCESS_KEY_ID: "",
    AWS_SECRET_ACCESS_KEY: "",
    TURNSTILE_SITE_KEY: "",
    TURNSTILE_SECRET_KEY: "",
    AUTH_RATE_LIMIT: "",
    PORT: "0",
    LISTEN_HOST: "127.0.0.1",
    DATABASE_PATH: join(dataDirectory, "app.sqlite"),
    STATIC_DIR: "dist/web-vue",
    MIGRATIONS_DIR: "server/migrations",
    TRUSTED_PROXY_IP_HEADER: ""
  },
  stdout: "pipe",
  // Expected 404s log warnings; they are only worth printing when the check fails.
  stderr: "pipe"
});

// Every stdout line must be a JSON log event; the startup event carries the port.
// Reading continues afterwards so the request logs never fill the pipe.
const listening = new Promise<number>((resolve, reject) => {
  void (async () => {
    const decoder = new TextDecoder();
    let buffered = "";
    for await (const chunk of server.stdout) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines.filter((candidate) => candidate.trim() !== "")) {
        const event = JSON.parse(line) as { event?: unknown; port?: unknown };
        if (event.event === "server_started" && typeof event.port === "number") resolve(event.port);
      }
    }
    reject(new Error("the server exited before it started listening"));
  })().catch(reject);
});

async function expectResponse(
  base: string,
  path: string,
  status: number,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${base}${path}`, { redirect: "manual", ...init });
  if (response.status !== status) {
    throw new Error(`${init.method ?? "GET"} ${path}: expected ${status}, received ${response.status}`);
  }
  return response;
}

let passed = false;
try {
  const port = await Promise.race([
    listening,
    Bun.sleep(20_000).then(() => Promise.reject(new Error("the server did not start within 20 seconds")))
  ]);
  const base = `http://localhost:${port}`;

  await expectResponse(base, "/health", 200);
  await expectResponse(base, "/health/ready", 200);
  await expectResponse(base, "/", 200);
  await expectResponse(base, "/pricing", 200);
  await expectResponse(base, "/no-such-page", 404);
  for (const path of ["/index-spa", "/index-spa.html", "/INDEX-SPA.html", "/index-spa%2Ehtml"]) {
    await expectResponse(base, path, 404);
  }
  await expectResponse(base, "/dashboard", 302);

  const registered = await expectResponse(base, "/auth/register", 201, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ name: "Boot Check", email: "boot@example.com", password: "correct horse battery staple" })
  });
  const cookie = registered.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  const shell = await expectResponse(base, "/dashboard", 200, { headers: { cookie } });
  if (!(await shell.text()).includes("<div id=\"app\">")) throw new Error("/dashboard did not serve the SPA shell");

  passed = true;
  console.info("The Bun server boots, migrates, serves the build, and gates the private shell.");
} finally {
  server.kill();
  await server.exited;
  if (!passed) console.error(await new Response(server.stderr).text());
  await rm(dataDirectory, { recursive: true, force: true });
}
