import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "./index";

describe("test database", () => {
  it("answers and has the tables from the migrations", async () => {
    const rows = await getDb().execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const tables = rows.map((row) => row.table_name);

    expect(tables).toEqual(
      expect.arrayContaining(["contacts", "notes", "groups", "contact_groups"]),
    );
  });
});
