import type { Metadata } from "next";
import { Golos_Text, Press_Start_2P, Rubik_Mono_One } from "next/font/google";
import Link from "next/link";

import { PixelIcon } from "@/components/pixel-icon";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${golosText.variable} ${rubikMonoOne.variable} ${pressStart2P.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-grid-light text-ink">
        <header className="mx-auto w-full max-w-3xl px-4 pt-5 sm:pt-7">
          <div className="flex h-11 items-center px-1 sm:h-14 sm:px-0">
            <Link href="/" className="font-pixel text-11 sm:text-14">
              Context
            </Link>
          </div>
        </header>
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
