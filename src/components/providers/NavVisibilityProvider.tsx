"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface NavVisibilityValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const NavVisibilityContext = createContext<NavVisibilityValue | null>(null);

/** Lets a page (namely the landing hero) temporarily hide the persistent nav bar. */
export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
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
