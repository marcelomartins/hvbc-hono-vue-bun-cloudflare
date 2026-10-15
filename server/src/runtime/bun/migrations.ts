import type { Database as SQLiteDatabase } from "bun:sqlite";
import { join } from "node:path";

import { structuredLog } from "../../observability/log";

// Same table and columns as `wrangler d1 migrations apply`, so /health/ready and
// the schema tests read one bookkeeping table on both runtimes. Renaming it would
// make Wrangler re-apply every migration on existing D1 databases.
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS d1_migrations(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;

/** Applies pending migrations in file-name order, each in its own transaction. */
export async function applyMigrations(sqlite: SQLiteDatabase, directory: string): Promise<string[]> {
  sqlite.run(MIGRATIONS_TABLE);
  const applied = new Set(
    sqlite.query<{ name: string }, []>("SELECT name FROM d1_migrations").all().map((row) => row.name)
  );
  const pending = [...new Bun.Glob("*.sql").scanSync({ cwd: directory, onlyFiles: true })]
    .filter((name) => !applied.has(name))
    .toSorted();

  for (const name of pending) {
    const sql = await Bun.file(join(directory, name)).text();
    sqlite.transaction(() => {
      sqlite.run(sql);
      sqlite.query("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
    })();
    structuredLog("info", { event: "migration_applied", name });
  }
  return pending;
}
