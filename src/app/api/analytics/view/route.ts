import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/clientIp";
import { touchActivity, trackMany } from "@/lib/analytics/track";
import {
  browserFamily,
  deviceClass,
  isBot,
  pageKey,
  referrerSource,
  utcDayString,
  visitorHash,
} from "@/lib/analytics/classify";

const viewSchema = z.object({
  path: z.string().max(300),
  referrer: z.string().max(500).optional(),
});

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

/**
 * Counts a page view for the owner's statistics, without cookies and without storing who
 * the visitor is.
 *
 *  - A visitor who has asked not to be tracked (the Do Not Track or Global Privacy Control
 *    signal) is not counted at all, nor is a crawler or automated browser.
 *  - What is kept is counts: page views per page, and once a day per visitor, their device
 *    type, browser family and where they came from, each as a short bucket.
 *  - "Once a day per visitor" is decided with a keyed hash of the day, IP address and
 *    browser string (classify.ts: visitorHash). It can't be reversed, differs every day so
 *    days can't be linked, and the rows are deleted after two days; only the count stays.
 *  - Only the path is read, never the query string, and a player's id never reaches it.
 */
export async function POST(request: Request) {
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return NO_CONTENT();

  const userAgent = request.headers.get("user-agent");
  if (isBot(userAgent)) return NO_CONTENT();

  const parsed = viewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid view" }, { status: 400 });

  const day = utcDayString();
  const hash = visitorHash(
    process.env.AUTH_SECRET ?? "geodex-visitor",
    day,
    clientIp(request) ?? "unknown",
    userAgent!,
  );

  try {
    const { count: isNewToday } = await prisma.dailyVisitor.createMany({
      data: [{ day: new Date(day), hash }],
      skipDuplicates: true,
    });

    const session = await auth();
    const increments: Record<string, number> = {
      pageviews: 1,
      [`pageviews.page:${pageKey(parsed.data.path)}`]: 1,
    };
    if (session?.user?.id) increments["pageviews.signed_in"] = 1;
    if (isNewToday === 1) {
      increments["visitors"] = 1;
      increments[`visitors.device:${deviceClass(userAgent!)}`] = 1;
      increments[`visitors.browser:${browserFamily(userAgent!)}`] = 1;
      increments[`visitors.source:${referrerSource(parsed.data.referrer, request.headers.get("host"))}`] = 1;
    }
    await trackMany(increments);
    if (session?.user?.id) await touchActivity(session.user.id);

    // Housekeeping: yesterday's hashes are no use to anyone, so they don't linger.
    if (Math.random() < 0.02) {
      const cutoff = new Date(day);
      cutoff.setUTCDate(cutoff.getUTCDate() - 2);
      await prisma.dailyVisitor.deleteMany({ where: { day: { lt: cutoff } } });
    }
  } catch (error) {
    // Statistics must never get in anyone's way.
    console.error("[analytics] could not record a page view", error);
  }

  return NO_CONTENT();
}
