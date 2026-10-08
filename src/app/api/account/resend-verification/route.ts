import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, limitAccountEmails, sendVerification } from "@/lib/accountEmail";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * Sends a new confirmation link to an unconfirmed account. The answer is the
 * same whether or not the address has an account (or is already confirmed), so
 * this can't be used to find out who is registered.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const { email } = parsed.data;

  const limited = await limitAccountEmails(request, email, "verify");
  if (limited) return limited;

  const user = await findUserByEmail(email);
  if (user && !user.emailVerifiedAt) {
    try {
      await sendVerification(user);
    } catch (error) {
      console.error("Could not send confirmation email", error);
    }
  }
  return NextResponse.json({ ok: true });
}
