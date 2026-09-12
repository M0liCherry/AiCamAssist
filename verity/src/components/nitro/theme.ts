export type Theme = "dark" | "light";

const STORAGE_KEY = "verity_theme";

/** Single place that applies the theme: DOM attribute + persisted for pre-hydration. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing etc. — theme still applies for this session.
  }
}
