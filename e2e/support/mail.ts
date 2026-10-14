import { MAIL_API } from "./env";

export interface SinkMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: number;
  replyTo: string | null;
  receivedAt: number;
}

/** Every message the app has sent to this address so far. */
export async function mailsTo(email: string): Promise<SinkMail[]> {
  const response = await fetch(`${MAIL_API}/messages?to=${encodeURIComponent(email.toLowerCase())}`);
  return (await response.json()) as SinkMail[];
}

/**
 * Waits for messages to this address whose subject matches, until there are at
 * least `count` of them. Returns them oldest first, so the newest is the last.
 */
export async function waitForMails(
  email: string,
  subject: RegExp,
  { count = 1, timeout = 10_000 }: { count?: number; timeout?: number } = {},
): Promise<SinkMail[]> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const matching = (await mailsTo(email)).filter((m) => subject.test(m.subject));
    if (matching.length >= count) return matching;
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for ${count} mail(s) matching ${subject} to ${email}; got ${matching.length}.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** The first link in a message's plain text. */
export function linkIn(mail: SinkMail): string {
  const match = mail.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No link in message "${mail.subject}".`);
  return match[0];
}

/** The `token` query parameter of a confirmation or reset link. */
export function tokenIn(mail: SinkMail): string {
  const token = new URL(linkIn(mail)).searchParams.get("token");
  if (!token) throw new Error(`No token in message "${mail.subject}".`);
  return token;
}

export const CONFIRM_SUBJECT = /Confirm your Geodex account/;
export const RESET_SUBJECT = /Reset your Geodex password/;
