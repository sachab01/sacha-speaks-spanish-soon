import type { Metadata } from "next";
import { Climate_Crisis, Geist, Geist_Mono } from "next/font/google";

import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Variable "YEAR" axis (1979-2050) controls how bold/chunky the letterforms get;
// 2050 gives the heavy bubble-letter look, matching the reference site's headline.
const climateCrisis = Climate_Crisis({
  variable: "--font-climate-crisis",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Spaans",
  description: "Practice Spanish with topic-based word banks and spaced repetition.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${climateCrisis.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
