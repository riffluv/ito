import Header from "@/components/site/Header";
import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import Providers from "./providers";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Online ITO",
  description: "Co-op number ordering party game",
  icons: [{ rel: "icon", url: "/icon.svg" }],
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0D10" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning className={inter.className}>
      <head>
        {/* System forms/controls に配色ヒントを与える */}
        <meta name="color-scheme" content="dark light" />
      </head>
      <body>
        <a
          href="#main"
          style={{
            position: "absolute",
            left: -9999,
            top: 0,
          }}
        >
          本文へスキップ
        </a>
        <Providers>
          <Header />
          <div id="main">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
