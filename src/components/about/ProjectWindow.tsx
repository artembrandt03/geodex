import type { ReactNode } from "react";
import { AboutWindow } from "./AboutWindow";

const FEATURES = [
  "Two ways to play: click the country you're asked for, or name the one that's highlighted",
  "Easy, Medium and Hard country pools",
  "Rounds of 5, 10, 15 or 20 countries",
  "A map you can pan and zoom, with a closer look at any country after you guess",
  "A round stopwatch, speed bonuses and answer streaks",
  "Top-5 leaderboards for every mode, difficulty and round length",
  "A profile page with your stats and match history",
  "Play as a guest, or sign up to compete on the leaderboards",
];

const HOW_TO_PLAY = [
  "Pick a mode, a difficulty and a round length.",
  "Guess the country. You get one attempt each, and there's no time limit.",
  "A correct answer earns base points: 10 on Easy, 20 on Medium and 30 on Hard.",
  "Answer quickly for a speed bonus: within 5 seconds doubles the base points, within 10 seconds adds half and within 15 adds a quarter.",
  "Get three in a row right to start a streak bonus, which grows with every further correct answer.",
  "A wrong answer scores 0, unless you picked a country that borders the right one. That earns 1 point.",
];

const BUILT_WITH = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "PostgreSQL",
  "Prisma",
  "react-simple-maps",
  "D3",
  "Framer Motion",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/50 p-5">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function ProjectWindow() {
  return (
    <AboutWindow title="About the project" delay={0.1}>
      <Section title="The idea">
        <p className="leading-relaxed">
          My geography skills are, let&apos;s say, a work in progress. I went looking online
          for a game that would help me practice, but I couldn&apos;t find anything quite like
          what I had in mind, so I decided to build it myself.
        </p>
        <p className="leading-relaxed">
          It was also a chance to practice working solo on a big project, overseeing
          everything from the first idea to the finished product.
        </p>
      </Section>

      {/* Two columns only when the window itself is wide enough (container
          query); in the three-column About layout it's often not. */}
      <div className="@container">
        <div className="grid gap-5 @xl:grid-cols-2">
          <Section title="Features">
            <ul className="flex flex-col gap-2">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5 leading-snug">
                  <span aria-hidden className="mt-0.5 text-accent-strong">
                    ◆
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="How to play">
            <ol className="flex flex-col gap-2.5">
              {HOW_TO_PLAY.map((step, i) => (
                <li key={step} className="flex gap-3 leading-snug">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-accent-strong font-display text-xs font-bold text-primary-hover"
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      <Section title="Built with">
        <ul className="flex flex-wrap gap-2">
          {BUILT_WITH.map((tech) => (
            <li
              key={tech}
              className="rounded-full border border-border-strong bg-surface/70 px-3 py-1 text-sm"
            >
              {tech}
            </li>
          ))}
        </ul>
      </Section>
    </AboutWindow>
  );
}
