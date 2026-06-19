import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Playfair_Display,
  DM_Sans,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "APEX",
  description: "Your personal AI chief of staff",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`
        ${cormorant.variable}
        ${playfair.variable}
        ${dmSans.variable}
        ${jetbrains.variable}
        h-full
      `}
    >
      <body className="min-h-full bg-[#0A3323] text-[#F7F4D5] antialiased">
        {children}
      </body>
    </html>
  );
}
