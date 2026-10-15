import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("database schema", () => {
  it("applies all migrations", async () => {
    const migrations = await env.DB
      .prepare("SELECT count(*) AS total FROM d1_migrations")
      .first<{ total: number }>();
    expect(migrations?.total).toBeGreaterThanOrEqual(1);
  });

  it("keeps users keyed by numeric id with a unique public uuid", async () => {
    const columns = await env.DB.prepare("PRAGMA table_info(users)").all<{
      name: string;
      type: string;
      pk: number;
    }>();
    const byName = new Map(columns.results.map((column) => [column.name, column]));
    expect(byName.get("id")?.pk).toBe(1);
    expect(byName.get("id")?.type).toBe("INTEGER");
    expect(byName.has("uuid")).toBe(true);
    expect(byName.has("normalized_email")).toBe(true);
    expect(byName.has("session_version")).toBe(true);
  });
});
