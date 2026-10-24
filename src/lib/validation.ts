import { z } from "zod";

import { FREQUENCIES, MAX_DAYS, MIN_DAYS, type Frequency } from "@/lib/keep-in-touch";

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
  })
  .superRefine((value, ctx) => {
    if (value.keepInTouchFrequency === "days" && parseDays(value.keepInTouchDays) === null) {
      ctx.addIssue({ code: "custom", message: DAYS_ERROR, path: ["keepInTouchDays"] });
    }
  })
  .transform((value) => {
    const frequency: Frequency | null = value.keepInTouchFrequency || null;
    const days = frequency === "days" ? parseDays(value.keepInTouchDays) : null;
    return { ...value, keepInTouchFrequency: frequency, keepInTouchDays: days };
  });

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = keyof ContactInput;

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Заметка пустая").max(10000, "Не длиннее 10 000 символов"),
});
