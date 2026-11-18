ALTER TABLE "contacts" ADD COLUMN "birthday_day" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birthday_month" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birthday_year" smallint;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_parts_check" CHECK (("contacts"."birthday_day" is null) = ("contacts"."birthday_month" is null) and ("contacts"."birthday_year" is null or "contacts"."birthday_day" is not null));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_range_check" CHECK ("contacts"."birthday_day" between 1 and 31 and "contacts"."birthday_month" between 1 and 12 and "contacts"."birthday_year" >= 1900);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_day_check" CHECK ("contacts"."birthday_day" <= case
        when "contacts"."birthday_month" in (4, 6, 9, 11) then 30
        when "contacts"."birthday_month" = 2 then
          case
            when "contacts"."birthday_year" is null then 29
            when ("contacts"."birthday_year" % 4 = 0 and "contacts"."birthday_year" % 100 <> 0) or "contacts"."birthday_year" % 400 = 0 then 29
            else 28
          end
        else 31
      end);