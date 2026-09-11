import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity — Local-first AI study workspace",
  description: "Offline-first study and note-taking desktop app with podcasts, flashcards, quizzes, and a source-grounded assistant.",
  applicationName: "Verity",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1e1e2e" },
    { media: "(prefers-color-scheme: light)", color: "#eff1f5" },
  ],
};

const themeScript = `(function() {
  try {
    var savedTheme = localStorage.getItem('verity_theme') || localStorage.getItem('nitro_theme');
    var theme = savedTheme === 'dark' ? 'mocha' : savedTheme === 'light' ? 'latte' : savedTheme;
    if (theme) {
      document.documentElement.dataset.theme = theme;
      if (document.body) document.body.dataset.theme = theme;
    }
    var savedFont = localStorage.getItem('verity_font_preference') || localStorage.getItem('nitro_font_preference');
    if (savedFont && ['sans', 'mono', 'dyslexic'].indexOf(savedFont) !== -1) {
      document.documentElement.dataset.font = savedFont;
      if (document.body) document.body.dataset.font = savedFont;
    }
  } catch(e) {}
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
