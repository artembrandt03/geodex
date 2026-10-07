"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  StatusPage,
  statusPrimaryClass,
  statusSecondaryClass,
} from "@/components/layout/StatusPage";

/**
 * The fallback when a page crashes while rendering (a database hiccup, a bug).
 * Wraps every page but not the root layout (global-error.tsx covers that).
 * `retry` is this Next version's name for "try again": it re-fetches the page
 * as well as re-rendering it, which is what a temporary server problem needs.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Shows up in the browser console now, and is where error monitoring would hook in later.
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="Oops"
      title="Something went wrong"
      actions={
        <>
          <button type="button" onClick={() => retry()} className={statusPrimaryClass}>
            Try again
          </button>
          <Link href="/setup" className={statusSecondaryClass}>
            Back to the map
          </Link>
        </>
      }
    >
      <p>
        We hit an unexpected problem loading this page. Trying again often fixes it. If it keeps
        happening, you can tell us about it from the feedback window on the title screen.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-muted-2">Reference: {error.digest}</p>
      )}
    </StatusPage>
  );
}
