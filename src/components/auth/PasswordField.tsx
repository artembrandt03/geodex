"use client";

import { useId, useState } from "react";
import Image from "next/image";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
}

/**
 * A labelled password input with a show/hide toggle. The icon shows the
 * input's current state: closed eye while the password is hidden, open eye
 * while it's visible. `unoptimized` on the icons per CLAUDE.md's next/image
 * WebP-alpha caution (they're transparent PNGs).
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          required
          minLength={minLength}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-surface-2 py-2 pl-3 pr-11 outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
        >
          <Image
            src={visible ? "/images/eye-open.png" : "/images/eye-closed.png"}
            alt=""
            width={20}
            height={20}
            unoptimized
          />
        </button>
      </div>
    </div>
  );
}
