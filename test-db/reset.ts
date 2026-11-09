// Empties the data tables of the common test database, so every database test starts from nothing.
// Cascade empties what hangs on them: notes, links to groups, sessions, accounts.

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

export async function resetData() {
  await getDb().execute(
    sql`truncate table contacts, groups, users, login_links, verifications cascade`,
  );
}
