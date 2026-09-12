import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity AI — Local-first AI study workspace",
  description: "Local-first study and note-taking workspace with podcasts, flashcards, quizzes, and a source-grounded assistant.",
  applicationName: "Verity AI",
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
      <head>
        {/* Apply the persisted theme before hydration to avoid a dark/light flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("verity_theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
