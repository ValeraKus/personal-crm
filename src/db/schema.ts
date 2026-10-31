import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    // Who the person is: job, role, relation
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    // How often to talk: week | month | quarter | year | days. NULL = not set
    keepInTouchFrequency: text("keep_in_touch_frequency"),
    // N for the "days" frequency, set only together with it
    keepInTouchDays: smallint("keep_in_touch_days"),
    // When the frequency was last set or changed: the start of the term if there are no notes
    keepInTouchSince: timestamp("keep_in_touch_since", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "contacts_keep_in_touch_frequency_check",
      sql`${table.keepInTouchFrequency} in ('week', 'month', 'quarter', 'year', 'days')`,
    ),
    check(
      "contacts_keep_in_touch_days_check",
      sql`${table.keepInTouchDays} between 1 and 365 and (${table.keepInTouchFrequency} is not distinct from 'days') = (${table.keepInTouchDays} is not null)`,
    ),
    check(
      "contacts_keep_in_touch_since_check",
      sql`(${table.keepInTouchFrequency} is not null) = (${table.keepInTouchSince} is not null)`,
    ),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notes_contact_id_created_at_idx").on(table.contactId, table.createdAt)],
);

export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Names are unique regardless of case and "е"/"ё": same folding as the contact name search
    uniqueIndex("groups_name_unique_idx").on(sql`replace(lower(${table.name}), 'ё', 'е')`),
  ],
);

export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
