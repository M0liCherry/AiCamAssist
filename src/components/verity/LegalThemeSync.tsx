"use client";

import { useEffect } from "react";
import { applyTheme, normalizeSeed, themeFromStorage, type Theme } from "./theme";

/**
 * Standalone routes (legal pages) live outside VerityApp, so they never
 * receive the server theme through boot state. Sync the saved theme + seed
 * on mount: instantly from local storage, then reconciled with the server
 * so the page always matches the Theme studio choice.
 */
export function LegalThemeSync() {
  useEffect(() => {
    const stored = themeFromStorage();
    applyTheme(stored.theme, stored.seed);
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const settings = data?.settings;
        const theme: Theme | null = settings?.theme === "light" ? "light" : settings?.theme === "dark" ? "dark" : null;
        const seed = normalizeSeed(settings?.themeSeed);
        if (theme) applyTheme(theme, seed ?? stored.seed);
      })
      .catch(() => {
        // Offline or starting up — the stored theme already applied.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
