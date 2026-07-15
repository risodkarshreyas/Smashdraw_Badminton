import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "SmashDraw — Badminton Knockout Draw Maker",
    description: "Create a fair, randomized badminton knockout fixture one round at a time.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "SmashDraw — Ready. Set. Smash.",
      description: "A fast, fair badminton knockout draw maker.",
      images: [{ url: imageUrl, width: 1536, height: 1024, alt: "SmashDraw badminton tournament maker" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "SmashDraw — Ready. Set. Smash.",
      description: "A fast, fair badminton knockout draw maker.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
