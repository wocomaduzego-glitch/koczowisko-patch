import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Koczowisko – twój szkic dźwięku",
  description:
    "Koczowisko 3.0 – niezależna platforma muzyczna: lokalna biblioteka, playlisty, konta, społeczność, teksty i statystyki.",
  icons: { icon: "/icon.svg", apple: "/icons/app-192.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Koczowisko", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${display.variable} ${body.variable}`} data-anim="full">
      <body className="koc-body">{children}</body>
    </html>
  );
}
