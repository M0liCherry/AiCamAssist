import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity AI — Local-first AI study workspace",
  description: "Offline-first study and note-taking desktop app with podcasts, flashcards, quizzes, and a source-grounded assistant.",
  applicationName: "Verity AI",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f14" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f8" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
