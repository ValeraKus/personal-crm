import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "./index";
import { forgetLoginLink, hashToken, isLatestLoginLink, recordLoginLink } from "./login-links";
import { loginLinks } from "./schema";

const IVAN = "ivan@example.com";
const OLGA = "olga@example.com";

async function countRows(email: string) {
  const rows = await getDb().select().from(loginLinks).where(eq(loginLinks.email, email));
  return rows.length;
}

// Moves the sent time of all links back, as if that long had passed
async function ageLinks(interval: string) {
  await getDb().execute(
    sql`update login_links set created_at = created_at - ${interval}::interval`,
  );
}

beforeEach(async () => {
  await getDb().delete(loginLinks);
});

// Scenarios of the "Лимит писем" requirement in openspec/specs/user-auth/spec.md
describe("recordLoginLink: limit of emails", () => {
  it("lets three emails in 10 minutes and refuses the fourth", async () => {
    for (const token of ["t1", "t2", "t3"]) {
      expect((await recordLoginLink(IVAN, token)).ok).toBe(true);
    }

    expect(await recordLoginLink(IVAN, "t4")).toEqual({ ok: false });
    expect(await countRows(IVAN)).toBe(3);
  });

  it("counts every address on its own", async () => {
    for (const token of ["t1", "t2", "t3"]) await recordLoginLink(IVAN, token);

    expect((await recordLoginLink(OLGA, "o1")).ok).toBe(true);
  });

  it("lets a new email when the first of three is older than 10 minutes", async () => {
    for (const token of ["t1", "t2", "t3"]) await recordLoginLink(IVAN, token);
    await ageLinks("11 minutes");

    expect((await recordLoginLink(IVAN, "t4")).ok).toBe(true);
  });

  it("does not count an email that was not sent", async () => {
    const first = await recordLoginLink(IVAN, "t1");
    if (!first.ok) throw new Error("the first email must be recorded");
    await forgetLoginLink(first.id);

    for (const token of ["t2", "t3", "t4"]) {
      expect((await recordLoginLink(IVAN, token)).ok).toBe(true);
    }
  });

  it("lets no more than three of four requests at the same moment", async () => {
    const results = await Promise.all(
      ["t1", "t2", "t3", "t4"].map((token) => recordLoginLink(IVAN, token)),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(await countRows(IVAN)).toBe(3);
  });

  it("removes records older than a day", async () => {
    await recordLoginLink(IVAN, "old");
    await ageLinks("25 hours");

    await recordLoginLink(OLGA, "fresh");

    expect(await countRows(IVAN)).toBe(0);
    expect(await countRows(OLGA)).toBe(1);
  });

  it("stores the hash of the token, not the token", async () => {
    await recordLoginLink(IVAN, "secret-token");

    const [row] = await getDb().select().from(loginLinks);
    expect(row.tokenHash).toBe(hashToken("secret-token"));
    expect(row.tokenHash).not.toContain("secret-token");
  });
});

// Scenario "Запросил новую ссылку" of the "Ссылка для входа" requirement
describe("isLatestLoginLink", () => {
  it("is true for the only link of an address", async () => {
    await recordLoginLink(IVAN, "first");

    expect(await isLatestLoginLink("first")).toBe(true);
  });

  it("is false for the older link when a newer one was requested", async () => {
    await recordLoginLink(IVAN, "first");
    await recordLoginLink(IVAN, "second");

    expect(await isLatestLoginLink("first")).toBe(false);
    expect(await isLatestLoginLink("second")).toBe(true);
  });

  it("does not mix up addresses: a link to another address does not cancel this one", async () => {
    await recordLoginLink(IVAN, "ivan-link");
    await recordLoginLink(OLGA, "olga-link");

    expect(await isLatestLoginLink("ivan-link")).toBe(true);
  });

  it("is false for a link we do not know", async () => {
    await recordLoginLink(IVAN, "first");

    expect(await isLatestLoginLink("somebody-elses-token")).toBe(false);
  });

  it("is true again for the older link when the newer email was not sent", async () => {
    await recordLoginLink(IVAN, "first");
    const second = await recordLoginLink(IVAN, "second");
    if (!second.ok) throw new Error("the second email must be recorded");
    await forgetLoginLink(second.id);

    expect(await isLatestLoginLink("first")).toBe(true);
  });
});
