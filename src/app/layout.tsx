
import type { Metadata } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/Brand";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", style: ["normal", "italic"] });
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Splitpot — split the bill on Moove",
  description: "Split a shared bill into one Moove pay link per person. Friends pay in any token on any chain. It settles to the host.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${mono.variable}`}>
        <div className="glow" aria-hidden="true" />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
