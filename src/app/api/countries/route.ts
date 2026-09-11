import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** All playable countries, for the guess-by-shape autocomplete list. */
export async function GET() {
  const countries = await prisma.country.findMany({
    select: { code: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ countries });
}
