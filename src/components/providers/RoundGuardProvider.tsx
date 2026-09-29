"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

interface RoundGuardContextValue {
  guardEnabled: boolean;
  setGuardEnabled: (enabled: boolean) => void;
  /** Runs `action` immediately if nothing needs guarding, otherwise asks for confirmation first. */
  guardedAction: (action: () => void) => void;
}

const RoundGuardContext = createContext<RoundGuardContextValue | null>(null);

/**
 * Confirms before letting nav-bar navigation (or sign-out) interrupt an
 * in-progress round — leaving `/play` mid-round used to silently abandon it
 * with no warning. PlayGame calls useRoundGuard().setGuardEnabled(true) for
 * as long as a round is actually being played/revealed; NavBar wraps its
 * links/sign-out in guardedAction so that while a round is active, clicking
 * one shows this confirmation instead of navigating right away.
 *
 * Rendered as a sibling of AppShell (see layout.tsx), not inside it, so the
 * confirmation dialog isn't caught by AppShell's /play-only
 * pointer-events-none (that trick makes AppShell's own DOM click-through to
 * the persistent map layer underneath it — a dialog living outside AppShell
 * entirely never needs to opt back in).
 */
export function RoundGuardProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [guardEnabled, setGuardEnabled] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const guardedAction = useCallback(
    (action: () => void) => {
      if (guardEnabled) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [guardEnabled],
  );

  const contextValue = useMemo<RoundGuardContextValue>(
    () => ({ guardEnabled, setGuardEnabled, guardedAction }),
    [guardEnabled, guardedAction],
  );

  return (
    <RoundGuardContext.Provider value={contextValue}>
      {children}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setPendingAction(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl"
          >
            <h2 className="font-display text-xl font-bold">End this round?</h2>
            <p className="mt-2 text-sm text-muted">
              If you leave now, this round will end and your progress won&apos;t be saved.
              {session?.user &&
                " It won't count toward your profile once that's tracked, either."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setPendingAction(null)}
                className="rounded-lg border border-border-strong px-4 py-2 font-medium transition-colors hover:bg-surface-2"
              >
                Continue playing
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const action = pendingAction;
                  setPendingAction(null);
                  setGuardEnabled(false);
                  action();
                }}
                className="rounded-lg bg-danger px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-danger-strong"
              >
                End round
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </RoundGuardContext.Provider>
  );
}

export function useRoundGuard() {
  const ctx = useContext(RoundGuardContext);
  if (!ctx) {
    throw new Error("useRoundGuard must be used within a RoundGuardProvider");
  }
  return ctx;
}
