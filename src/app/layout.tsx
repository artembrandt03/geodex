import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NavVisibilityProvider } from "@/components/providers/NavVisibilityProvider";
import { MapBackdropProvider } from "@/components/providers/MapBackdropProvider";
import { NavBar } from "@/components/layout/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// An engraved, classical-map feel for titles/branding — everything else
// stays on Geist for readability at small sizes.
const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Geodex",
  description: "Guess countries on the map, by name or by shape.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <AuthProvider>
          <NavVisibilityProvider>
            <MapBackdropProvider>
              <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
                <NavBar />
                <main className="flex-1 overflow-y-auto">{children}</main>
              </div>
            </MapBackdropProvider>
          </NavVisibilityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
