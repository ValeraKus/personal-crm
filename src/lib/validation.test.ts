import { describe, expect, it } from "vitest";

import {
  chooseNewGroup,
  contactSchema,
  foldGroupName,
  groupNameSchema,
  parseBirthday,
  parseLoginEmail,
} from "@/lib/validation";

// Raw values of the contact form, as the browser sends them: every field is text
function contactForm(
  fields: {
    keepInTouchFrequency?: string;
    keepInTouchDays?: string;
    birthdayDay?: string;
    birthdayMonth?: string;
    birthdayYear?: string;
  } = {},
) {
  return {
    name: "Анна Смирнова",
    about: "",
    howWeMet: "",
    phone: "",
    email: "",
    keepInTouchFrequency: "",
    keepInTouchDays: "",
    birthdayDay: "",
    birthdayMonth: "",
    birthdayYear: "",
    ...fields,
  };
}

// Scenarios of the "Частота общения с контактом" and "Свой срок" requirements
// in openspec/specs/keep-in-touch/spec.md that the form rules decide on their own
describe("contactSchema: how often to keep in touch", () => {
  it("saves «not set» when the frequency is not chosen", () => {
    const contact = contactSchema.parse(contactForm());
    expect(contact.keepInTouchFrequency).toBeNull();
    expect(contact.keepInTouchDays).toBeNull();
  });

  it("saves a custom term of 10 days", () => {
    const contact = contactSchema.parse(
      contactForm({ keepInTouchFrequency: "days", keepInTouchDays: "10" }),
    );
    expect(contact.keepInTouchFrequency).toBe("days");
    expect(contact.keepInTouchDays).toBe(10);
  });

  // "2.5" is the same fraction as "2,5" typed with a dot
  it.each(["", "0", "400", "2,5", "2.5"])("rejects %j as the number of days", (days) => {
    const result = contactSchema.safeParse(
      contactForm({ keepInTouchFrequency: "days", keepInTouchDays: days }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["keepInTouchDays"],
        message: "Укажите число дней от 1 до 365",
      }),
    ]);
  });

  it("keeps seven days a custom term, not a week", () => {
    const contact = contactSchema.parse(
      contactForm({ keepInTouchFrequency: "days", keepInTouchDays: "7" }),
    );
    expect(contact.keepInTouchFrequency).toBe("days");
    expect(contact.keepInTouchDays).toBe(7);
  });
});

describe("groupNameSchema", () => {
  it("rejects an empty name", () => {
    const result = groupNameSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Укажите название группы");
  });

  it("rejects a name of spaces only", () => {
    const result = groupNameSchema.safeParse("   ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Укажите название группы");
  });

  it("rejects a name longer than 50 characters", () => {
    const result = groupNameSchema.safeParse("а".repeat(51));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Не длиннее 50 символов");
  });

  it("accepts a name of exactly 50 characters", () => {
    expect(groupNameSchema.safeParse("а".repeat(50)).success).toBe(true);
  });

  it("trims spaces around the name", () => {
    expect(groupNameSchema.parse("  Теннис  ")).toBe("Теннис");
  });
});

describe("foldGroupName", () => {
  it("ignores case", () => {
    expect(foldGroupName("Теннис")).toBe(foldGroupName("теннис"));
  });

  it("treats ё and е as one letter", () => {
    expect(foldGroupName("Тётя")).toBe(foldGroupName("тетя"));
  });

  it("keeps different names different", () => {
    expect(foldGroupName("Семья")).not.toBe(foldGroupName("Друзья"));
  });
});

// What the "Добавить" button of the contact form does with the typed name: scenarios of the
// "Название группы" and "Группы в форме контакта" requirements in openspec/specs/contact-groups/spec.md
describe("chooseNewGroup", () => {
  const tennis = { id: 1, name: "Теннис" };
  const aunt = { id: 2, name: "Тётя" };

  it.each(["", "   "])("shows an error for the empty name %j", (text) => {
    expect(chooseNewGroup(text, [], [])).toEqual({
      kind: "error",
      message: "Укажите название группы",
    });
  });

  it("shows an error for a name longer than 50 characters", () => {
    expect(chooseNewGroup("а".repeat(51), [], [])).toEqual({
      kind: "error",
      message: "Не длиннее 50 символов",
    });
  });

  it("adds a new group", () => {
    expect(chooseNewGroup("Аналитики", [tennis], [])).toEqual({ kind: "new", name: "Аналитики" });
  });

  it("adds a new group without the spaces around its name", () => {
    expect(chooseNewGroup("  Теннис  ", [], [])).toEqual({ kind: "new", name: "Теннис" });
  });

  it("checks the existing group when only the case differs", () => {
    expect(chooseNewGroup("теннис", [aunt, tennis], [])).toEqual({ kind: "existing", id: 1 });
  });

  it("checks the existing group when only «е» and «ё» differ", () => {
    expect(chooseNewGroup("тетя", [tennis, aunt], [])).toEqual({ kind: "existing", id: 2 });
  });

  it("does nothing when the same new group is already added in the form", () => {
    expect(chooseNewGroup("аналитики", [tennis], ["Аналитики"])).toEqual({ kind: "repeat" });
  });
});

// Scenarios of the "Проверка почты" requirement in openspec/specs/user-auth/spec.md
describe("parseLoginEmail", () => {
  it("rejects an address without a domain", () => {
    expect(parseLoginEmail("ivan@")).toEqual({ ok: false, message: "Проверьте адрес почты" });
  });

  it("rejects an empty field and a field of spaces", () => {
    expect(parseLoginEmail("")).toEqual({ ok: false, message: "Проверьте адрес почты" });
    expect(parseLoginEmail("   ")).toEqual({ ok: false, message: "Проверьте адрес почты" });
  });

  it("rejects text that is not an address", () => {
    expect(parseLoginEmail("ivan")).toEqual({ ok: false, message: "Проверьте адрес почты" });
    expect(parseLoginEmail("ivan example.com")).toEqual({
      ok: false,
      message: "Проверьте адрес почты",
    });
  });

  it("rejects a value that is not text", () => {
    expect(parseLoginEmail(undefined)).toEqual({ ok: false, message: "Проверьте адрес почты" });
    expect(parseLoginEmail(null)).toEqual({ ok: false, message: "Проверьте адрес почты" });
    expect(parseLoginEmail(42)).toEqual({ ok: false, message: "Проверьте адрес почты" });
  });

  it("strips spaces at the edges and ignores letter case", () => {
    expect(parseLoginEmail("  Ivan@Example.com  ")).toEqual({
      ok: true,
      email: "ivan@example.com",
    });
  });

  it("gives the same address for the same address typed differently", () => {
    expect(parseLoginEmail("IVAN@EXAMPLE.COM")).toEqual(parseLoginEmail(" ivan@example.com"));
  });
});

// Scenarios of the «Проверка даты рождения» requirement in
// openspec/changes/birthdays/specs/birthdays/spec.md. «Сегодня» is 18 November 2026.
describe("parseBirthday", () => {
  const now = new Date(2026, 10, 18, 12);

  function parse(day: string, month: string, year: string) {
    return parseBirthday({ day, month, year }, now);
  }

  const MISSING = "Укажите день и месяц";
  const NO_SUCH_DATE = "Такой даты нет";
  const BAD_YEAR = "Укажите год от 1900 до 2026";

  it("has no birthday when all three parts are empty", () => {
    expect(parse("", "", "")).toEqual({ ok: true, day: null, month: null, year: null });
  });

  it("treats spaces as empty", () => {
    expect(parse("  ", " ", "")).toEqual({ ok: true, day: null, month: null, year: null });
  });

  it("takes a day and a month without a year", () => {
    expect(parse("25", "11", "")).toEqual({ ok: true, day: 25, month: 11, year: null });
  });

  it("takes a day, a month and a year", () => {
    expect(parse("25", "11", "1990")).toEqual({ ok: true, day: 25, month: 11, year: 1990 });
  });

  it("asks for the day and the month when only the month is given", () => {
    expect(parse("", "11", "")).toEqual({ ok: false, message: MISSING });
  });

  it("asks for the day and the month when only the day is given", () => {
    expect(parse("25", "", "")).toEqual({ ok: false, message: MISSING });
  });

  it("asks for the day and the month when only the year is given", () => {
    expect(parse("", "", "1990")).toEqual({ ok: false, message: MISSING });
  });

  it.each([
    ["31", "4"],
    ["0", "11"],
    ["32", "11"],
    ["2,5", "11"],
    ["2.5", "11"],
    ["-1", "11"],
    ["abc", "11"],
    ["25", "0"],
    ["25", "13"],
    ["25", "abc"],
  ])("says there is no such date for day %j of month %j", (day, month) => {
    expect(parse(day, month, "")).toEqual({ ok: false, message: NO_SUCH_DATE });
  });

  it("takes 29 February without a year", () => {
    expect(parse("29", "2", "")).toEqual({ ok: true, day: 29, month: 2, year: null });
  });

  it("refuses 29 February of a year that is not a leap one", () => {
    expect(parse("29", "2", "2001")).toEqual({ ok: false, message: NO_SUCH_DATE });
    expect(parse("29", "2", "1900")).toEqual({ ok: false, message: NO_SUCH_DATE });
  });

  it("takes 29 February of a leap year", () => {
    expect(parse("29", "2", "2000")).toEqual({ ok: true, day: 29, month: 2, year: 2000 });
  });

  it.each(["1899", "2027", "90", "19а0", "1990.5", "-1990", "99999"])(
    "refuses the year %j",
    (year) => {
      expect(parse("25", "11", year)).toEqual({ ok: false, message: BAD_YEAR });
    },
  );

  it("takes the limits of the year: 1900 and the current one", () => {
    expect(parse("25", "11", "1900")).toMatchObject({ ok: true, year: 1900 });
    expect(parse("1", "1", "2026")).toMatchObject({ ok: true, year: 2026 });
  });

  it("counts the last year from the current date, not from a number in the code", () => {
    expect(
      parseBirthday({ day: "1", month: "1", year: "2027" }, new Date(2027, 5, 1)),
    ).toMatchObject({ ok: true, year: 2027 });
    expect(parseBirthday({ day: "1", month: "1", year: "2028" }, new Date(2027, 5, 1))).toEqual({
      ok: false,
      message: "Укажите год от 1900 до 2027",
    });
  });

  it("refuses a date in the future", () => {
    expect(parse("25", "11", "2026")).toEqual({
      ok: false,
      message: "Дата рождения не может быть в будущем",
    });
    expect(parse("19", "11", "2026")).toEqual({
      ok: false,
      message: "Дата рождения не может быть в будущем",
    });
  });

  it("takes today and yesterday", () => {
    expect(parse("18", "11", "2026")).toMatchObject({ ok: true });
    expect(parse("17", "11", "2026")).toMatchObject({ ok: true });
  });

  it("does not call a date without a year a future one", () => {
    expect(parse("25", "12", "")).toMatchObject({ ok: true });
  });

  it("shows the missing day before the bad year", () => {
    expect(parse("", "11", "1899")).toEqual({ ok: false, message: MISSING });
  });

  it("shows the bad year before the missing date", () => {
    expect(parse("31", "4", "1899")).toEqual({ ok: false, message: BAD_YEAR });
  });
});

describe("contactSchema: birthday", () => {
  it("saves three empty parts as no birthday", () => {
    const contact = contactSchema.parse(contactForm());
    expect(contact).toMatchObject({ birthdayDay: null, birthdayMonth: null, birthdayYear: null });
  });

  it("saves the three numbers", () => {
    const contact = contactSchema.parse(
      contactForm({ birthdayDay: "25", birthdayMonth: "11", birthdayYear: "1990" }),
    );
    expect(contact).toMatchObject({ birthdayDay: 25, birthdayMonth: 11, birthdayYear: 1990 });
  });

  it("puts one error under the day, the first field of the birthday", () => {
    const result = contactSchema.safeParse(contactForm({ birthdayMonth: "11" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["birthdayDay"], message: "Укажите день и месяц" }),
    ]);
  });

  it("shows the year limit of the current year", () => {
    const year = new Date().getFullYear();
    const result = contactSchema.safeParse(
      contactForm({ birthdayDay: "1", birthdayMonth: "1", birthdayYear: String(year + 1) }),
    );
    expect(result.error?.issues[0].message).toBe(`Укажите год от 1900 до ${year}`);
  });

  it("does not hide a birthday error behind an error of another field", () => {
    const result = contactSchema.safeParse({
      ...contactForm({ birthdayMonth: "11" }),
      name: "",
    });
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["name", "birthdayDay"]));
  });
});
