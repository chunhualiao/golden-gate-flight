import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Golden Gate Flight",
      template: "%s — Golden Gate Flight",
    },
    description:
      "A cinematic, free-flight Three.js experience above San Francisco Bay.",
    openGraph: {
      title: "Golden Gate Flight",
      description: "Take the controls. Cross the fog. Explore the span.",
      type: "website",
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "Golden Gate Flight" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Golden Gate Flight",
      description: "Take the controls. Cross the fog. Explore the span.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
