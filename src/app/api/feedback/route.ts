import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  detectImageType,
  feedbackFieldsSchema,
  type ImageType,
} from "@/lib/feedback";
import { getMailConfig, sendFeedbackEmail } from "@/lib/feedbackEmail";

const RATE_LIMIT_PER_HOUR = 2;
const HOUR_MS = 60 * 60 * 1000;
// A hair over the attachment cap, to cover the multipart framing + text fields.
const MAX_REQUEST_BYTES = MAX_TOTAL_ATTACHMENT_BYTES + 256 * 1024;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Best guess at the sender's IP from the proxy headers (Netlify, then generic). */
function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/** Rate-limit key: an HMAC of the IP, so the address itself is never stored. */
function hashIp(ip: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "geodex-feedback")
    .update(ip)
    .digest("hex");
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return fail("That's too large to send. Try smaller or fewer screenshots.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Couldn't read that submission.", 400);
  }

  const parsed = feedbackFieldsSchema.safeParse({
    kind: form.get("kind"),
    subject: form.get("subject"),
    description: form.get("description"),
    pageUrl: form.get("pageUrl") ?? undefined,
    viewport: form.get("viewport") ?? undefined,
    website: form.get("website") ?? undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid submission.", 400);
  }
  const fields = parsed.data;

  // Honeypot filled in: act like it worked, but drop it.
  if (fields.website) return NextResponse.json({ ok: true });

  // Screenshots: count/size limits, then verify they're really images.
  const files = form
    .getAll("screenshots")
    .filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length > MAX_ATTACHMENTS) {
    return fail(`You can attach up to ${MAX_ATTACHMENTS} screenshots.`, 400);
  }
  let total = 0;
  const attachments: { bytes: Uint8Array; type: ImageType }[] = [];
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return fail("Each screenshot must be under 2 MB.", 413);
    }
    total += file.size;
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
      return fail("The screenshots together are too large.", 413);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return fail("Screenshots must be PNG, JPEG, GIF or WebP images.", 400);
    attachments.push({ bytes, type });
  }

  const ip = clientIp(request);
  const ipHash = ip ? hashIp(ip) : null;
  // Without an IP (e.g. plain local dev) there's no sender to rate-limit.
  if (ipHash) {
    const recent = await prisma.feedback.count({
      where: { ipHash, createdAt: { gt: new Date(Date.now() - HOUR_MS) } },
    });
    if (recent >= RATE_LIMIT_PER_HOUR) {
      return fail("You've been rate limited. Please come back in an hour.", 429);
    }
  }

  const session = await auth();
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  const record = await prisma.feedback.create({
    data: {
      kind: fields.kind,
      subject: fields.subject,
      description: fields.description,
      userId: session?.user?.id ?? null,
      ipHash,
      userAgent,
      attachmentCount: attachments.length,
    },
  });

  // Stored either way; the email is best-effort and its outcome is recorded
  // on the row, so a mail outage never turns into "your message was lost".
  if (getMailConfig()) {
    try {
      await sendFeedbackEmail({
        id: record.id,
        kind: fields.kind,
        subject: fields.subject,
        description: fields.description,
        sender: session?.user?.email
          ? { displayName: session.user.name ?? "Unknown", email: session.user.email }
          : null,
        userAgent,
        pageUrl: fields.pageUrl,
        viewport: fields.viewport,
        submittedAt: record.createdAt,
        attachments,
      });
      await prisma.feedback.update({
        where: { id: record.id },
        data: { emailedAt: new Date() },
      });
    } catch (error) {
      console.error("[feedback] email failed for", record.id, error);
      await prisma.feedback.update({
        where: { id: record.id },
        data: { emailError: (error instanceof Error ? error.message : "unknown").slice(0, 500) },
      });
    }
  } else {
    console.warn(
      "[feedback] stored",
      record.id,
      "but not emailed: set SMTP_HOST, SMTP_USER, SMTP_PASS and FEEDBACK_TO_EMAIL.",
    );
    await prisma.feedback.update({
      where: { id: record.id },
      data: { emailError: "Email not configured" },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
