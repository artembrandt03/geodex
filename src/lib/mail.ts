import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

/**
 * SMTP settings come from env vars so any provider works (a Gmail app
 * password, Resend/SendGrid/Postmark SMTP, ...) without a code change.
 * Returns null when mail isn't configured, so callers can degrade instead
 * of failing.
 */
export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS after connecting.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user,
    pass,
    from: process.env.FEEDBACK_FROM_EMAIL ?? user,
  };
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: Mail.Attachment[];
}

/** Sends one email as "Geodex". Throws if mail isn't configured or the server refuses it. */
export async function sendMail(message: OutgoingMail): Promise<void> {
  const config = getSmtpConfig();
  if (!config) throw new Error("Email is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).");

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    // Fail within a request's lifetime rather than hanging on a dead server.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transport.sendMail({ from: `"Geodex" <${config.from}>`, ...message });
}

/** For putting user-supplied text into an HTML email. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
