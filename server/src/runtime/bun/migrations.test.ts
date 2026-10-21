import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openSQLite } from "./database";
import { applyMigrations } from "./migrations";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "hvbc-migrations-"));
  spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(async () => {
  spyOn(console, "info").mockRestore();
  await rm(directory, { recursive: true, force: true });
});

describe("migration runner", () => {
  test("applies files in name order, once", async () => {
    await Bun.write(join(directory, "0002_add_index.sql"), "CREATE INDEX items_name ON items (name);");
    await Bun.write(
      join(directory, "0001_init.sql"),
      "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO items (name) VALUES ('seed');"
    );
    const sqlite = openSQLite(":memory:");

    expect(await applyMigrations(sqlite, directory)).toEqual(["0001_init.sql", "0002_add_index.sql"]);
    expect(await applyMigrations(sqlite, directory)).toEqual([]);
    expect(sqlite.query("SELECT count(*) AS total FROM items").get()).toEqual({ total: 1 });
    expect(sqlite.query("SELECT name FROM d1_migrations ORDER BY id").all()).toEqual([
      { name: "0001_init.sql" },
      { name: "0002_add_index.sql" }
    ]);
  });

  test("rolls back a failing migration and stops", async () => {
    await Bun.write(join(directory, "0001_init.sql"), "CREATE TABLE items (id INTEGER PRIMARY KEY);");
    await Bun.write(join(directory, "0002_broken.sql"), "CREATE TABLE half (id INTEGER);\nNOT VALID SQL;");
    const sqlite = openSQLite(":memory:");

    await expect(applyMigrations(sqlite, directory)).rejects.toThrow();
    expect(sqlite.query("SELECT name FROM d1_migrations").all()).toEqual([{ name: "0001_init.sql" }]);
    expect(sqlite.query("SELECT name FROM sqlite_master WHERE name = 'half'").get()).toBeNull();
  });

  test("keeps Wrangler's bookkeeping columns", async () => {
    const sqlite = openSQLite(":memory:");
    await applyMigrations(sqlite, directory);
    const columns = sqlite.query<{ name: string }, []>("PRAGMA table_info(d1_migrations)").all();
    expect(columns.map((column) => column.name)).toEqual(["id", "name", "applied_at"]);
  });
});
