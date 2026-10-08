import type { FeedbackKindValue, ImageType } from "./feedback";
import { IMAGE_EXTENSIONS } from "./feedback";
import { escapeHtml, getSmtpConfig, sendMail } from "./mail";

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

/** Mail settings for the feedback form: the shared SMTP config plus where reports are sent. Null when either is missing. */
export function getMailConfig() {
  const smtp = getSmtpConfig();
  const to = process.env.FEEDBACK_TO_EMAIL;
  if (!smtp || !to) return null;
  return { ...smtp, to };
}

export async function sendFeedbackEmail(input: FeedbackEmailInput) {
  const config = getMailConfig();
  if (!config) throw new Error("Email is not configured (SMTP_* / FEEDBACK_TO_EMAIL).");

  const message = buildFeedbackEmail(input);
  await sendMail({
    to: config.to,
    // Lets "Reply" go straight to a signed-in sender.
    replyTo: input.sender?.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
  });
}
