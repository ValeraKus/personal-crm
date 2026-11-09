// Scenarios of the requirement «Демо-данные у владельца» in
// openspec/specs/data-ownership/spec.md, on the real database.

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { seedDemoData } from "../../scripts/seed-demo";
import { resetData } from "../../test-db/reset";
import { getDb } from "./index";
import { contacts, notes, users } from "./schema";

const OWNER = "owner@example.com";

async function userByEmail(email: string) {
  const [user] = await getDb().select().from(users).where(eq(users.email, email));
  return user;
}

async function contactsOf(userId: string) {
  return getDb().select().from(contacts).where(eq(contacts.ownerId, userId));
}

async function addUser(email: string) {
  const [user] = await getDb()
    .insert(users)
    .values({ id: `user-${email}`, name: "", email, emailVerified: true })
    .returning();
  return user;
}

beforeEach(resetData);

describe("seedDemoData", () => {
  it("creates the demo contacts, with notes, at the owner, and nobody else has them", async () => {
    const friend = await addUser("friend@example.com");

    const result = await seedDemoData(OWNER, { count: 20 });

    const owner = await userByEmail(OWNER);
    expect(result).toMatchObject({ status: "seeded", contacts: 20 });
    expect(await contactsOf(owner.id)).toHaveLength(20);
    expect(await contactsOf(friend.id)).toHaveLength(0);
    expect((await getDb().select().from(notes)).length).toBeGreaterThan(0);
  });

  it("changes nothing when the owner already has contacts", async () => {
    const owner = await addUser(OWNER);
    await getDb().insert(contacts).values({ ownerId: owner.id, name: "Мой единственный" });

    const result = await seedDemoData(OWNER, { count: 20 });

    expect(result).toEqual({ status: "skipped", contacts: 1 });
    const rows = await contactsOf(owner.id);
    expect(rows.map((row) => row.name)).toEqual(["Мой единственный"]);
    expect(await getDb().select().from(notes)).toHaveLength(0);
  });

  it("does not run twice: the second run adds nothing", async () => {
    await seedDemoData(OWNER, { count: 20 });
    const second = await seedDemoData(OWNER, { count: 20 });

    expect(second).toEqual({ status: "skipped", contacts: 20 });
    expect(await getDb().select().from(contacts)).toHaveLength(20);
  });

  it("seeds the owner even when a friend has contacts", async () => {
    const friend = await addUser("friend@example.com");
    await getDb().insert(contacts).values({ ownerId: friend.id, name: "Контакт друга" });

    await seedDemoData(OWNER, { count: 20 });

    const owner = await userByEmail(OWNER);
    expect(await contactsOf(owner.id)).toHaveLength(20);
    expect(await contactsOf(friend.id)).toHaveLength(1);
  });

  it("takes the owner whatever the case and spaces of the address, and creates him once", async () => {
    await seedDemoData("  Owner@Example.COM ", { count: 5 });
    await seedDemoData(OWNER, { count: 5 });

    expect(await getDb().select().from(users)).toHaveLength(1);
    expect((await userByEmail(OWNER)).emailVerified).toBe(true);
  });

  it("needs the address of the owner", async () => {
    await expect(seedDemoData("", { count: 5 })).rejects.toThrow("OWNER_EMAIL is not set");
    await expect(seedDemoData("   ", { count: 5 })).rejects.toThrow("OWNER_EMAIL is not set");
    expect(await getDb().select().from(contacts)).toHaveLength(0);
  });
});
