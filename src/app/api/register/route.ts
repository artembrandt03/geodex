import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { displayNameSchema } from "@/lib/profile/displayName";
import { clientIp, hashKey } from "@/lib/clientIp";
import { checkRateLimit, minutesUntil, recordHit } from "@/lib/rateLimit";
import { signupRule } from "@/lib/authLimits";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: displayNameSchema,
  // The signup form's consent box (age and the terms and privacy policy). The
  // form requires it, and so does the API, so it can't be skipped by calling it directly.
  acceptTerms: z.literal(true, {
    error: "Please confirm your age and accept the Terms of Use and Privacy Policy.",
  }),
});

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
    select: { id: true, email: true, displayName: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
