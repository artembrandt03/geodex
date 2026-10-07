import type { Metadata } from "next";
import Link from "next/link";
import {
  StatusPage,
  statusPrimaryClass,
  statusSecondaryClass,
} from "@/components/layout/StatusPage";

export const metadata: Metadata = {
  title: "Page not found | Geodex",
};

/** Shown for any URL that doesn't exist, in the app's own look instead of Next's bare default. */
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Uncharted territory"
      actions={
        <>
          <Link href="/setup" className={statusPrimaryClass}>
            Back to the map
          </Link>
          <Link href="/" className={statusSecondaryClass}>
            Home
          </Link>
        </>
      }
    >
      <p>
        We couldn&apos;t find that page. The link may be mistyped, or the page may have moved or been
        removed.
      </p>
    </StatusPage>
  );
}
