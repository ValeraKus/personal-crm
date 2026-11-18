import { calendarDate, dayNumber } from "@/lib/calendar";

// Single place for the birthday rules: the home block, the contact card and the form all use it.
// `now` is a parameter so the rules can be checked on any date, including 29 February and the New Year.

// A birthday as it is stored: month is 1-12; the year is optional
export type Birthday = { day: number; month: number; year: number | null };

// Month names in the genitive case, as they read in a date: "25 ноября". One list for the texts
// and for the month list of the form.
export const MONTH_NAMES = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

export function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Days in a month, 1 <= month <= 12. With no year February has 29 days: such a birthday exists.
export function daysInMonth(month: number, year: number | null) {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// The day the birthday is celebrated in a year: 29 February moves to 28 February in a year that is
// not a leap one
function celebrationDate(birthday: Birthday, year: number) {
  const day = Math.min(birthday.day, daysInMonth(birthday.month, year));
  return new Date(year, birthday.month - 1, day);
}

export type NextBirthday = {
  // The day of the nearest birthday (midnight, local time)
  date: Date;
  // Calendar days from today; 0 means today
  daysUntil: number;
  // The age the person turns on that day; null when the year of birth is not known
  turning: number | null;
};

// The nearest birthday is this year if the day is today or still ahead, otherwise next year
export function nextBirthday(birthday: Birthday, now: Date): NextBirthday {
  const thisYear = calendarDate(now).year;
  let date = celebrationDate(birthday, thisYear);
  if (dayNumber(date) < dayNumber(now)) {
    date = celebrationDate(birthday, thisYear + 1);
  }
  return {
    date,
    daysUntil: dayNumber(date) - dayNumber(now),
    turning: birthday.year === null ? null : date.getFullYear() - birthday.year,
  };
}

// Age today, taken from the same calculation as the block, so the card and the block never
// disagree: on the birthday it equals the turning age, on any other day it is one less
export function currentAge(birthday: Birthday, now: Date): number | null {
  const next = nextBirthday(birthday, now);
  if (next.turning === null) return null;
  return next.daysUntil === 0 ? next.turning : next.turning - 1;
}

// How many days ahead the home block looks: today and the 7 days after it
export const UPCOMING_DAYS = 7;

// A contact with a birthday, as the database returns it
type BirthdayRow = {
  id: number;
  name: string;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  birthdayYear: number | null;
};

export type UpcomingBirthday = NextBirthday & {
  id: number;
  name: string;
};

// Contacts for the home block: the birthday is today or within UPCOMING_DAYS, nearest first.
// The rows come in alphabetical order, and the stable sort keeps it for the same day,
// the same as overdueContacts does.
export function upcomingBirthdays(rows: BirthdayRow[], now: Date): UpcomingBirthday[] {
  const upcoming: UpcomingBirthday[] = [];
  for (const row of rows) {
    if (row.birthdayDay === null || row.birthdayMonth === null) continue;
    const next = nextBirthday(
      { day: row.birthdayDay, month: row.birthdayMonth, year: row.birthdayYear },
      now,
    );
    if (next.daysUntil <= UPCOMING_DAYS) {
      upcoming.push({ id: row.id, name: row.name, ...next });
    }
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}
