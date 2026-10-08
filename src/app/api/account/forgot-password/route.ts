import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, limitAccountEmails, sendPasswordReset } from "@/lib/accountEmail";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * Emails a password reset link if the address has an account. The answer is
 * always the same, so it can't be used to find out who is registered. (An
 * unconfirmed account gets one too: using the link proves the inbox is theirs,
 * so it confirms the address as well.)
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const { email } = parsed.data;

  const limited = await limitAccountEmails(request, email, "reset");
  if (limited) return limited;

  const user = await findUserByEmail(email);
  if (user) {
    try {
      await sendPasswordReset(user);
    } catch (error) {
      console.error("Could not send password reset email", error);
    }
  }
  return NextResponse.json({ ok: true });
}
