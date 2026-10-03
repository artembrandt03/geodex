import type { Metadata } from "next";
import { AboutMeWindow } from "@/components/about/AboutMeWindow";
import { ProjectWindow } from "@/components/about/ProjectWindow";
import { NewsWindow } from "@/components/about/NewsWindow";
import { AttributionsWindow } from "@/components/about/AttributionsWindow";

export const metadata: Metadata = {
  title: "About | Geodex",
};

export default function AboutPage() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-5xl flex-col gap-6">
          <AboutMeWindow />
          <ProjectWindow />
          <div className="grid gap-6 md:grid-cols-2">
            <NewsWindow />
            <AttributionsWindow />
          </div>
        </div>
      </div>
    </div>
  );
}
