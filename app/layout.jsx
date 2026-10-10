import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";
import { property } from "@/lib/property";
import JsonLd from "@/components/JsonLd";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const viewport = {
  themeColor: "#faf7f2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL("https://thehaus26.com"),
  title: {
    default: `${property.name} | Private Pool Staycation in Limay, Bataan`,
    template: `%s | ${property.name}`,
  },
  description:
    property.tagline ||
    "Private staycation rental with swimming pool, billiards, and 2 air-conditioned rooms in Limay, Bataan. 22-hour exclusive stays from ₱5,000.",
  keywords: [
    "The HauS 26",
    "Limay staycation",
    "Bataan staycation with pool",
    "private resort Limay Bataan",
    "exclusive pool rental Bataan",
    "22 hour staycation",
    "billiards private villa Bataan",
  ],
  authors: [{ name: property.name }],
  creator: property.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: "https://thehaus26.com",
    siteName: property.name,
    title: `${property.name} | Private Pool Staycation in Limay, Bataan`,
    description:
      property.tagline ||
      "Exclusive 22-hour private rental with swimming pool, billiard table, and outdoor grill in Limay, Bataan.",
    images: property.photos[0]
      ? [
          {
            url: property.photos[0].src,
            width: 1152,
            height: 2048,
            alt: property.photos[0].alt,
          },
        ]
      : [],
  },
  twitter: {
    card: "summary_large_image",
    title: `${property.name} | Private Pool Staycation in Limay, Bataan`,
    description:
      property.tagline ||
      "Exclusive 22-hour private rental with swimming pool, billiard table, and outdoor grill in Limay, Bataan.",
    images: property.photos[0] ? [property.photos[0].src] : [],
  },
  other: {
    "geo.region": "PH-BAN",
    "geo.placename": "Limay, Bataan",
    "geo.position": "14.5339905;120.5875",
    ICBM: "14.5339905, 120.5875",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${figtree.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <JsonLd />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:m-3 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-white focus:outline-none"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
