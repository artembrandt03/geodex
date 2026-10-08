import { escapeHtml, sendMail } from "./mail";

/**
 * The account emails. Each is plain text plus a small HTML version in the
 * app's parchment colours; inline styles only, since mail clients ignore
 * stylesheets. The link is also written out in full so it can be copied if a
 * client mangles the button.
 */

interface Content {
  subject: string;
  text: string;
  html: string;
}

function layout(opts: { heading: string; intro: string; buttonLabel: string; url: string; outro: string }): string {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;padding:24px;background:#f4ead5;color:#2b2013">
<h2 style="margin:0 0 12px;font-size:22px">${escapeHtml(opts.heading)}</h2>
<p style="line-height:1.5;margin:0 0 20px">${opts.intro}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#7a4b1e;color:#fff8e7;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">${escapeHtml(opts.buttonLabel)}</a></p>
<p style="line-height:1.5;margin:0 0 6px;font-size:13px;color:#6b5636">Or paste this link into your browser:</p>
<p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${escapeHtml(opts.url)}" style="color:#7a4b1e">${escapeHtml(opts.url)}</a></p>
<p style="line-height:1.5;margin:0;font-size:13px;color:#6b5636">${opts.outro}</p>
</div>`;
}

export function buildVerificationEmail(input: { displayName: string; url: string }): Content {
  const name = input.displayName;
  return {
    subject: "Confirm your Geodex account",
    text: `Hi ${name},

Welcome to Geodex! Confirm your email address to activate your account:

${input.url}

The link works for 24 hours. If you didn't sign up, you can ignore this email and nothing will happen.`,
    html: layout({
      heading: "Confirm your email",
      intro: `Hi ${escapeHtml(name)}, welcome to Geodex! Confirm your email address to activate your account.`,
      buttonLabel: "Confirm my email",
      url: input.url,
      outro: "The link works for 24 hours. If you didn't sign up, you can ignore this email and nothing will happen.",
    }),
  };
}

export function buildPasswordResetEmail(input: { displayName: string; url: string }): Content {
  const name = input.displayName;
  return {
    subject: "Reset your Geodex password",
    text: `Hi ${name},

Someone asked to reset the password for your Geodex account. To choose a new one, open:

${input.url}

The link works for 1 hour and only once. If it wasn't you, ignore this email: your password stays the same.`,
    html: layout({
      heading: "Reset your password",
      intro: `Hi ${escapeHtml(name)}, someone asked to reset the password for your Geodex account.`,
      buttonLabel: "Choose a new password",
      url: input.url,
      outro:
        "The link works for 1 hour and only once. If it wasn't you, ignore this email: your password stays the same.",
    }),
  };
}

export async function sendVerificationEmail(to: string, displayName: string, url: string) {
  await sendMail({ to, ...buildVerificationEmail({ displayName, url }) });
}

export async function sendPasswordResetEmail(to: string, displayName: string, url: string) {
  await sendMail({ to, ...buildPasswordResetEmail({ displayName, url }) });
}
