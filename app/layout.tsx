import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { ColorModeScript } from "@chakra-ui/react";

export const metadata: Metadata = {
  title: "Online ITO",
  description: "Co-op number ordering party game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <ColorModeScript initialColorMode="dark" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
