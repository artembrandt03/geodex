import { promises as dns } from "node:dns";

/**
 * Signup email screening. This can't prove a *mailbox* exists (only a
 * confirmation email can), but it rejects made-up domains like "poop.com"
 * (no mail server) and throwaway-inbox services, which covers the typos and
 * fakes that make up nearly all bad signups.
 */

/** Well-known throwaway-inbox domains. Not exhaustive; extend as abuse shows up. */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "nada.email",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "burnermail.io",
  "spamgourmet.com",
  "mytemp.email",
  "tempinbox.com",
  "discard.email",
  "moakt.com",
  "mailcatch.com",
  "spambox.us",
  "inboxbear.com",
]);

export type EmailDomainVerdict =
  | { ok: true }
  | { ok: false; reason: "invalid" | "disposable" | "no-mail-server" };

/** The part after the last "@", lowercased and without a trailing dot, or null if there isn't one. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return domain.includes(".") ? domain : null;
}

export function isDisposableDomain(domain: string): boolean {
  // Also catches subdomains of a listed service (x.mailinator.com).
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

export interface MxRecord {
  exchange: string;
  priority: number;
}

export type MxResolver = (domain: string) => Promise<MxRecord[]>;

const DNS_TIMEOUT_MS = 3_000;

const resolveMxWithTimeout: MxResolver = (domain) =>
  Promise.race([
    dns.resolveMx(domain),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS),
    ),
  ]);

/** DNS answers that definitively mean "this domain takes no email". Anything else (timeouts, SERVFAIL) is inconclusive. */
const NO_MAIL_CODES = new Set(["ENOTFOUND", "ENODATA"]);

/**
 * Can this domain receive email? True when it publishes an MX record. A null MX
 * (RFC 7505: a single "." exchange) is a deliberate "no mail here". If DNS
 * itself is failing we let the address through rather than turn away an honest
 * user over a network hiccup; the check is a filter, not the only defense.
 */
export async function domainCanReceiveMail(
  domain: string,
  resolveMx: MxResolver = resolveMxWithTimeout,
): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records.some((record) => record.exchange !== "" && record.exchange !== ".");
  } catch (error) {
    const code = (error as { code?: string }).code;
    return !(code && NO_MAIL_CODES.has(code));
  }
}

export async function checkEmailDomain(
  email: string,
  resolveMx: MxResolver = resolveMxWithTimeout,
): Promise<EmailDomainVerdict> {
  const domain = emailDomain(email);
  if (!domain) return { ok: false, reason: "invalid" };
  if (isDisposableDomain(domain)) return { ok: false, reason: "disposable" };
  if (!(await domainCanReceiveMail(domain, resolveMx))) return { ok: false, reason: "no-mail-server" };
  return { ok: true };
}

/** What to tell the player; deliberately specific, since it only involves the address they typed. */
export function emailDomainMessage(reason: "invalid" | "disposable" | "no-mail-server"): string {
  switch (reason) {
    case "disposable":
      return "Temporary email addresses can't be used. Please use your regular email.";
    case "no-mail-server":
      return "That email's domain doesn't seem to receive mail. Please check for typos or use a different address.";
    default:
      return "Please enter a valid email address.";
  }
}
