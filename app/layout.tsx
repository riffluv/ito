import Header from "@/components/site/Header";
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Online ITO",
  description: "Co-op number ordering party game",
  icons: [{ rel: "icon", url: "/icon.svg" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning className={inter.className}>
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
