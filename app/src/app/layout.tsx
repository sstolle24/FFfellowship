import type { Metadata } from "next";
// Self-hosted fonts (bundled at build time — no requests to Google).
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource-variable/lora";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Finally Free Fellowship", template: "%s · Finally Free" },
  description: "A Christ-centered, peer-led fellowship for men finding freedom from sexual addiction.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
