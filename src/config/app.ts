/**
 * Single source of truth for product identity shown in About and legal pages.
 * Publisher fields are read from NEXT_PUBLIC_* variables so a distributor can
 * supply verified business details at build time without editing source.
 * Defaults are deliberately explicit about being unconfigured rather than
 * presenting fabricated company information.
 */
export const APP_NAME = "Verity AI";
export const APP_VERSION = "1.0.0";
export const APP_ID = "com.verityai";

export type Publisher = {
  name: string;
  legalEntity: string;
  address: string;
  supportEmail: string;
  privacyEmail: string;
  website: string;
};

export const PUBLISHER: Publisher = {
  name: process.env.NEXT_PUBLIC_PUBLISHER_NAME || "Verity AI Project (independent developer build)",
  legalEntity:
    process.env.NEXT_PUBLIC_PUBLISHER_ENTITY ||
    "No registered legal entity configured — set NEXT_PUBLIC_PUBLISHER_ENTITY before distribution",
  address:
    process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS ||
    "Business address not configured — set NEXT_PUBLIC_PUBLISHER_ADDRESS before distribution",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "maazbaig2006@gmail.com",
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "maazbaig2006@gmail.com",
  website: process.env.NEXT_PUBLIC_PUBLISHER_WEBSITE || "",
};

export const STT_MODELS = ["Xenova/whisper-tiny", "Xenova/whisper-base", "Xenova/whisper-small"];

/**
 * Public project identity shown in Settings → About.
 * Sourced from the public GitHub repository (owner + contributors).
 */
export const REPO_URL = "https://github.com/M0liCherry/AiCamAssist";
export const PROJECT_LICENSE = "MIT License © 2026 M0liCherry";

export type Contributor = { login: string; role: string; url: string };

export const CONTRIBUTORS: Contributor[] = [
  { login: "M0liCherry", role: "Owner & maintainer", url: "https://github.com/M0liCherry" },
  { login: "ArnavPednekar", role: "Contributor", url: "https://github.com/ArnavPednekar" },
  { login: "C1ph3r404", role: "Contributor", url: "https://github.com/C1ph3r404" },
  { login: "Anxietyop", role: "Contributor", url: "https://github.com/Anxietyop" },
  { login: "nate-test-cloud", role: "Contributor", url: "https://github.com/nate-test-cloud" },
];

/** Default local KokoClone endpoint when the user has not configured one. */
export const DEFAULT_KOKO_ENDPOINT = "http://127.0.0.1:7860";

export const POLICY_EFFECTIVE_DATE = "March 24, 2026";
