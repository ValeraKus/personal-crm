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

// "Найдено: 2 из 4 контактов": after "из" the word stays in the genitive case, so its forms differ
// from formatContactCount: "из 1 контакта", "из 4 контактов"
export function formatFoundCount(found: number, total: number) {
  const contactWord = pluralize(total, ["контакта", "контактов", "контактов"]);
  return `Найдено: ${found.toLocaleString("ru-RU")} из ${total.toLocaleString("ru-RU")} ${contactWord}`;
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

// The question before a group is deleted; a group without contacts has nothing to warn about
export function formatGroupDeletion(name: string, contactCount: number) {
  const kept =
    contactCount > 0
      ? `, ${contactCount} ${pluralize(contactCount, ["контакт останется", "контакта останутся", "контактов останутся"])} без неё`
      : "";
  return `Группа «${name}» удалится${kept}`;
}
