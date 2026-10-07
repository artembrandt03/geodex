"use client";

import { useEffect } from "react";
// global-error replaces the whole root layout, so none of the app's global
// styles are present unless they're imported here too.
import "./globals.css";

/**
 * The last-resort fallback for a crash in the root layout itself (error.tsx
 * can't catch that, since it sits inside the layout). It has to supply its own
 * <html> and <body>, and it can't use the app's fonts or providers, so it
 * leans on the theme's CSS variables from globals.css with plain system
 * fonts and no dependencies that could fail the same way. Plain elements
 * rather than next/link, so it works even if routing is what broke.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        className="bg-background text-foreground"
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <title>Something went wrong | Geodex</title>
        <main
          style={{
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
            padding: "2.5rem",
            borderRadius: "1rem",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          }}
        >
          <p
            aria-hidden
            style={{
              margin: 0,
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "4.5rem",
              fontWeight: 700,
              lineHeight: 1,
              color: "var(--accent-strong)",
            }}
          >
            Oops
          </p>
          <h1 style={{ margin: "1rem 0 0.5rem", fontSize: "1.5rem", fontWeight: 700 }}>
            Geodex hit a problem
          </h1>
          <p style={{ margin: 0, lineHeight: 1.6, color: "var(--muted)" }}>
            Something went wrong loading the app. Trying again often fixes it.
          </p>
          {error.digest && (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "var(--muted-2)" }}>
              Reference: {error.digest}
            </p>
          )}
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => retry()}
              style={{
                cursor: "pointer",
                border: 0,
                borderRadius: "0.5rem",
                padding: "0.65rem 1.25rem",
                fontSize: "1rem",
                fontWeight: 600,
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              Try again
            </button>
            {/* A full page load, not client routing: the app's own layout is what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: "0.5rem",
                border: "1px solid var(--border-strong)",
                padding: "0.65rem 1.25rem",
                fontSize: "1rem",
                fontWeight: 500,
                color: "var(--foreground)",
                textDecoration: "none",
              }}
            >
              Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
