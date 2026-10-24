ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_frequency" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_days" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_keep_in_touch_frequency_check" CHECK ("contacts"."keep_in_touch_frequency" in ('week', 'month', 'quarter', 'year', 'days'));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_keep_in_touch_days_check" CHECK ("contacts"."keep_in_touch_days" between 1 and 365 and ("contacts"."keep_in_touch_frequency" is not distinct from 'days') = ("contacts"."keep_in_touch_days" is not null));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_keep_in_touch_since_check" CHECK (("contacts"."keep_in_touch_frequency" is not null) = ("contacts"."keep_in_touch_since" is not null));