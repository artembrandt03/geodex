import Image from "next/image";
import { AboutWindow } from "@/components/about/AboutWindow";
import type { ProfileUser } from "./useProfile";

const memberSince = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

/** Who you are: the avatar (fixed for now), display name, email and join date. */
export function ProfileCard({ user }: { user: ProfileUser }) {
  return (
    <AboutWindow title="Your profile">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* `unoptimized`: transparent PNG, see CLAUDE.md's WebP-alpha caution. */}
        <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-accent-strong bg-gradient-to-br from-surface to-surface-2 shadow-[inset_0_0_0_3px_var(--surface-2)]">
          <Image
            src="/images/user-avatar.png"
            alt="An illustrated explorer studying a treasure map through a magnifying glass"
            fill
            unoptimized
            className="object-contain p-4"
          />
        </div>

        <p className="break-words font-display text-2xl font-bold">{user.displayName}</p>
      </div>

      <dl className="flex flex-col divide-y divide-border/70 rounded-xl border border-border bg-surface-2/50 text-sm">
        <Detail label="Display name" value={user.displayName} />
        <Detail label="Email" value={user.email} />
        <Detail label="Password" value="••••••••" />
        <Detail label="Member since" value={memberSince.format(new Date(user.createdAt))} />
      </dl>
    </AboutWindow>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right font-medium">{value}</dd>
    </div>
  );
}
