import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeToken, issueToken } from "@/lib/emailTokens";

const schema = z.object({ token: z.string().min(10).max(200) });

/** Confirms an address from the emailed link. A POST (the page sends it on load), so link scanners that merely GET the URL can't use the token up. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "This confirmation link isn't valid." }, { status: 400 });
  }

  const userId = await consumeToken(parsed.data.token, "VERIFY_EMAIL");
  if (!userId) {
    return NextResponse.json(
      { error: "This confirmation link is invalid or has expired. Log in to get a new one." },
      { status: 400 },
    );
  }

  await prisma.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  // Following the link proved the inbox is theirs, so the success page may log them
  // straight in with this one-time ticket (the same trust a password reset link carries).
  // It's only handed out here, to whoever just used the single-use link.
  const loginToken = await issueToken(userId, "AUTO_LOGIN");
  return NextResponse.json({ ok: true, loginToken });
}
