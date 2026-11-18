// Calendar days in the process time zone, the same one the note dates are shown in. On the server
// that is TZ from deploy/compose.yaml. Shared by the term rules (keep-in-touch.ts) and the birthday
// rules (birthdays.ts), so both count days the same way.

export function calendarDate(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

// The number of the calendar day: two dates are N days apart exactly when their numbers differ by N,
// whatever the time of day or a daylight saving change in between
export function dayNumber(date: Date) {
  const { year, month, day } = calendarDate(date);
  return Date.UTC(year, month, day) / 86_400_000;
}
