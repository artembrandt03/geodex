"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/** The centred glass card the account pages (login, signup, verify, reset) sit in. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="relative z-10 flex h-full justify-center overflow-y-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="my-auto flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-surface/80 p-8 shadow-2xl backdrop-blur-md"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
