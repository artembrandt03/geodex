"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface NavVisibilityValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const NavVisibilityContext = createContext<NavVisibilityValue | null>(null);

/** Lets a page (namely the landing hero) temporarily hide the persistent nav bar. */
export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Seeded from (and kept in sync with) the pathname — consistent between
  // server and client renders for the initially-requested URL, so no
  // hydration mismatch, and no flash of a briefly-visible nav bar on "/"
  // before the home page's own effect gets a chance to hide it.
  const [hidden, setHidden] = useState(() => pathname === "/");

  // React's "adjust state during render" pattern (not an effect — this runs
  // synchronously as part of rendering, before paint, whenever the route
  // changes) so a client-side navigation back to "/" also hides
  // immediately, without waiting for the home page's own effect to fire.
  const [trackedPathname, setTrackedPathname] = useState(pathname);
  if (pathname !== trackedPathname) {
    setTrackedPathname(pathname);
    setHidden(pathname === "/");
  }

  return (
    <NavVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

export function useNavVisibility() {
  const ctx = useContext(NavVisibilityContext);
  if (!ctx) {
    throw new Error("useNavVisibility must be used within a NavVisibilityProvider");
  }
  return ctx;
}
