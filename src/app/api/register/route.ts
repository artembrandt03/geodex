import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { displayNameSchema } from "@/lib/profile/displayName";
import { clientIp, hashKey } from "@/lib/clientIp";
import { checkRateLimit, minutesUntil, recordHit } from "@/lib/rateLimit";
import { signupRule } from "@/lib/authLimits";
import { checkEmailDomain, emailDomainMessage } from "@/lib/emailDomain";
import {
  emailBudgetResponse,
  findUserByEmail,
  limitAccountEmails,
  sendVerification,
} from "@/lib/accountEmail";
import { emailBudgetAvailable } from "@/lib/emailBudget";
import { getSmtpConfig } from "@/lib/mail";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: displayNameSchema,
  // The signup form's consent box (age and the terms and privacy policy). The
  // form requires it, and so does the API, so it can't be skipped by calling it directly.
  acceptTerms: z.literal(true, {
    error: "Please confirm your age and accept the Terms of Use and Privacy Policy.",
  }),
});

const EMAIL_FAILED = {
  error: "We couldn't send the confirmation email. Please check the address and try again in a moment.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { email, password, displayName } = parsed.data;

  // Throttle per IP: a script minting accounts, or probing which emails are
  // taken (a taken one is reported below), gets cut off. Every attempt that got
  // this far counts, whether or not the account ends up created.
  const ip = clientIp(request);
  if (ip) {
    const rule = signupRule(hashKey(ip));
    const state = await checkRateLimit(rule);
    if (state.limited) {
      const minutes = minutesUntil(state.retryAfterMs);
      return NextResponse.json(
        {
          error: `Too many sign-up attempts. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
        },
        { status: 429 },
      );
    }
    await recordHit(rule.bucket, rule.key);
  }

  // Refuse made-up domains and throwaway-inbox services. After the throttle, so
  // the DNS lookups it costs can't be used to hammer us.
  const domainCheck = await checkEmailDomain(email);
  if (!domainCheck.ok) {
    return NextResponse.json({ error: emailDomainMessage(domainCheck.reason) }, { status: 400 });
  }

  const existing = await findUserByEmail(email);

  // A confirmed account already owns this address: say so, and the form sends
  // the person to log in (or reset their password) instead.
  if (existing?.emailVerifiedAt) {
    return NextResponse.json(
      { error: "An account with that email already exists. Please log in instead.", code: "account_exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // The address is signed up but never confirmed (they closed the tab, or the
  // email got lost): treat this as a fresh attempt. The newest submission's
  // password and name replace the old ones, and a new link is sent; nothing
  // is usable until someone with access to the inbox clicks it.
  if (existing) {
    const limited = await limitAccountEmails(request, email, "verify");
    if (limited) return limited;
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, displayName },
      select: { id: true, email: true, displayName: true },
    });
    try {
      await sendVerification(user);
    } catch (error) {
      console.error("Could not send confirmation email", error);
      return NextResponse.json(EMAIL_FAILED, { status: 502 });
    }
    return NextResponse.json({ pendingVerification: true }, { status: 201 });
  }

  // Don't create an account we can't email: with the day's budget spent, ask them to come back.
  if (getSmtpConfig() && !(await emailBudgetAvailable())) return emailBudgetResponse();

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
    select: { id: true, email: true, displayName: true },
  });

  try {
    await sendVerification(user);
  } catch (error) {
    // No way to confirm means no usable account: undo it so they can try again.
    console.error("Could not send confirmation email", error);
    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json(EMAIL_FAILED, { status: 502 });
  }

  return NextResponse.json({ pendingVerification: true }, { status: 201 });
}
