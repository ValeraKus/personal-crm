import { pluralize } from "@/lib/format";

export const FREQUENCIES = ["week", "month", "quarter", "year", "days"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const MIN_DAYS = 1;
export const MAX_DAYS = 365;

// Text of the note added by the "contacted" check mark
export const CONTACTED_NOTE = "Пообщались";

export function isFrequency(value: unknown): value is Frequency {
  return FREQUENCIES.includes(value as Frequency);
}

const FIXED_LABELS: Record<Exclude<Frequency, "days">, string> = {
  week: "Раз в неделю",
  month: "Раз в месяц",
  quarter: "Раз в квартал",
  year: "Раз в год",
};

export function frequencyLabel(frequency: Frequency, days: number | null) {
  if (frequency !== "days") return FIXED_LABELS[frequency];
  if (days === null) return "Свой срок";
  if (days === 1) return "Каждый день";
  return `Раз в ${days} ${pluralize(days, ["день", "дня", "дней"])}`;
}

type Term = {
  frequency: Frequency | null;
  days: number | null;
  since: Date | null;
  lastNoteAt: Date | null;
};

export type TermStatus = {
  label: string;
  dueDate: Date;
  // Calendar days from the due date to today; 0 or less means not overdue
  overdueDays: number;
};

// Calendar date in the process time zone, the same one the note dates are shown in
function calendarDate(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

// 31 Jan + 1 month = 28 Feb (or 29): the day is clamped to the end of the target month
function addMonths(date: Date, months: number) {
  const { year, month, day } = calendarDate(date);
  const lastDay = new Date(year, month + months + 1, 0).getDate();
  return new Date(year, month + months, Math.min(day, lastDay));
}

function addDays(date: Date, days: number) {
  const { year, month, day } = calendarDate(date);
  return new Date(year, month, day + days);
}

function dayNumber(date: Date) {
  const { year, month, day } = calendarDate(date);
  return Date.UTC(year, month, day) / 86_400_000;
}

// Single place for the term rules: the home block and the contact card both use it.
// Returns null when the frequency is not set.
export function getTermStatus(term: Term, now = new Date()): TermStatus | null {
  const { frequency, days, since, lastNoteAt } = term;
  if (frequency === null) return null;

  // The last note wins; with no notes the term counts from the moment the frequency was set
  const start = lastNoteAt ?? since;
  if (start === null) return null;

  let dueDate: Date;
  switch (frequency) {
    case "week":
      dueDate = addDays(start, 7);
      break;
    case "month":
      dueDate = addMonths(start, 1);
      break;
    case "quarter":
      dueDate = addMonths(start, 3);
      break;
    case "year":
      dueDate = addMonths(start, 12);
      break;
    case "days":
      if (days === null) return null;
      dueDate = addDays(start, days);
      break;
  }

  return {
    label: frequencyLabel(frequency, days),
    dueDate,
    overdueDays: dayNumber(now) - dayNumber(dueDate),
  };
}
