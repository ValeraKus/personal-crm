import { describe, expect, it } from "vitest";

import { foldGroupName, groupNameSchema } from "@/lib/validation";

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
