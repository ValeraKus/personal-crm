import { currentAge, MONTH_NAMES, type Birthday, type NextBirthday } from "@/lib/birthdays";

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

// The caption under the page switcher: "Показаны 101–200 из 1 000". `total` is the number of
// contacts of the list: all of them, or the found ones while a search or a group is on.
// A single contact is named by its number: "Показан 101-й из 101".
export function formatShownRange(from: number, to: number, total: number) {
  const count = total.toLocaleString("ru-RU");
  if (from === to) return `Показан ${from.toLocaleString("ru-RU")}-й из ${count}`;
  return `Показаны ${from.toLocaleString("ru-RU")}–${to.toLocaleString("ru-RU")} из ${count}`;
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

// "25 ноября", or "25 ноября 1990" when the year is known
export function formatBirthdayDate({ day, month, year }: Birthday) {
  const text = `${day} ${MONTH_NAMES[month - 1]}`;
  return year === null ? text : `${text} ${year}`;
}

// "1 год", "3 года", "35 лет"
export function formatAge(age: number) {
  return `${age} ${pluralize(age, ["год", "года", "лет"])}`;
}

// "сегодня", "завтра", "через 7 дней"
export function formatDaysUntil(days: number) {
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${pluralize(days, ["день", "дня", "дней"])}`;
}

// The line of a contact in the home block: "25 ноября · через 7 дней · исполнится 36".
// The date is the day of the nearest birthday without a year; "исполнится" only when the year of
// birth is known.
export function formatBirthdayRow(next: NextBirthday) {
  const parts = [
    formatBirthdayDate({ day: next.date.getDate(), month: next.date.getMonth() + 1, year: null }),
    formatDaysUntil(next.daysUntil),
  ];
  if (next.turning !== null) parts.push(`исполнится ${next.turning}`);
  return parts.join(" · ");
}

// The "Дата рождения" line of the contact card: "25 ноября 1990 · 35 лет", "25 ноября" or "Не указано"
export function formatBirthdayCard(birthday: Birthday | null, now: Date) {
  if (birthday === null) return "Не указано";
  const age = currentAge(birthday, now);
  const date = formatBirthdayDate(birthday);
  return age === null ? date : `${date} · ${formatAge(age)}`;
}
