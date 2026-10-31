// Scenarios from openspec/specs/keep-in-touch/spec.md that the term rules decide on their own:
// how a frequency is named, from which date the term counts, the due date and overdue days.
// Dates are local calendar dates, the same way the app shows them.

import { describe, expect, it } from "vitest";

import {
  frequencyLabel,
  getTermStatus,
  overdueContacts,
  type Frequency,
} from "@/lib/keep-in-touch";

function date(year: number, month: number, day: number, hours = 0, minutes = 0) {
  return new Date(year, month - 1, day, hours, minutes);
}

function term(frequency: Frequency | null, start: Date, days: number | null = null) {
  return { frequency, days, since: start, lastNoteAt: null };
}

describe("frequencyLabel", () => {
  it("names the fixed frequencies", () => {
    expect(frequencyLabel("week", null)).toBe("Раз в неделю");
    expect(frequencyLabel("month", null)).toBe("Раз в месяц");
    expect(frequencyLabel("quarter", null)).toBe("Раз в квартал");
    expect(frequencyLabel("year", null)).toBe("Раз в год");
  });

  it("declines the number of days of a custom term", () => {
    expect(frequencyLabel("days", 1)).toBe("Каждый день");
    expect(frequencyLabel("days", 3)).toBe("Раз в 3 дня");
    expect(frequencyLabel("days", 21)).toBe("Раз в 21 день");
    expect(frequencyLabel("days", 10)).toBe("Раз в 10 дней");
  });

  it("does not call seven days a week", () => {
    expect(frequencyLabel("days", 7)).toBe("Раз в 7 дней");
  });
});

describe("getTermStatus: from which date the term counts", () => {
  it("counts from the last note, even if the frequency was set later", () => {
    const status = getTermStatus({
      frequency: "month",
      days: null,
      since: date(2026, 10, 20),
      lastNoteAt: date(2026, 10, 12, 15, 40),
    });
    expect(status?.dueDate).toEqual(date(2026, 11, 12));
  });

  it("counts from the moment the frequency was set when there are no notes", () => {
    const status = getTermStatus(term("month", date(2026, 11, 1, 9, 0)));
    expect(status?.dueDate).toEqual(date(2026, 12, 1));
  });

  it("counts again from a new note, so an overdue contact is no longer overdue", () => {
    const now = date(2026, 11, 20, 10, 0);
    const overdue = term("month", date(2026, 9, 1));
    expect(getTermStatus(overdue, now)?.overdueDays).toBeGreaterThan(0);

    const status = getTermStatus({ ...overdue, lastNoteAt: now }, now);
    expect(status?.dueDate).toEqual(date(2026, 12, 20));
    expect(status?.overdueDays).toBeLessThanOrEqual(0);
  });
});

describe("getTermStatus: due date", () => {
  it("adds a week", () => {
    expect(getTermStatus(term("week", date(2026, 10, 12)))?.dueDate).toEqual(date(2026, 10, 19));
  });

  it("adds a month, a quarter and a year", () => {
    const start = date(2026, 10, 12);
    expect(getTermStatus(term("month", start))?.dueDate).toEqual(date(2026, 11, 12));
    expect(getTermStatus(term("quarter", start))?.dueDate).toEqual(date(2027, 1, 12));
    expect(getTermStatus(term("year", start))?.dueDate).toEqual(date(2027, 10, 12));
  });

  it("moves to the last day of the month when the target month is shorter", () => {
    expect(getTermStatus(term("month", date(2027, 1, 31)))?.dueDate).toEqual(date(2027, 2, 28));
  });

  it("adds the days of a custom term", () => {
    const status = getTermStatus(term("days", date(2026, 10, 12), 10));
    expect(status?.dueDate).toEqual(date(2026, 10, 22));
    expect(status?.label).toBe("Раз в 10 дней");
  });
});

describe("getTermStatus: overdue", () => {
  // Due date: 12 November 2026
  const monthFromOctober12 = term("month", date(2026, 10, 12));

  it("is not overdue on the due date", () => {
    const status = getTermStatus(monthFromOctober12, date(2026, 11, 12, 23, 30));
    expect(status?.overdueDays).toBe(0);
  });

  it("is overdue by one day the day after the due date", () => {
    const status = getTermStatus(monthFromOctober12, date(2026, 11, 13, 0, 5));
    expect(status?.overdueDays).toBe(1);
  });

  it("has no term when the frequency is not set, however old the last note is", () => {
    const status = getTermStatus(
      { frequency: null, days: null, since: null, lastNoteAt: date(2025, 11, 1) },
      date(2026, 11, 1),
    );
    expect(status).toBeNull();
  });
});

describe("overdueContacts: who is in the home block and in which order", () => {
  // 20 November 2026
  const now = date(2026, 11, 20, 10, 0);

  // Rows come from the database in the order of the general list, alphabetical
  function row(id: number, name: string, frequency: Frequency | null, since: Date | null) {
    return {
      id,
      name,
      keepInTouchFrequency: frequency,
      keepInTouchDays: null,
      keepInTouchSince: since,
      lastNoteAt: null,
    };
  }

  it("puts the most overdue contact first", () => {
    const rows = [
      // Due 14 November: 6 days overdue
      row(1, "Анна", "week", date(2026, 11, 7)),
      // Due 10 November: 10 days overdue
      row(2, "Борис", "year", date(2025, 11, 10)),
    ];
    expect(overdueContacts(rows, now)).toEqual([
      { id: 2, name: "Борис", label: "Раз в год", overdueDays: 10 },
      { id: 1, name: "Анна", label: "Раз в неделю", overdueDays: 6 },
    ]);
  });

  it("keeps the alphabetical order of contacts that are equally overdue", () => {
    const rows = [
      // Due 16 November: 4 days overdue
      row(1, "Вера", "week", date(2026, 11, 9)),
      row(2, "Глеб", "week", date(2026, 11, 9)),
      // Due 11 November: 9 days overdue
      row(3, "Дина", "week", date(2026, 11, 4)),
    ];
    expect(overdueContacts(rows, now).map((contact) => contact.name)).toEqual([
      "Дина",
      "Вера",
      "Глеб",
    ]);
  });

  it("leaves out contacts that are due today or have no frequency", () => {
    const rows = [
      // Due 20 November, today
      row(1, "Анна", "week", date(2026, 11, 13)),
      row(2, "Борис", null, null),
      // Due 19 November: 1 day overdue
      row(3, "Вера", "week", date(2026, 11, 12)),
    ];
    expect(overdueContacts(rows, now).map((contact) => contact.name)).toEqual(["Вера"]);
  });
});
