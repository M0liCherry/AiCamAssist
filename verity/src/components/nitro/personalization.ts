export type AiPersona = "friendly" | "academic" | "socratic" | "concise" | "creative" | "custom";
export type LearningStyle = "visual" | "deep" | "practice" | "summarized";

export type AiPersonalization = {
  learnerName: string;
  persona: AiPersona;
  customInstructions: string;
  learningStyle: LearningStyle;
};

const STORAGE_KEY = "verity_ai_personalization_v1";

export const DEFAULT_PERSONALIZATION: AiPersonalization = {
  learnerName: "",
  persona: "friendly",
  customInstructions: "",
  learningStyle: "visual",
};

export const PERSONA_DESCRIPTIONS: Record<AiPersona, { label: string; tone: string }> = {
  friendly: { label: "Friendly & Encouraging", tone: "Warm, enthusiastic, supportive, and accessible for everyday study." },
  academic: { label: "Academic & Rigorous", tone: "Formal, scholarly, precise definitions, and mathematically sound." },
  socratic: { label: "Socratic & Thought-provoking", tone: "Asks guiding questions to stimulate critical thinking and active learning." },
  concise: { label: "Concise & Direct", tone: "High signal-to-noise ratio, strictly bullet points and key takeaways with no fluff." },
  creative: { label: "Creative & Analogy-driven", tone: "Uses vivid real-world analogies, metaphors, and storytelling to make concepts stick." },
  custom: { label: "Custom Persona", tone: "Follows your exact custom instructions provided below." },
};

export const LEARNING_STYLE_DESCRIPTIONS: Record<LearningStyle, { label: string; desc: string }> = {
  visual: { label: "Visual & Structured", desc: "Prioritizes tables, markdown checklists, and structured hierarchy." },
  deep: { label: "Deep Conceptual Dives", desc: "Explains the foundational 'why' and mechanisms behind concepts." },
  practice: { label: "Practice-First", desc: "Provides quick self-test questions and applied challenges." },
  summarized: { label: "Executive Summaries", desc: "Presents high-level overviews before getting into granular details." },
};

export function getStoredPersonalization(): AiPersonalization {
  if (typeof window === "undefined") return { ...DEFAULT_PERSONALIZATION };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PERSONALIZATION };
    const parsed = JSON.parse(raw) as Partial<AiPersonalization>;
    // Stored values predate validation: fall back per-field so a corrupt
    // entry can't produce undefined lookups and blank selects downstream.
    return {
      learnerName: typeof parsed.learnerName === "string" ? parsed.learnerName : DEFAULT_PERSONALIZATION.learnerName,
      persona: parsed.persona && parsed.persona in PERSONA_DESCRIPTIONS ? parsed.persona : DEFAULT_PERSONALIZATION.persona,
      customInstructions: typeof parsed.customInstructions === "string" ? parsed.customInstructions : DEFAULT_PERSONALIZATION.customInstructions,
      learningStyle: parsed.learningStyle && parsed.learningStyle in LEARNING_STYLE_DESCRIPTIONS ? parsed.learningStyle : DEFAULT_PERSONALIZATION.learningStyle,
    };
  } catch {
    return { ...DEFAULT_PERSONALIZATION };
  }
}

export function saveStoredPersonalization(data: Partial<AiPersonalization>): AiPersonalization {
  if (typeof window === "undefined") return { ...DEFAULT_PERSONALIZATION, ...data };
  try {
    const current = getStoredPersonalization();
    const updated = { ...current, ...data };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return { ...DEFAULT_PERSONALIZATION, ...data };
  }
}

export function buildPersonalizationPrompt(data: AiPersonalization): string {
  const parts: string[] = [];
  if (data.learnerName.trim()) {
    parts.push(`The user's name is ${data.learnerName.trim()}. Address them by name when appropriate.`);
  }
  const personaKey = data.persona === "custom" && !data.customInstructions.trim() ? "friendly" : data.persona;
  const persona = PERSONA_DESCRIPTIONS[personaKey];
  if (persona) {
    parts.push(`Persona & Tone: Adopt a ${persona.label} approach (${persona.tone}).`);
  }
  const style = LEARNING_STYLE_DESCRIPTIONS[data.learningStyle];
  if (style) {
    parts.push(`Preferred Learning Style: ${style.label} (${style.desc}).`);
  }
  if (data.customInstructions.trim()) {
    parts.push(`Additional Instructions from User: "${data.customInstructions.trim()}"`);
  }
  return parts.join("\n");
}
