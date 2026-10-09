import type { Metadata } from "next";
import { AboutMeWindow } from "@/components/about/AboutMeWindow";
import { ProjectWindow } from "@/components/about/ProjectWindow";
import { NewsWindow } from "@/components/about/NewsWindow";
import { LegalLinks } from "@/components/legal/LegalLinks";

export const metadata: Metadata = {
  title: "About | Geodex",
};

/*
 * Wide screens (xl+): three columns -- About me on the left, the project in
 * the middle (given the most room), News on the right. Below that it falls
 * back to a single column, where News moves to the top (order-first).
 */
export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // /about?updates=open deep-links straight to the News popup (used by the
  // title screen's News teaser).
  const { updates } = await searchParams;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-[1800px] flex-col gap-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
            <AboutMeWindow />
            <ProjectWindow />
            {/* First on phones and tablets (the news is what a returning visitor
                wants), back in its right-hand column on wide screens. */}
            <div className="order-first xl:order-none">
              <NewsWindow initialOpen={updates === "open"} />
            </div>
          </div>
          <LegalLinks className="pb-2" />
        </div>
      </div>
    </div>
  );
}
