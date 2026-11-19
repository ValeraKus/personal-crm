import { describe, expect, it } from "vitest";

import { nextBirthday } from "@/lib/birthdays";

import {
  formatAge,
  formatBirthdayCard,
  formatBirthdayDate,
  formatBirthdayRow,
  formatContactCount,
  formatDaysUntil,
  formatDueDate,
  formatFoundCount,
  formatGroupDeletion,
  formatOverdue,
  formatShownRange,
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

// The caption under the page switcher, "Подпись «Показаны … из …»" in
// openspec/changes/paging/specs/contact-list-paging/spec.md
describe("formatShownRange", () => {
  it.each([
    [1, 100, 250, "Показаны 1–100 из 250"],
    [201, 250, 250, "Показаны 201–250 из 250"],
    [201, 400, 1000, "Показаны 201–400 из 1\u00a0000"],
    [101, 150, 150, "Показаны 101–150 из 150"],
    [901, 1000, 1000, "Показаны 901–1\u00a0000 из 1\u00a0000"],
  ])("shows %i to %i of %i", (from, to, total, text) => {
    expect(formatShownRange(from, to, total)).toBe(text);
  });

  it.each([
    [101, 101, 101, "Показан 101-й из 101"],
    [1001, 1001, 1001, "Показан 1\u00a0001-й из 1\u00a0001"],
  ])("names the only contact on the page: %i of %i", (from, to, total, text) => {
    expect(formatShownRange(from, to, total)).toBe(text);
  });
});

// Texts of the birthdays from openspec/changes/birthdays/specs/birthdays/spec.md

describe("formatBirthdayDate", () => {
  it("shows the day and the month in the genitive case", () => {
    expect(formatBirthdayDate({ day: 25, month: 11, year: null })).toBe("25 ноября");
    expect(formatBirthdayDate({ day: 1, month: 1, year: null })).toBe("1 января");
  });

  it("adds the year when it is known", () => {
    expect(formatBirthdayDate({ day: 25, month: 11, year: 1990 })).toBe("25 ноября 1990");
  });
});

// «Склонение возраста»
describe("formatAge", () => {
  it.each([
    [1, "1 год"],
    [3, "3 года"],
    [21, "21 год"],
    [35, "35 лет"],
    [11, "11 лет"],
    [0, "0 лет"],
  ])("declines %i", (age, text) => {
    expect(formatAge(age)).toBe(text);
  });
});

// «Склонение дней», «День рождения сегодня» и «завтра»
describe("formatDaysUntil", () => {
  it("says today and tomorrow in words", () => {
    expect(formatDaysUntil(0)).toBe("сегодня");
    expect(formatDaysUntil(1)).toBe("завтра");
  });

  it("declines the number of days", () => {
    expect(formatDaysUntil(2)).toBe("через 2 дня");
    expect(formatDaysUntil(4)).toBe("через 4 дня");
    expect(formatDaysUntil(5)).toBe("через 5 дней");
    expect(formatDaysUntil(7)).toBe("через 7 дней");
  });
});

// «Строка в блоке «Скоро день рождения»»
describe("formatBirthdayRow", () => {
  const today = new Date(2026, 10, 18, 12);

  function row(day: number, month: number, year: number | null, now = today) {
    return formatBirthdayRow(nextBirthday({ day, month, year }, now));
  }

  it("shows the date, the days left and the age that is turning", () => {
    expect(row(25, 11, 1990)).toBe("25 ноября · через 7 дней · исполнится 36");
  });

  it("says today", () => {
    expect(row(18, 11, 1990)).toBe("18 ноября · сегодня · исполнится 36");
  });

  it("says tomorrow", () => {
    expect(row(19, 11, 1990)).toBe("19 ноября · завтра · исполнится 36");
  });

  it("has no age when the year is not known", () => {
    expect(row(25, 11, null)).toBe("25 ноября · через 7 дней");
  });

  it("shows 28 February for 29 February in a year that is not a leap one", () => {
    expect(row(29, 2, 2000, new Date(2027, 1, 25, 12))).toBe(
      "28 февраля · через 3 дня · исполнится 27",
    );
  });
});

// «Строка в карточке»: «Дата с годом», «В день рождения», «Дата без года», «Даты нет»
describe("formatBirthdayCard", () => {
  it("shows the date with the year and the age today", () => {
    const text = formatBirthdayCard({ day: 25, month: 11, year: 1990 }, new Date(2026, 10, 18, 12));
    expect(text).toBe("25 ноября 1990 · 35 лет");
  });

  it("counts the new age on the birthday", () => {
    const text = formatBirthdayCard({ day: 25, month: 11, year: 1990 }, new Date(2026, 10, 25, 12));
    expect(text).toBe("25 ноября 1990 · 36 лет");
  });

  it("shows only the day and the month when there is no year", () => {
    const text = formatBirthdayCard({ day: 25, month: 11, year: null }, new Date(2026, 10, 18, 12));
    expect(text).toBe("25 ноября");
  });

  it("says it is not set when there is no birthday", () => {
    expect(formatBirthdayCard(null, new Date(2026, 10, 18, 12))).toBe("Не указано");
  });
});
