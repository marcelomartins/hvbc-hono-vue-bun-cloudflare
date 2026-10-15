import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { beforeAll, inject } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject("d1Migrations"));
});
