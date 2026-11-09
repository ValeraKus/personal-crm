import { describe, expect, it } from "vitest";

import { buildLoginEmail } from "@/lib/mail";

const LINK = "http://localhost:3000/api/auth/magic-link/verify?token=abc123&callbackURL=%2F";

// Scenario "Что в письме" of the "Письмо со ссылкой" requirement in
// openspec/specs/user-auth/spec.md
describe("buildLoginEmail", () => {
  it("has the subject «Вход в Личную CRM»", () => {
    expect(buildLoginEmail(LINK).subject).toBe("Вход в Личную CRM");
  });

  it("has a «Войти» button that leads to the link", () => {
    const { html } = buildLoginEmail(LINK);
    // In HTML the & of the address is written as &amp;
    expect(html).toMatch(
      /<a [^>]*href="[^"]*token=abc123&amp;callbackURL=%2F"[^>]*>\s*Войти\s*<\/a>/,
    );
  });

  it("says the link works 15 minutes", () => {
    const { html, text } = buildLoginEmail(LINK);
    expect(html).toContain("15 минут");
    expect(text).toContain("15 минут");
  });

  it("says to ignore the email if the login was not requested", () => {
    const { html, text } = buildLoginEmail(LINK);
    const phrase = "Если вы не запрашивали вход - просто проигнорируйте письмо";
    expect(html).toContain(phrase);
    expect(text).toContain(phrase);
  });

  it("repeats the link in plain text, for mail programs that show no buttons", () => {
    expect(buildLoginEmail(LINK).text).toContain(LINK);
  });

  it("does not let the link break out of the HTML", () => {
    const { html } = buildLoginEmail('http://x.test/?a="><script>alert(1)</script>');
    expect(html).not.toContain("<script>");
  });
});
