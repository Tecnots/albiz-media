import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Albiz — Where Ideas Meet Influence",
    template: "%s | Albiz",
  },
  description:
    "Albiz is the platform for thinkers, builders, and creators. Follow the people shaping technology, business, and culture. Join the Circle.",
  keywords: ["Albiz", "social platform", "tech news", "startup community", "business insights", "India tech", "Circle"],
  authors: [{ name: "Albiz Media", url: APP_URL }],
  creator: "Albiz Media",
  publisher: "Albiz Media",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Albiz",
    title: "Albiz — Where Ideas Meet Influence",
    description:
      "Follow thinkers, builders, and creators shaping technology, business, and culture. Join the Albiz Circle.",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Albiz" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@albizmedia",
    creator: "@albizmedia",
    title: "Albiz — Where Ideas Meet Influence",
    description: "Follow thinkers, builders, and creators shaping technology, business, and culture.",
    images: ["/og-default.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  alternates: { canonical: APP_URL },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className={`${urbanist.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
