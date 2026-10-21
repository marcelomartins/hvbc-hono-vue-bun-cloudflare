import { describe, expect, test } from "bun:test";

import type { BindValue } from "../types";
import { openSQLite, sqliteDatabase } from "./database";

function freshDatabase() {
  const sqlite = openSQLite(":memory:");
  sqlite.run(
    "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, version INTEGER NOT NULL DEFAULT 1)"
  );
  return sqliteDatabase(sqlite);
}

describe("SQLite adapter", () => {
  test("returns null instead of undefined when no row matches", async () => {
    const database = freshDatabase();
    expect(await database.prepare("SELECT * FROM items WHERE name = ?").bind("missing").first()).toBeNull();
  });

  test("returns no row from ON CONFLICT DO NOTHING RETURNING on a conflict", async () => {
    const database = freshDatabase();
    const insert = "INSERT INTO items (name) VALUES (?) ON CONFLICT (name) DO NOTHING RETURNING id, name";
    expect(await database.prepare(insert).bind("a").first()).toEqual({ id: 1, name: "a" });
    expect(await database.prepare(insert).bind("a").first()).toBeNull();
  });

  test("returns no row from UPDATE RETURNING when its condition fails", async () => {
    const database = freshDatabase();
    await database.prepare("INSERT INTO items (name) VALUES (?)").bind("a").run();
    const update = "UPDATE items SET version = version + 1 WHERE name = ? AND version = ? RETURNING version";
    expect(await database.prepare(update).bind("a", 1).first()).toEqual({ version: 2 });
    expect(await database.prepare(update).bind("a", 1).first()).toBeNull();
  });

  test("rejects values D1 would reject", () => {
    const database = freshDatabase();
    const query = database.prepare("SELECT * FROM items WHERE name = ?");
    expect(() => query.bind(undefined as unknown as BindValue)).toThrow(TypeError);
    expect(() => query.bind(true as unknown as BindValue)).toThrow(TypeError);
  });

  test("enforces foreign keys like D1", async () => {
    const database = freshDatabase();
    await database.prepare("CREATE TABLE tags (item_id INTEGER NOT NULL REFERENCES items (id))").run();
    await expect(database.prepare("INSERT INTO tags (item_id) VALUES (?)").bind(42).run()).rejects.toThrow();
  });
});
