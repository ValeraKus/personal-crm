import { describe, expect, it } from "vitest";

import { contactSchema, foldGroupName, groupNameSchema } from "@/lib/validation";

// Raw values of the contact form, as the browser sends them: every field is text
function contactForm(fields: { keepInTouchFrequency?: string; keepInTouchDays?: string } = {}) {
  return {
    name: "Анна Смирнова",
    about: "",
    howWeMet: "",
    phone: "",
    email: "",
    keepInTouchFrequency: "",
    keepInTouchDays: "",
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
