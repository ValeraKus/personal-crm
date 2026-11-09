import type { Metadata } from "next";
import { Golos_Text, Press_Start_2P, Rubik_Mono_One } from "next/font/google";
import { PixelIcon } from "@/components/pixel-icon";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// The same fonts as on the landing; names of the variables are used in src/styles/tokens.css
const golosText = Golos_Text({
  variable: "--font-golos-text",
  subsets: ["latin", "cyrillic"],
});

const rubikMonoOne = Rubik_Mono_One({
  variable: "--font-rubik-mono-one",
  weight: "400",
  subsets: ["latin", "cyrillic"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start-2p",
  weight: "400",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: "Контакты — Личная CRM",
    template: "%s — Личная CRM",
  },
  description: "Люди, которых я знаю лично, и контекст общения с ними",
};

// The header shows who is signed in, so no page is built ahead of time: `next build` runs without
// the settings, and a prebuilt page would show the header of nobody
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${golosText.variable} ${rubikMonoOne.variable} ${pressStart2P.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-grid-light text-ink">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-14 sm:pt-6 sm:pb-20">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-3xl px-4">
          <div className="flex items-center justify-between border-t-2 border-ink px-1 pt-6 pb-8 sm:px-0">
            <span className="font-pixel text-10">Context</span>
            <PixelIcon name="heart" className="h-4.5 w-5.25 text-accent" />
          </div>
        </footer>
        <Toaster theme="light" position="bottom-center" />
      </body>
    </html>
  );
}
