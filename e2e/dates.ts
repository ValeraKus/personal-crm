// Dates for the e2e tests, counted here on their own: the tests check the term rules of the app,
// so they do not borrow its code. Dates are local calendar days: the app server that Playwright
// starts runs on the same machine, in the same time zone.

// Noon keeps a date on its calendar day whatever the clock change
function noon(year: number, month: number, day: number) {
  return new Date(year, month, day, 12);
}

export function today() {
  const now = new Date();
  return noon(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date: Date, days: number) {
  return noon(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function daysAgo(days: number) {
  return addDays(today(), -days);
}

// 31 January + 1 month = 28 February (29 in a leap year)
export function addMonths(date: Date, months: number) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate();
  return noon(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), lastDay));
}

const dayAndMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

// "12 ноября"; "12 октября 2027" when the year is not the current one, as the card shows a due date
export function dueDateText(date: Date) {
  const text = dayAndMonth.format(date);
  return date.getFullYear() === today().getFullYear() ? text : `${text} ${date.getFullYear()}`;
}

// "31 октября 2026": the day of a note as its date starts in the card
export function noteDayText(date: Date) {
  return `${dayAndMonth.format(date)} ${date.getFullYear()}`;
}

// Birthdays. Counted here on their own, not with the code of the app, like the term dates above.

export type BirthdaySeed = { day: number; month: number; year: number | null };

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// The birthday that falls `days` from today. With `turning` the year of birth is set, so the person
// turns about that age on that day; without it there is no year. If that day is 29 February, the
// year of birth has to be a leap one (29 February 1990 does not exist), so it moves back to the
// nearest leap year and `turning` is the age that results.
export function birthdayInDays(days: number, turning?: number) {
  const day = addDays(today(), days);
  let year: number | null = null;
  if (turning !== undefined) {
    year = day.getFullYear() - turning;
    if (day.getMonth() === 1 && day.getDate() === 29) {
      while (!isLeapYear(year)) year -= 1;
    }
  }
  return {
    birthday: { day: day.getDate(), month: day.getMonth() + 1, year } satisfies BirthdaySeed,
    // The age on that day, when the year of birth is known
    turning: year === null ? null : day.getFullYear() - year,
    // The day itself, to write the date of the block row
    date: day,
  };
}

// "25 ноября" or "25 ноября 1990": how a birthday reads in the form and the card
export function birthdayText({ day, month, year }: BirthdaySeed) {
  const text = dayAndMonth.format(new Date(2000, month - 1, day));
  return year === null ? text : `${text} ${year}`;
}

// 1 год, 2-4 года, 5-20 лет, 21 год ...: the Russian rule written out, not taken from the app
function yearsWord(count: number) {
  if (count % 100 >= 11 && count % 100 <= 14) return "лет";
  if (count % 10 === 1) return "год";
  if (count % 10 >= 2 && count % 10 <= 4) return "года";
  return "лет";
}

function daysWord(count: number) {
  if (count % 100 >= 11 && count % 100 <= 14) return "дней";
  if (count % 10 === 1) return "день";
  if (count % 10 >= 2 && count % 10 <= 4) return "дня";
  return "дней";
}

export function ageText(age: number) {
  return `${age} ${yearsWord(age)}`;
}

// "сегодня", "завтра", "через 7 дней"
export function daysUntilText(days: number) {
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${daysWord(days)}`;
}

// How old a person is today, from the year of birth: one less until the birthday comes
export function ageToday({ day, month, year }: BirthdaySeed & { year: number }) {
  const now = today();
  const hadBirthday =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}
