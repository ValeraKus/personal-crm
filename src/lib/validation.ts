import { z } from "zod";

import { daysInMonth } from "@/lib/birthdays";
import { calendarDate, dayNumber } from "@/lib/calendar";
import { FREQUENCIES, MAX_DAYS, MIN_DAYS, type Frequency } from "@/lib/keep-in-touch";

// No eval in zod: to speed up objects it tries `new Function`, and the Content-Security-Policy of
// the app (next.config.ts) blocks it and reports a violation in the browser console. The contact
// form loads these schemas in the browser. Must run before the first schema below is created.
z.config({ jitless: true });

// Messages here are shown to the user in the UI, so they are in Russian

function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `Не длиннее ${maxLength} символов`)
    .transform((value) => (value === "" ? null : value));
}

const DAYS_ERROR = `Укажите число дней от ${MIN_DAYS} до ${MAX_DAYS}`;

// Whole number from MIN_DAYS to MAX_DAYS; "2,5", "0", "400" and an empty field are not valid
function parseDays(text: string) {
  if (!/^\d+$/.test(text)) return null;
  const days = Number(text);
  return days >= MIN_DAYS && days <= MAX_DAYS ? days : null;
}

const MIN_BIRTH_YEAR = 1900;

export type BirthdayResult =
  | { ok: true; day: number | null; month: number | null; year: number | null }
  | { ok: false; message: string };

// Whole number written with digits only; "2,5", "-1", "19а0" and "" are not
function parseWholeNumber(text: string) {
  return /^\d+$/.test(text) ? Number(text) : null;
}

// The one place that decides what a birthday is, for the form and for a direct request to the
// server. The three parts come as the text of the form. All empty means no birthday. The order of
// the checks decides which single error is shown when several parts are wrong:
// 1. missing day or month, 2. year, 3. a date that does not exist, 4. a date in the future.
export function parseBirthday(
  raw: { day: string; month: string; year: string },
  now: Date,
): BirthdayResult {
  const dayText = raw.day.trim();
  const monthText = raw.month.trim();
  const yearText = raw.year.trim();

  if (dayText === "" && monthText === "" && yearText === "") {
    return { ok: true, day: null, month: null, year: null };
  }
  if (dayText === "" || monthText === "") {
    return { ok: false, message: "Укажите день и месяц" };
  }

  const currentYear = calendarDate(now).year;
  let year: number | null = null;
  if (yearText !== "") {
    year = parseWholeNumber(yearText);
    if (year === null || year < MIN_BIRTH_YEAR || year > currentYear) {
      return { ok: false, message: `Укажите год от ${MIN_BIRTH_YEAR} до ${currentYear}` };
    }
  }

  const day = parseWholeNumber(dayText);
  const month = parseWholeNumber(monthText);
  if (
    day === null ||
    month === null ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(month, year)
  ) {
    return { ok: false, message: "Такой даты нет" };
  }

  // Only a date with a year can be in the future: a day and a month alone come round every year
  if (year !== null && dayNumber(new Date(year, month - 1, day)) > dayNumber(now)) {
    return { ok: false, message: "Дата рождения не может быть в будущем" };
  }
  return { ok: true, day, month, year };
}

export const contactSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите имя").max(200, "Не длиннее 200 символов"),
    about: optionalText(500),
    howWeMet: optionalText(1000),
    phone: optionalText(50).refine(
      (value) => value === null || /^[\d\s()+\-.]+$/.test(value),
      "Только цифры, пробелы, +, -, скобки",
    ),
    email: optionalText(200).refine(
      (value) => value === null || z.email().safeParse(value).success,
      "Похоже, в адресе почты ошибка",
    ),
    // Empty value means "not set"
    keepInTouchFrequency: z.enum(["", ...FREQUENCIES]),
    // Raw text of the field: checked below, only when the frequency is "days"
    keepInTouchDays: z.string().trim(),
    // Raw text of the three parts of the birthday: checked together below
    birthdayDay: z.string(),
    birthdayMonth: z.string(),
    birthdayYear: z.string(),
  })
  .superRefine((value, ctx) => {
    const birthday = parseBirthday(
      { day: value.birthdayDay, month: value.birthdayMonth, year: value.birthdayYear },
      new Date(),
    );
    // One error for the whole field; it is shown under the row of three parts
    if (!birthday.ok) {
      ctx.addIssue({ code: "custom", message: birthday.message, path: ["birthdayDay"] });
    }
    if (value.keepInTouchFrequency === "days" && parseDays(value.keepInTouchDays) === null) {
      ctx.addIssue({ code: "custom", message: DAYS_ERROR, path: ["keepInTouchDays"] });
    }
  })
  .transform((value) => {
    const frequency: Frequency | null = value.keepInTouchFrequency || null;
    const days = frequency === "days" ? parseDays(value.keepInTouchDays) : null;
    const birthday = parseBirthday(
      { day: value.birthdayDay, month: value.birthdayMonth, year: value.birthdayYear },
      new Date(),
    );
    return {
      ...value,
      keepInTouchFrequency: frequency,
      keepInTouchDays: days,
      birthdayDay: birthday.ok ? birthday.day : null,
      birthdayMonth: birthday.ok ? birthday.month : null,
      birthdayYear: birthday.ok ? birthday.year : null,
    };
  });

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = keyof ContactInput;

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Заметка пустая").max(10000, "Не длиннее 10 000 символов"),
});

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название группы")
  .max(50, "Не длиннее 50 символов");

// Name as compared for uniqueness: no case, "ё" same as "е". Mirrors the unique index on groups.
export function foldGroupName(name: string) {
  return name.toLowerCase().replaceAll("ё", "е");
}

export type NewGroupChoice =
  | { kind: "error"; message: string }
  | { kind: "existing"; id: number }
  | { kind: "new"; name: string }
  | { kind: "repeat" };

// What the "Добавить" button of the contact form does with the typed name
export function chooseNewGroup(
  text: string,
  groups: { id: number; name: string }[],
  newGroups: string[],
): NewGroupChoice {
  const parsed = groupNameSchema.safeParse(text);
  if (!parsed.success) {
    return { kind: "error", message: parsed.error.issues[0].message };
  }
  const folded = foldGroupName(parsed.data);
  const existing = groups.find((group) => foldGroupName(group.name) === folded);
  if (existing) return { kind: "existing", id: existing.id };
  if (newGroups.some((name) => foldGroupName(name) === folded)) return { kind: "repeat" };
  return { kind: "new", name: parsed.data };
}

export const LOGIN_EMAIL_ERROR = "Проверьте адрес почты";

// The longest address SMTP allows
const MAX_EMAIL_LENGTH = 254;

export type LoginEmailResult = { ok: true; email: string } | { ok: false; message: string };

// The one place that decides what a login address is, for the form and for a direct request to the
// server: spaces at the edges are removed and letter case is ignored, so "  Ivan@Example.com " and
// "ivan@example.com" are the same person
export function parseLoginEmail(value: unknown): LoginEmailResult {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email === "" || email.length > MAX_EMAIL_LENGTH || !z.email().safeParse(email).success) {
    return { ok: false, message: LOGIN_EMAIL_ERROR };
  }
  return { ok: true, email };
}
