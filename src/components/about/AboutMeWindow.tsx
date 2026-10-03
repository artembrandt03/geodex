import Image from "next/image";
import { AboutWindow } from "./AboutWindow";

const PORTFOLIO_URL = "https://artembrandt.ca";

export function AboutMeWindow() {
  return (
    <AboutWindow title="About me">
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
        {/* `unoptimized`: transparent PNG, see CLAUDE.md's WebP-alpha caution. */}
        <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-full border-4 border-accent-strong bg-gradient-to-br from-surface to-surface-2 shadow-[inset_0_0_0_3px_var(--surface-2)]">
          <Image
            src="/images/profile-picture.png"
            alt="An illustrated explorer in a hat and backpack, studying a treasure map through a magnifying glass"
            fill
            unoptimized
            className="object-contain p-4"
          />
        </div>

        <div className="flex flex-col gap-4 leading-relaxed">
          <p>
            Hi, I&apos;m <strong>Artem Brandt</strong>, a developer from Montreal, QC,
            Canada, and I enjoy creating fun software.
          </p>
          <p>
            I graduated from the Computer Science program at Dawson College. What I like
            most is working on projects like this one, where I&apos;m in control from the
            first idea all the way to a finished result: designing it, building it,
            deploying it, and then taking care of long-term support and monitoring.
          </p>
          <p>
            If you&apos;re curious to find out more about me and what else I&apos;ve
            built, come visit my portfolio.
          </p>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            artembrandt.ca
            <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </AboutWindow>
  );
}
