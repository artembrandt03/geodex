"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Only the first page a visit lands on has an outside referrer worth reporting. */
let firstViewSent = false;

/**
 * Reports each page view so the owner's statistics can count visitors and pages (see
 * /api/analytics/view for exactly what is and isn't kept). It sends the path only, no
 * identifier, and does nothing at all if the browser says Do Not Track or Global Privacy
 * Control. Renders nothing.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const browser = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (browser.doNotTrack === "1" || browser.globalPrivacyControl) return;

    const referrer = firstViewSent ? "" : document.referrer;
    firstViewSent = true;

    void fetch("/api/analytics/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ path: pathname, referrer }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
