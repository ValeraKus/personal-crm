import { z } from "zod";

// Messages here are shown to the user in the UI, so they are in Russian

function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `Не длиннее ${maxLength} символов`)
    .transform((value) => (value === "" ? null : value));
}

export const contactSchema = z.object({
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
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = keyof ContactInput;

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Заметка пустая").max(10000, "Не длиннее 10 000 символов"),
});
