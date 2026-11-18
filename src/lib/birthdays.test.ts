// Scenarios from openspec/changes/birthdays/specs/birthdays/spec.md that the birthday rules decide
// on their own: the nearest birthday, the age, and who is in the home block and in which order.
// Dates are local calendar dates, the same way the app shows them.

import { describe, expect, it } from "vitest";

import { currentAge, nextBirthday, upcomingBirthdays } from "@/lib/birthdays";

function date(year: number, month: number, day: number, hours = 12) {
  return new Date(year, month - 1, day, hours);
}

describe("nextBirthday", () => {
  it("is this year when the birthday is still ahead", () => {
    const next = nextBirthday({ day: 25, month: 11, year: 1990 }, date(2026, 11, 18));
    expect(next.date).toEqual(date(2026, 11, 25, 0));
    expect(next.daysUntil).toBe(7);
  });

  it("is today when the birthday is today", () => {
    const next = nextBirthday({ day: 18, month: 11, year: 1990 }, date(2026, 11, 18));
    expect(next.date).toEqual(date(2026, 11, 18, 0));
    expect(next.daysUntil).toBe(0);
  });

  it("does not depend on the time of day", () => {
    const birthday = { day: 18, month: 11, year: 1990 };
    expect(nextBirthday(birthday, date(2026, 11, 18, 0)).daysUntil).toBe(0);
    expect(nextBirthday(birthday, date(2026, 11, 18, 23)).daysUntil).toBe(0);
  });

  it("is next year when the birthday has passed", () => {
    const next = nextBirthday({ day: 10, month: 11, year: 1990 }, date(2026, 11, 18));
    expect(next.date).toEqual(date(2027, 11, 10, 0));
    expect(next.daysUntil).toBe(357);
  });

  it("goes over the New Year", () => {
    const next = nextBirthday({ day: 2, month: 1, year: 1990 }, date(2026, 12, 28));
    expect(next.date).toEqual(date(2027, 1, 2, 0));
    expect(next.daysUntil).toBe(5);
    expect(next.turning).toBe(37);
  });

  it("moves 29 February to 28 February in a year that is not a leap one", () => {
    const next = nextBirthday({ day: 29, month: 2, year: 2000 }, date(2027, 2, 25));
    expect(next.date).toEqual(date(2027, 2, 28, 0));
    expect(next.daysUntil).toBe(3);
    expect(next.turning).toBe(27);
  });

  it("keeps 29 February in a leap year", () => {
    const next = nextBirthday({ day: 29, month: 2, year: 2000 }, date(2028, 2, 25));
    expect(next.date).toEqual(date(2028, 2, 29, 0));
    expect(next.daysUntil).toBe(4);
    expect(next.turning).toBe(28);
  });

  it("looks for 29 February of a leap year after 28 February of a year that is not one", () => {
    // 1 March 2027: the next 29 February is in 2028
    const next = nextBirthday({ day: 29, month: 2, year: null }, date(2027, 3, 1));
    expect(next.date).toEqual(date(2028, 2, 29, 0));
  });

  it("counts a birthday without a year and does not invent the age", () => {
    const next = nextBirthday({ day: 25, month: 11, year: null }, date(2026, 11, 18));
    expect(next.daysUntil).toBe(7);
    expect(next.turning).toBeNull();
  });

  it("names the age that is turning: the year of the birthday minus the year of birth", () => {
    const next = nextBirthday({ day: 25, month: 11, year: 1990 }, date(2026, 11, 18));
    expect(next.turning).toBe(36);
  });
});

describe("currentAge", () => {
  it("is one less than the turning age before the birthday", () => {
    expect(currentAge({ day: 25, month: 11, year: 1990 }, date(2026, 11, 18))).toBe(35);
  });

  it("is the turning age on the birthday", () => {
    expect(currentAge({ day: 25, month: 11, year: 1990 }, date(2026, 11, 25))).toBe(36);
  });

  it("is the day after the birthday still the new age", () => {
    expect(currentAge({ day: 25, month: 11, year: 1990 }, date(2026, 11, 26))).toBe(36);
  });

  it("is one less on the eve of the birthday", () => {
    expect(currentAge({ day: 25, month: 11, year: 1990 }, date(2026, 11, 24))).toBe(35);
  });

  it("agrees with the block for 29 February in a year that is not a leap one", () => {
    const birthday = { day: 29, month: 2, year: 2000 };
    expect(currentAge(birthday, date(2027, 2, 27))).toBe(26);
    expect(currentAge(birthday, date(2027, 2, 28))).toBe(27);
  });

  it("is null without a year", () => {
    expect(currentAge({ day: 25, month: 11, year: null }, date(2026, 11, 18))).toBeNull();
  });
});

function row(
  id: number,
  name: string,
  day: number | null,
  month: number | null,
  year: number | null = null,
) {
  return { id, name, birthdayDay: day, birthdayMonth: month, birthdayYear: year };
}

describe("upcomingBirthdays", () => {
  const now = date(2026, 11, 18);

  it("takes the birthdays from today to seven days ahead and no others", () => {
    const rows = [
      row(1, "Анна", 17, 11),
      row(2, "Борис", 18, 11),
      row(3, "Вера", 25, 11),
      row(4, "Глеб", 26, 11),
    ];
    expect(upcomingBirthdays(rows, now).map((contact) => contact.name)).toEqual(["Борис", "Вера"]);
  });

  it("skips a contact without a birthday", () => {
    const rows = [row(1, "Анна", null, null), row(2, "Борис", 20, 11)];
    expect(upcomingBirthdays(rows, now).map((contact) => contact.name)).toEqual(["Борис"]);
  });

  it("puts the nearest birthday first", () => {
    // Anna in 6 days, Boris in 2 days; the rows come in alphabetical order
    const rows = [row(1, "Анна", 24, 11), row(2, "Борис", 20, 11)];
    expect(upcomingBirthdays(rows, now).map((contact) => contact.name)).toEqual(["Борис", "Анна"]);
  });

  it("keeps the alphabetical order when the day is the same", () => {
    const rows = [row(1, "Вера", 22, 11), row(2, "Глеб", 22, 11)];
    expect(upcomingBirthdays(rows, now).map((contact) => contact.name)).toEqual(["Вера", "Глеб"]);
  });

  it("orders through the New Year by the days left, not by the date", () => {
    // 28 December: Egor on 30 December (2 days) comes before Dina on 2 January (5 days)
    const rows = [row(1, "Дина", 2, 1), row(2, "Егор", 30, 12)];
    const names = upcomingBirthdays(rows, date(2026, 12, 28)).map((contact) => contact.name);
    expect(names).toEqual(["Егор", "Дина"]);
  });

  it("gives the days, the turning age and the contact number for the block", () => {
    const [contact] = upcomingBirthdays([row(7, "Анна Смирнова", 25, 11, 1990)], now);
    expect(contact).toMatchObject({ id: 7, name: "Анна Смирнова", daysUntil: 7, turning: 36 });
    expect(contact.date).toEqual(date(2026, 11, 25, 0));
  });

  it("has no turning age without a year", () => {
    const [contact] = upcomingBirthdays([row(1, "Анна", 25, 11)], now);
    expect(contact.turning).toBeNull();
  });

  it("shows 29 February on 28 February in a year that is not a leap one", () => {
    const [contact] = upcomingBirthdays([row(1, "Анна", 29, 2, 2000)], date(2027, 2, 25));
    expect(contact.date).toEqual(date(2027, 2, 28, 0));
    expect(contact.daysUntil).toBe(3);
  });
});
