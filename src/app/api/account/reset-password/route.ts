import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/emailTokens";
import { hashKey } from "@/lib/clientIp";
import { clearHits } from "@/lib/rateLimit";
import { LOGIN_EMAIL_BUCKET } from "@/lib/authLimits";
import { normalizeEmail } from "@/lib/accountEmail";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

/** Sets a new password from an emailed reset link (single use, one hour). */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { token, password } = parsed.data;

  const userId = await consumeToken(token, "RESET_PASSWORD");
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: { email: true },
  });
  // Following the emailed link also proves the inbox is theirs, so an
  // unconfirmed account becomes confirmed (a confirmed one keeps its date).
  await prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  // Any other link still in the wild (an older reset, a confirmation) is now moot.
  await prisma.emailToken.deleteMany({ where: { userId } });
  // A locked-out player who just proved who they are shouldn't have to wait out the lockout.
  await clearHits(LOGIN_EMAIL_BUCKET, hashKey(normalizeEmail(user.email)));

  return NextResponse.json({ ok: true });
}
