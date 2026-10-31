import { describe, expect, it } from "vitest";

import { formatDueDate, formatOverdue } from "@/lib/format";

// Texts of the term from openspec/specs/keep-in-touch/spec.md: the overdue days in the home block
// and the due date in the contact card

describe("formatOverdue", () => {
  it("declines the number of overdue days", () => {
    expect(formatOverdue(1)).toBe("просрочено на 1 день");
    expect(formatOverdue(3)).toBe("просрочено на 3 дня");
    expect(formatOverdue(45)).toBe("просрочено на 45 дней");
  });
});

describe("formatDueDate", () => {
  const october20 = new Date(2026, 9, 20);

  it("shows no year when the due date is in the current year", () => {
    expect(formatDueDate(new Date(2026, 10, 12), october20)).toBe("12 ноября");
  });

  it("shows the year when the due date is in the next year", () => {
    expect(formatDueDate(new Date(2027, 9, 12), october20)).toBe("12 октября 2027");
  });
});
