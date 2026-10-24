const pluralRules = new Intl.PluralRules("ru-RU");

// pluralize(5, ["контакт", "контакта", "контактов"]) -> "контактов"
export function pluralize(count: number, [one, few, many]: [string, string, string]) {
  const form = pluralRules.select(count);
  if (form === "one") return one;
  if (form === "few") return few;
  return many;
}

export function formatContactCount(count: number) {
  return `${count.toLocaleString("ru-RU")} ${pluralize(count, ["контакт", "контакта", "контактов"])}`;
}

const noteDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatNoteDate(date: Date) {
  return noteDateFormat.format(date);
}

export function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

// Letter for alphabetical group headers; "Ё" goes together with "Е" as in the sort order
export function groupLetter(name: string) {
  const first = name.trim().charAt(0).toUpperCase();
  if (first === "Ё") return "Е";
  return /\p{L}/u.test(first) ? first : "#";
}

const dueDateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const dueDateWithYearFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// "12 ноября"; the year is shown only when it is not the current one
export function formatDueDate(date: Date, now = new Date()) {
  const format = date.getFullYear() === now.getFullYear() ? dueDateFormat : dueDateWithYearFormat;
  return format.format(date).replace(/\s?г\.$/, "");
}

export function formatOverdue(days: number) {
  return `просрочено на ${days} ${pluralize(days, ["день", "дня", "дней"])}`;
}
