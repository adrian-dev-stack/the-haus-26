import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";
import { property } from "@/lib/property";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata = {
  title: `${property.name} | Staycation rental`,
  description: property.tagline || `Staycation rental. ${property.name}. Send an inquiry to book.`,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${figtree.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-3 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
