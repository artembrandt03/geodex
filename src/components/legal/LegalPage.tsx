import type { ReactNode } from "react";
import Link from "next/link";
import { contactEmail, LEGAL_UPDATED } from "@/lib/legal";

/** A long-form legal document over the map: title, last-updated date, then sections. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-4 py-10">
        <article className="w-full max-w-3xl rounded-2xl border border-border bg-surface/90 p-6 shadow-2xl backdrop-blur-md sm:p-10">
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
          <div className="mt-6 flex flex-col gap-7">{children}</div>
          <nav
            aria-label="Legal documents"
            className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm"
          >
            <Link href="/privacy" className="text-primary underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-primary underline underline-offset-4">
              Terms of Use
            </Link>
            <Link href="/setup" className="text-muted underline underline-offset-4">
              Back to the game
            </Link>
          </nav>
        </article>
      </div>
    </div>
  );
}

/** One numbered-style section of a legal page: a heading and plain-language paragraphs and lists. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 leading-relaxed">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** A bulleted list styled for legal text. */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="ml-5 flex list-disc flex-col gap-2 marker:text-accent-strong">{children}</ul>;
}

/** How to reach the person responsible: an email if one is configured, otherwise the feedback window. */
export function ContactDetails() {
  const email = contactEmail();
  return (
    <p>
      {email ? (
        <>
          Email{" "}
          <a href={`mailto:${email}`} className="text-primary underline underline-offset-4">
            {email}
          </a>
          , or use the Bug reports &amp; feedback window on the{" "}
        </>
      ) : (
        <>Use the Bug reports &amp; feedback window on the </>
      )}
      <Link href="/setup" className="text-primary underline underline-offset-4">
        game&apos;s setup screen
      </Link>
      {email ? "." : ". Mention that it is a privacy request so it is handled as one."}
    </p>
  );
}
