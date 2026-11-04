import { describe, expect, it } from "vitest";

import {
  formatContactCount,
  formatDueDate,
  formatFoundCount,
  formatGroupDeletion,
  formatOverdue,
} from "@/lib/format";

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

// Texts of the "Список групп" and "Одна группа" scenarios in openspec/specs/contact-groups/spec.md
describe("formatContactCount", () => {
  it.each([
    [0, "0 контактов"],
    [1, "1 контакт"],
    [3, "3 контакта"],
    [5, "5 контактов"],
    [11, "11 контактов"],
    [21, "21 контакт"],
    // The browser and the server group thousands with a non-breaking space
    [1000, "1 000 контактов"],
  ])("declines %i contacts", (count, text) => {
    expect(formatContactCount(count)).toBe(text);
  });
});

// The "Подтверждение" scenario in openspec/specs/contact-groups/spec.md
describe("formatGroupDeletion", () => {
  it.each([
    [1, "Группа «Теннис» удалится, 1 контакт останется без неё"],
    [4, "Группа «Теннис» удалится, 4 контакта останутся без неё"],
    [5, "Группа «Теннис» удалится, 5 контактов останутся без неё"],
    [21, "Группа «Теннис» удалится, 21 контакт останется без неё"],
  ])("names the group and its %i contacts", (count, text) => {
    expect(formatGroupDeletion("Теннис", count)).toBe(text);
  });

  it("mentions no contacts when the group has none", () => {
    expect(formatGroupDeletion("Теннис", 0)).toBe("Группа «Теннис» удалится");
  });
});

// The counter of the "Одна группа" scenario in openspec/specs/contact-groups/spec.md
describe("formatFoundCount", () => {
  it.each([
    [2, 4, "Найдено: 2 из 4 контактов"],
    [3, 5, "Найдено: 3 из 5 контактов"],
    [0, 1, "Найдено: 0 из 1 контакта"],
    [1, 11, "Найдено: 1 из 11 контактов"],
    [1, 21, "Найдено: 1 из 21 контакта"],
    [1, 1000, "Найдено: 1 из 1\u00a0000 контактов"],
  ])("shows %i found of %i contacts", (found, total, text) => {
    expect(formatFoundCount(found, total)).toBe(text);
  });
});
