import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { resetData } from "../../test-db/reset";
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

// The birthday columns refuse impossible dates even when the server code is bypassed
// (decision 1 of openspec/changes/birthdays/design.md). Raw SQL on purpose: the tests state what the
// database itself accepts, not what the Drizzle schema lets the code write.
describe("birthday columns of contacts", () => {
  const CHECK_VIOLATION = "23514";

  beforeEach(async () => {
    await resetData();
    await getDb().execute(
      sql`insert into users (id, name, email) values ('user-a', '', 'a@example.com')`,
    );
  });

  // Postgres error code of the insert, or null when the row was accepted
  async function insertBirthday(
    day: number | null,
    month: number | null,
    year: number | null,
  ): Promise<string | null> {
    try {
      await getDb().execute(
        sql`insert into contacts (owner_id, name, birthday_day, birthday_month, birthday_year)
            values ('user-a', 'Test', ${day}, ${month}, ${year})`,
      );
      return null;
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      return (cause as { code?: string } | undefined)?.code ?? "unknown";
    }
  }

  it("accepts a contact without a birthday", async () => {
    expect(await insertBirthday(null, null, null)).toBeNull();
  });

  it("accepts a day and a month without a year", async () => {
    expect(await insertBirthday(25, 11, null)).toBeNull();
  });

  it("accepts a day, a month and a year", async () => {
    expect(await insertBirthday(25, 11, 1990)).toBeNull();
  });

  it("accepts 29 February without a year", async () => {
    expect(await insertBirthday(29, 2, null)).toBeNull();
  });

  it("accepts 29 February of a leap year", async () => {
    expect(await insertBirthday(29, 2, 2000)).toBeNull();
  });

  it("refuses a day without a month", async () => {
    expect(await insertBirthday(25, null, null)).toBe(CHECK_VIOLATION);
  });

  it("refuses a month without a day", async () => {
    expect(await insertBirthday(null, 11, null)).toBe(CHECK_VIOLATION);
  });

  it("refuses a year without a day and a month", async () => {
    expect(await insertBirthday(null, null, 1990)).toBe(CHECK_VIOLATION);
  });

  it("refuses a month outside 1-12", async () => {
    expect(await insertBirthday(1, 0, null)).toBe(CHECK_VIOLATION);
    expect(await insertBirthday(1, 13, null)).toBe(CHECK_VIOLATION);
  });

  it("refuses a day outside 1-31", async () => {
    expect(await insertBirthday(0, 1, null)).toBe(CHECK_VIOLATION);
    expect(await insertBirthday(32, 1, null)).toBe(CHECK_VIOLATION);
  });

  it("refuses 31 April", async () => {
    expect(await insertBirthday(31, 4, null)).toBe(CHECK_VIOLATION);
  });

  it("refuses 31 in every month that has 30 days", async () => {
    for (const month of [4, 6, 9, 11]) {
      expect(await insertBirthday(31, month, null)).toBe(CHECK_VIOLATION);
    }
  });

  it("accepts 31 in every month that has 31 days", async () => {
    for (const month of [1, 3, 5, 7, 8, 10, 12]) {
      expect(await insertBirthday(31, month, null)).toBeNull();
    }
  });

  it("refuses 30 February", async () => {
    expect(await insertBirthday(30, 2, null)).toBe(CHECK_VIOLATION);
  });

  it("refuses 29 February of a year that is not a leap one", async () => {
    expect(await insertBirthday(29, 2, 2001)).toBe(CHECK_VIOLATION);
    // Divisible by 100 but not by 400
    expect(await insertBirthday(29, 2, 1900)).toBe(CHECK_VIOLATION);
  });

  it("refuses a year before 1900", async () => {
    expect(await insertBirthday(1, 1, 1899)).toBe(CHECK_VIOLATION);
  });

  it("refuses a bad date when an existing contact is updated", async () => {
    await insertBirthday(25, 11, 1990);
    const attempt = getDb().execute(
      sql`update contacts set birthday_day = 31, birthday_month = 4 where name = 'Test'`,
    );
    await expect(attempt).rejects.toMatchObject({ cause: { code: CHECK_VIOLATION } });
  });
});
