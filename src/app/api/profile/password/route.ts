import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/profile/password";
import { checkCurrentPassword, passwordLimitedMessage } from "@/lib/passwordCheck";

/**
 * Changes the signed-in player's password. The current password has to be
 * right (a stolen, still-signed-in session alone can't lock the owner out),
 * and the new one is hashed exactly like at signup.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const check = await checkCurrentPassword(session.user.id, user.passwordHash, currentPassword);
  if (!check.ok) {
    return check.reason === "limited"
      ? NextResponse.json({ error: passwordLimitedMessage(check.minutes) }, { status: 429 })
      : NextResponse.json({ error: "Your current password isn't right" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });

  return NextResponse.json({ ok: true });
}
