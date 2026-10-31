// Scenarios from openspec/specs/keep-in-touch/spec.md that the term rules decide on their own:
// how a frequency is named, from which date the term counts, the due date and overdue days.
// Dates are local calendar dates, the same way the app shows them.

import { describe, expect, it } from "vitest";

import { frequencyLabel, getTermStatus, type Frequency } from "@/lib/keep-in-touch";

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
