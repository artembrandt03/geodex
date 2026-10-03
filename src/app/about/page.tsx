import type { Metadata } from "next";
import { AboutMeWindow } from "@/components/about/AboutMeWindow";
import { ProjectWindow } from "@/components/about/ProjectWindow";
import { NewsWindow } from "@/components/about/NewsWindow";
import { AttributionsWindow } from "@/components/about/AttributionsWindow";

export const metadata: Metadata = {
  title: "About | Geodex",
};

/*
 * Wide screens (xl+): three columns -- About me on the left, the project in
 * the middle (given the most room), News and Attributions stacked on the
 * right. Below that it falls back to a single column, with the two small
 * windows side by side once there's room (md). DOM order is the mobile
 * reading order: me, project, news, attributions.
 */
export default function AboutPage() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        <div className="grid w-full max-w-[1800px] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
          <AboutMeWindow />
          <ProjectWindow />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <NewsWindow />
            <AttributionsWindow />
          </div>
        </div>
      </div>
    </div>
  );
}
