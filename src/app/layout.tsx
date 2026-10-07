import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NavVisibilityProvider } from "@/components/providers/NavVisibilityProvider";
import { SharedMapProvider } from "@/components/providers/SharedMapProvider";
import { RoundGuardProvider } from "@/components/providers/RoundGuardProvider";
import { AppShell } from "@/components/layout/AppShell";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

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

const TITLE = `${SITE_NAME} | A geography guessing game`;
const SHARE_IMAGE = {
  url: "/images/social-share.png",
  width: 1200,
  height: 630,
  alt: "The Geodex title above a globe floating in space",
};

export const metadata: Metadata = {
  // Makes the relative share-image URL below absolute, which link previews
  // require. See lib/site.ts for where the address comes from.
  metadataBase: new URL(siteUrl()),
  title: TITLE,
  description: SITE_DESCRIPTION,
  // The link-preview card shown when the site is pasted into Discord,
  // iMessage, WhatsApp, Slack, Facebook and so on (Open Graph) and on X
  // (Twitter card). Pages with their own title keep it; they inherit the
  // image and description.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    // No og:url on purpose: it would be inherited by every page and claim they
    // are all the home page. Without it each page is its own address.
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
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
            <SharedMapProvider>
              <RoundGuardProvider>
                <AppShell>{children}</AppShell>
              </RoundGuardProvider>
            </SharedMapProvider>
          </NavVisibilityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
