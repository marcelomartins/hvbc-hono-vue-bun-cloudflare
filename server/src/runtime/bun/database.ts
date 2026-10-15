import { Database as SQLiteDatabase } from "bun:sqlite";

import type { BindValue, Database, PreparedStatement } from "../types";

export function openSQLite(path: string): SQLiteDatabase {
  const sqlite = new SQLiteDatabase(path, { create: true, strict: true });
  // D1 enforces foreign keys; WAL with NORMAL sync is durable across process crashes.
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA busy_timeout = 5000");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA synchronous = NORMAL");
  return sqlite;
}

function checkedValues(values: unknown[]): BindValue[] {
  for (const value of values) {
    // D1 rejects undefined as well, so a missing value fails on both runtimes.
    if (value !== null && typeof value !== "string" && typeof value !== "number") {
      throw new TypeError(`Unsupported bind value type: ${typeof value}`);
    }
  }
  return values as BindValue[];
}

function statement(sqlite: SQLiteDatabase, sql: string, values: BindValue[]): PreparedStatement {
  return {
    bind: (...next: BindValue[]) => statement(sqlite, sql, checkedValues(next)),
    first: async <T>() => (sqlite.query(sql).get(...values) as T | null | undefined) ?? null,
    run: async () => sqlite.query(sql).run(...values)
  };
}

/** Exposes bun:sqlite with the D1 behavior the repositories rely on. */
export function sqliteDatabase(sqlite: SQLiteDatabase): Database {
  return { prepare: (sql) => statement(sqlite, sql, []) };
}
