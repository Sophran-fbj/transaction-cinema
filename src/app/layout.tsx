import type { Metadata } from "next";
// Self-hosted via the `geist` package (woff2 shipped in node_modules) —
// next/font/google downloads from fonts.googleapis.com at build time, which
// breaks offline/air-gapped builds.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { MotionConfig } from "framer-motion";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transaction Cinema",
  description: "Turn any onchain transaction into a short animated story.",
  openGraph: {
    title: "Transaction Cinema",
    description: "Turn any onchain transaction into a short animated story.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
