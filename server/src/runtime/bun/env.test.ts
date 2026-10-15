import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertBuildOrigin, readBunEnvironment } from "./env";

const REQUIRED = {
  ENVIRONMENT: "production",
  APP_HOST: "app.example",
  APP_ORIGIN: "https://app.example",
  SESSION_SECRET: "test-session-secret-that-is-at-least-32-bytes"
};

describe("Bun environment", () => {
  test("requires the core variables without echoing values", () => {
    for (const name of Object.keys(REQUIRED)) {
      expect(() => readBunEnvironment({ ...REQUIRED, [name]: "" })).toThrow(`${name} is required`);
    }
  });

  test("applies the wrangler.jsonc defaults and leaves secrets unset", () => {
    const { variables, options } = readBunEnvironment(REQUIRED);
    expect(variables).toEqual({ ...REQUIRED, EMAIL_DRIVER: "none", SES_REGION: "", SES_FROM: "", TURNSTILE_SITE_KEY: "" });
    expect(options).toEqual({
      port: 3000,
      listenHost: "127.0.0.1",
      databasePath: ".data/app.sqlite",
      staticDir: "dist/web-vue",
      migrationsDir: "server/migrations",
      trustedProxyIpHeader: null
    });
  });

  test("rejects an invalid port", () => {
    expect(() => readBunEnvironment({ ...REQUIRED, PORT: "http" })).toThrow("PORT");
    expect(() => readBunEnvironment({ ...REQUIRED, PORT: "70000" })).toThrow("PORT");
  });
});

describe("build origin", () => {
  let root: string;
  let staticDir: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "hvbc-build-"));
    staticDir = join(root, "web-vue");
    await mkdir(staticDir);
    await Bun.write(join(root, "build-info.json"), JSON.stringify({ appOrigin: "https://app.example" }));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("accepts the origin the frontend was built for", async () => {
    const { variables } = readBunEnvironment(REQUIRED);
    await assertBuildOrigin(variables, staticDir);
  });

  test("refuses another origin in production and ignores it locally", async () => {
    const { variables } = readBunEnvironment({ ...REQUIRED, APP_HOST: "other.example", APP_ORIGIN: "https://other.example" });
    await expect(assertBuildOrigin(variables, staticDir)).rejects.toThrow("APP_ORIGIN differs");
    await assertBuildOrigin({ ...variables, ENVIRONMENT: "local" }, staticDir);
  });

  test("refuses a production start without build information", async () => {
    const { variables } = readBunEnvironment(REQUIRED);
    await expect(assertBuildOrigin(variables, join(root, "missing", "web-vue"))).rejects.toThrow("APP_ORIGIN differs");
  });
});
