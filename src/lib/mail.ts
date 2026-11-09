import nodemailer, { type Transporter } from "nodemailer";

// The text of the email is shown to the user, so it is in Russian

export const LOGIN_EMAIL_SUBJECT = "Вход в Личную CRM";
const LINK_MINUTES = 15;
const IGNORE_NOTE = "Если вы не запрашивали вход - просто проигнорируйте письмо";

// Mail programs do not understand CSS variables, so the colors of the email are the values of the
// tokens from src/styles/tokens.css
const COLOR_INK = "#241a3a"; // --color-ink: text, border and the dark button
const COLOR_PAPER = "#f1eaff"; // --color-paper: page background
const COLOR_WHITE = "#ffffff"; // --color-white: the letter body and the text on the button
const COLOR_INK_MUTED = "#5a4e72"; // --color-ink-muted: secondary text

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// The login email for a link: subject, HTML with the «Войти» button and the plain-text version
export function buildLoginEmail(url: string) {
  const href = escapeHtml(url);
  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:${COLOR_PAPER};font-family:Arial,Helvetica,sans-serif;color:${COLOR_INK};">
    <div style="max-width:480px;margin:0 auto;padding:24px;background:${COLOR_WHITE};border:2px solid ${COLOR_INK};">
      <h1 style="margin:0 0 16px;font-size:20px;">${LOGIN_EMAIL_SUBJECT}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">Нажмите кнопку, чтобы войти. Ссылка работает ${LINK_MINUTES} минут и только один раз.</p>
      <p style="margin:0 0 24px;"><a href="${href}" style="display:inline-block;padding:12px 24px;background:${COLOR_INK};color:${COLOR_WHITE};font-size:15px;font-weight:bold;text-decoration:none;">Войти</a></p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${COLOR_INK_MUTED};">Если кнопка не нажимается, откройте эту ссылку в браузере:<br><a href="${href}" style="color:${COLOR_INK_MUTED};word-break:break-all;">${href}</a></p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${COLOR_INK_MUTED};">${IGNORE_NOTE}</p>
    </div>
  </body>
</html>
`;
  const text = [
    "Нажмите на ссылку, чтобы войти. Она работает " + LINK_MINUTES + " минут и только один раз.",
    "",
    url,
    "",
    IGNORE_NOTE,
    "",
  ].join("\n");

  return { subject: LOGIN_EMAIL_SUBJECT, html, text };
}

let transport: Transporter | undefined;

// Created on the first email, not on import: `next build` runs without the settings
function getTransport() {
  if (transport) return transport;
  const smtpUrl = process.env.SMTP_URL;
  if (!smtpUrl) {
    throw new Error("SMTP_URL is not set: copy .env.example to .env and fill it in");
  }
  transport = nodemailer.createTransport(smtpUrl);
  return transport;
}

// Sends the login link. Where it goes is decided by SMTP_URL: Mailpit on the computer and in the
// tests, the real mail service on the server. Throws if the mail service does not accept the email.
export async function sendLoginEmail(to: string, url: string) {
  const from = process.env.MAIL_FROM;
  if (!from) {
    throw new Error("MAIL_FROM is not set: copy .env.example to .env and fill it in");
  }
  const { subject, html, text } = buildLoginEmail(url);
  await getTransport().sendMail({ from, to, subject, html, text });
}
