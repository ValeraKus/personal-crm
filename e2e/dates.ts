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
