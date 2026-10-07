import Link from "next/link";

/** A small "Privacy Policy · Terms of Use" line for the foot of pages and cards. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-2 text-xs text-muted ${className}`}>
      <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
        Privacy Policy
      </Link>
      <span aria-hidden>·</span>
      <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
        Terms of Use
      </Link>
    </p>
  );
}
