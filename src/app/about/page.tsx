import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Geodex",
};

export default function AboutPage() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-5xl flex-col gap-6" />
      </div>
    </div>
  );
}
