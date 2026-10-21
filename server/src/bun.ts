import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { createApp } from "./app";
import { assertRuntimeConfiguration, type RuntimeEnv } from "./config";
import { structuredLog, useJsonLogLines } from "./observability/log";
import { staticAssets } from "./runtime/bun/assets";
import { clientIp } from "./runtime/bun/client-ip";
import { openSQLite, sqliteDatabase } from "./runtime/bun/database";
import { assertBuildOrigin, readBunEnvironment } from "./runtime/bun/env";
import { applyMigrations } from "./runtime/bun/migrations";

useJsonLogLines();

// Invalid configuration stops the process before it listens, so a container
// restarts visibly instead of answering 500 to every request.
async function start(): Promise<void> {
  const { variables, options } = readBunEnvironment(process.env);
  assertRuntimeConfiguration(variables);
  await assertBuildOrigin(variables, options.staticDir);

  await mkdir(dirname(options.databasePath), { recursive: true });
  const sqlite = openSQLite(options.databasePath);
  await applyMigrations(sqlite, options.migrationsDir);
  const env: RuntimeEnv = {
    ...variables,
    DB: sqliteDatabase(sqlite),
    ASSETS: await staticAssets(options.staticDir)
  };

  const app = createApp({
    clientIp: (request) => clientIp(request, server, options.trustedProxyIpHeader)
  });
  const server = Bun.serve({
    port: options.port,
    hostname: options.listenHost,
    // Hono answers every error itself; never fall back to Bun's development error page.
    development: false,
    fetch: (request) => app.fetch(request, env)
  });
  structuredLog("info", { event: "server_started", host: options.listenHost, port: server.port ?? null });

  const shutdown = async (): Promise<void> => {
    await server.stop();
    sqlite.close();
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

try {
  await start();
} catch (error) {
  structuredLog("error", { event: "boot_failed", message: error instanceof Error ? error.message : "unknown error" });
  process.exit(1);
}
