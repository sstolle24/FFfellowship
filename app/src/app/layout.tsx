import type { Metadata } from "next";
// Self-hosted fonts (bundled at build time — no requests to Google).
import "@fontsource/bitter/400.css";
import "@fontsource/bitter/600.css";
import "@fontsource/bitter/700.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/alegreya-sans/400-italic.css";
import "./globals.css";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  // Absolute base for the Open Graph image and icons (opengraph-image.png, icon.png, apple-icon.png).
  metadataBase: new URL(env.siteUrl),
  title: { default: "Finally Free Fellowship", template: "%s · Finally Free" },
  description: "A Christ-centered, peer-led fellowship for men finding freedom from sexual addiction.",
  robots: { index: true, follow: true },
  openGraph: { siteName: "Finally Free Fellowship", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
