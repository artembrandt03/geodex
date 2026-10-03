import nodemailer from "nodemailer";
import type { FeedbackKindValue, ImageType } from "./feedback";
import { IMAGE_EXTENSIONS } from "./feedback";

export interface FeedbackEmailInput {
  id: string;
  kind: FeedbackKindValue;
  subject: string;
  description: string;
  sender: { displayName: string; email: string } | null;
  userAgent: string | null;
  pageUrl?: string;
  viewport?: string;
  submittedAt: Date;
  attachments: { bytes: Uint8Array; type: ImageType }[];
}

const KIND_LABEL: Record<FeedbackKindValue, string> = {
  BUG: "Bug report",
  FEEDBACK: "Feedback",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pure: turns a submission into the subject/text/html/attachments of an email. */
export function buildFeedbackEmail(input: FeedbackEmailInput) {
  const label = KIND_LABEL[input.kind];
  const sender = input.sender
    ? `${input.sender.displayName} <${input.sender.email}> (signed in)`
    : "Guest (not signed in)";

  const meta: [string, string][] = [
    ["Type", label],
    ["From", sender],
    ["Submitted", input.submittedAt.toISOString()],
    ["Page", input.pageUrl ?? "unknown"],
    ["Viewport", input.viewport ?? "unknown"],
    ["Browser", input.userAgent ?? "unknown"],
    ["Screenshots", String(input.attachments.length)],
    ["Report ID", input.id],
  ];

  const text = [
    input.description,
    "",
    "---",
    ...meta.map(([k, v]) => `${k}: ${v}`),
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;max-width:640px">
<h2 style="margin:0 0 4px">${escapeHtml(input.subject)}</h2>
<p style="margin:0 0 16px;color:#6b5636">${escapeHtml(label)}</p>
<p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(input.description)}</p>
<hr style="border:none;border-top:1px solid #ccc;margin:20px 0">
<table style="font-size:13px;color:#444">${meta
    .map(
      ([k, v]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#888">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>
</div>`;

  return {
    subject: `[Geodex ${label.toLowerCase()}] ${input.subject}`,
    text,
    html,
    // Named by us from the detected type, never from the user's filename.
    attachments: input.attachments.map((a, i) => ({
      filename: `screenshot-${i + 1}.${IMAGE_EXTENSIONS[a.type]}`,
      content: Buffer.from(a.bytes),
      contentType: a.type,
    })),
  };
}

/**
 * SMTP settings come from env vars so any provider works (a Gmail app
 * password, Resend/SendGrid/Postmark SMTP, ...) without a code change.
 * Returns null when mail isn't configured, so callers can degrade instead
 * of failing.
 */
export function getMailConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.FEEDBACK_TO_EMAIL;
  if (!host || !user || !pass || !to) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS after connecting.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user,
    pass,
    to,
    from: process.env.FEEDBACK_FROM_EMAIL ?? user,
  };
}

export async function sendFeedbackEmail(input: FeedbackEmailInput) {
  const config = getMailConfig();
  if (!config) throw new Error("Email is not configured (SMTP_* / FEEDBACK_TO_EMAIL).");

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

  const message = buildFeedbackEmail(input);
  await transport.sendMail({
    from: `"Geodex" <${config.from}>`,
    to: config.to,
    // Lets "Reply" go straight to a signed-in sender.
    replyTo: input.sender?.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
  });
}
