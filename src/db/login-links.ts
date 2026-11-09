import "server-only";

import { createHash } from "node:crypto";

import { and, count, eq, gt, lt, sql } from "drizzle-orm";

import { getDb } from "./index";
import { loginLinks } from "./schema";

// At most this many login emails to one address in the window below
export const MAX_LINKS_PER_WINDOW = 3;
const WINDOW = sql`interval '10 minutes'`;
const KEEP = sql`interval '1 day'`;

// The hash of the link token: the table never holds the token itself
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type RecordResult = { ok: true; id: number } | { ok: false };

// Records that a login email to this address is about to be sent, unless it is the fourth in 10
// minutes. The email must be normalized (see parseLoginEmail). The lock on the address makes
// simultaneous requests go one after another, so they cannot all pass the check.
// Also removes the records older than a day, so the table does not grow.
export async function recordLoginLink(email: string, token: string): Promise<RecordResult> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    await tx.delete(loginLinks).where(lt(loginLinks.createdAt, sql`now() - ${KEEP}`));

    const [{ recent }] = await tx
      .select({ recent: count() })
      .from(loginLinks)
      .where(and(eq(loginLinks.email, email), gt(loginLinks.createdAt, sql`now() - ${WINDOW}`)));
    if (recent >= MAX_LINKS_PER_WINDOW) return { ok: false };

    const [row] = await tx
      .insert(loginLinks)
      .values({ email, tokenHash: hashToken(token) })
      .returning({ id: loginLinks.id });
    return { ok: true, id: row.id };
  });
}

// The email was not sent: it does not count towards the limit and does not cancel older links
export async function forgetLoginLink(id: number) {
  await getDb().delete(loginLinks).where(eq(loginLinks.id, id));
}

// Is this the newest link sent to its address? A link we have no record of is not.
// Whether the link is still valid in time or was already used is decided by Better Auth.
export async function isLatestLoginLink(token: string) {
  const [row] = await getDb()
    .select({ id: loginLinks.id, email: loginLinks.email })
    .from(loginLinks)
    .where(eq(loginLinks.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return false;

  const [{ later }] = await getDb()
    .select({ later: count() })
    .from(loginLinks)
    .where(and(eq(loginLinks.email, row.email), gt(loginLinks.id, row.id)));
  return later === 0;
}
