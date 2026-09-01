import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aurea — private conversations, curated",
    template: "%s · Aurea",
  },
  description:
    "A curated catalog of companions. Browse profiles, unlock a private chat and talk directly — no noise, no bots.",
};

export const viewport: Viewport = {
  themeColor: "#05040a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-blush-500/18 blur-[130px] animate-float" />
          <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-violet-500/18 blur-[140px] animate-float [animation-delay:-4s]" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(circle_at_50%_0%,black,transparent_72%)]" />
        </div>
        {children}
      </body>
    </html>
  );
}
