/**
 * Single source of truth for product identity shown in About, legal pages,
 * and the web app. Publisher fields are read from NEXT_PUBLIC_*
 * variables so a distributor can supply verified business details at build
 * time without editing source. Defaults are deliberately explicit about being
 * unconfigured rather than presenting fabricated company information.
 */
export const APP_NAME = "Verity AI";
export const APP_VERSION = "1.0.0";
export const APP_ID = "verity-ai-web";

export type Publisher = {
  name: string;
  legalEntity: string;
  address: string;
  supportEmail: string;
  privacyEmail: string;
  website: string;
};

export const PUBLISHER: Publisher = {
  name: process.env.NEXT_PUBLIC_PUBLISHER_NAME || "Sunrays, Nathaneal, Anxiety, and Maaz",
  legalEntity:
    process.env.NEXT_PUBLIC_PUBLISHER_ENTITY ||
    "Sunrays, Nathaneal, Anxiety, and Maaz",
  address:
    process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS ||
    "Business address not configured — set NEXT_PUBLIC_PUBLISHER_ADDRESS before distribution",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@verityai.example",
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@verityai.example",
  website: process.env.NEXT_PUBLIC_PUBLISHER_WEBSITE || "",
};

export const STT_MODELS = ["Xenova/whisper-tiny", "Xenova/whisper-base", "Xenova/whisper-small"];

/** Default local KokoClone endpoint when the user has not configured one. */
export const DEFAULT_KOKO_ENDPOINT = "http://127.0.0.1:7860";

export const POLICY_EFFECTIVE_DATE = "March 24, 2026";
