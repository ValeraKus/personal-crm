// Mailpit is the mail catcher of the tests: the login emails of the app land in it instead of
// going to real addresses. The tests read the link of the email from it, like a person from a mailbox.
// Its address comes from MAILPIT_URL; the default is the one of docker-compose.yml and of CI.

import { randomUUID } from "node:crypto";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

type MessageSummary = { ID: string; Created: string };
type Message = {
  Subject: string;
  Text: string;
  HTML: string;
  From: { Name: string; Address: string };
};

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`Mailpit ${init?.method ?? "GET"} ${path} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

// An address that nobody has used: every test gets its own user, its own empty list of contacts
// and its own limit of emails, so tests do not get in the way of each other
export function newEmail(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}@example.com`;
}

// Emails sent to the address, the newest first
async function messagesTo(email: string) {
  const { messages } = await mailpit<{ messages: MessageSummary[] }>(
    `/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=50`,
  );
  return messages;
}

export async function countEmailsTo(email: string) {
  return (await messagesTo(email)).length;
}

export async function readLatestEmail(email: string) {
  const [latest] = await messagesTo(email);
  if (!latest) throw new Error(`No email to ${email} in Mailpit`);
  return mailpit<Message>(`/api/v1/message/${latest.ID}`);
}

// The login link of the email: the first address in its text
export function linkOf(message: Message) {
  const link = message.Text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error("The email has no link");
  return link;
}

// The link under the «Войти» button of the HTML version. In HTML the & of the address is written as &amp;.
export function buttonLinkOf(message: Message) {
  const href = message.HTML.match(/<a [^>]*href="([^"]+)"[^>]*>\s*Войти\s*<\/a>/)?.[1];
  if (!href) throw new Error("The email has no «Войти» button");
  return href.replaceAll("&amp;", "&");
}

// Waits until the email number `count` to the address arrives (the app sends it a moment after the
// click) and returns the links of all its emails, the oldest first
export async function waitForLoginLinks(email: string, count = 1) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const messages = await messagesTo(email);
    if (messages.length >= count) {
      const full = await Promise.all(
        messages.map((message) => mailpit<Message>(`/api/v1/message/${message.ID}`)),
      );
      return full.reverse().map(linkOf);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Email number ${count} to ${email} did not arrive in Mailpit in 10 seconds`);
}

// The link of the newest email to the address
export async function waitForLoginLink(email: string, count = 1) {
  return (await waitForLoginLinks(email, count)).at(-1)!;
}

// How many emails Mailpit holds in all: to check that no email left at all
export async function countAllEmails() {
  const { total } = await mailpit<{ total: number }>("/api/v1/messages?limit=1");
  return total;
}

// Chaos mode of Mailpit: while it is on, the SMTP server refuses every email. This is how the
// tests get "the mail service did not accept the email".
export async function makeMailFail(fail: boolean) {
  const probability = fail ? 100 : 0;
  await mailpit("/api/v1/chaos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Sender: { ErrorCode: 451, Probability: probability },
      Recipient: { ErrorCode: 451, Probability: probability },
      Authentication: { ErrorCode: 535, Probability: 0 },
    }),
  });
}
