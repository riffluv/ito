import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import React from "react";
import ClientFrame from "./ClientFrame";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";
import StorageSchemaGuard from "./StorageSchemaGuard";
import "./globals.css";
import Providers from "./providers";
import { buildAudioPreloadHrefs } from "@/lib/audio/preload";
import SafeUpdateToast from "@/components/ui/SafeUpdateToast";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const AUDIO_PRELOAD_HREFS = buildAudioPreloadHrefs();

const guessAudioType = (href: string) => {
  if (href.endsWith(".ogg")) return "audio/ogg";
  if (href.endsWith(".webm")) return "audio/webm";
  if (href.endsWith(".mp3")) return "audio/mpeg";
  if (href.endsWith(".wav")) return "audio/wav";
  return undefined;
};

export const metadata: Metadata = {
  title: "序の紋章 III — 連想ヒントで 1→100 を昇順に並べる協力カードゲーム",
  description:
    "連想（ヒント）だけで数字を小さい順に並べるオンライン協力カードゲーム。　なかまと一緒に遊ぼう！",
  icons: [{ rel: "icon", url: "/images/knight1.webp" }],
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [{ media: "all", color: "#1a1a1a" }],
};

// Client 専用の判定は app/ClientFrame.tsx に分離

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning className={inter.className}>
      <head>
        <meta name="color-scheme" content="dark" />
        {AUDIO_PRELOAD_HREFS.map((href) => {
          const type = guessAudioType(href);
          return (
            <link
              key={href}
              rel="preload"
              as="audio"
              href={href}
              type={type ?? undefined}
            />
          );
        })}
      </head>
      <body>
        <Providers>
          <StorageSchemaGuard />
          <ServiceWorkerRegistration />
          <SafeUpdateToast />
          <ClientFrame>{children}</ClientFrame>
        </Providers>
      </body>
    </html>
  );
}



