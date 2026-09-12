export type Provider = "none" | "gemini" | "anthropic" | "ollama" | "llamacpp";

export type ProviderPreset = {
  label: string;
  shortLabel: string;
  model: string;
  embeddingModel: string;
  endpoint: string;
  needsKey: boolean;
  local: boolean;
  models: string[];
  embeddingModels: string[];
  keyUrl: string;
  description: string;
};

export type PublicSettings = {
  id: number;
  provider: Provider;
  model: string;
  embeddingModel: string;
  endpoint: string;
  sttModel: string;
  hasApiKey: boolean;
  apiKeyHint: string;
  hasElevenLabsKey: boolean;
  elevenLabsKeyHint: string;
  podcastAudioEngine: "speechSynthesis" | "elevenlabs" | "kokoclone";
  elevenLabsHostVoice: string;
  elevenLabsGuestVoice: string;
  kokoCloneEndpoint: string;
  onboardingComplete: boolean;
  privacyConsentAt: string | null;
  providerConsentAt: string | null;
  diagnosticsOptIn: boolean;
  theme: "dark" | "light";
};

export type Environment = { desktop: boolean; dataDir: string; database: string; version: string; platform: string; node: string; logPath: string };
export type Publisher = { name: string; legalEntity: string; address: string; supportEmail: string; privacyEmail: string; website: string };

export type SettingsResponse = {
  settings: PublicSettings;
  environment: Environment;
  publisher: Publisher;
  presets: Record<Exclude<Provider, "none">, ProviderPreset>;
  sttModels: string[];
};

export type StudyMetrics = {
  flashcards?: {
    mastered: number;
    learning?: number;
    newCount?: number;
    total: number;
    score: number;
    maxScore: number;
    percentage: number;
    summary?: string;
  };
  quiz?: {
    bestScore: number;
    total: number;
    percentage: number;
    attemptsCount: number;
  };
};

export type Chapter = { id: number; subjectId: number; name: string; position: number; noteCount: number; createdAt: string; updatedAt: string; studyMetrics?: StudyMetrics };
export type Subject = { id: number; name: string; description: string; position: number; noteCount: number; chapters: Chapter[]; createdAt: string; updatedAt: string; studyMetrics?: StudyMetrics };
export type Scope = { scopeType: "chapter" | "subject"; scopeId: number };

export type NoteSummary = {
  id: number;
  chapterId: number;
  title: string;
  sourceType: string;
  sourceLabel: string | null;
  status: string;
  indexState: string;
  errorMessage: string | null;
  wordCount: number;
  hasSummary: boolean;
  createdAt: string;
  updatedAt: string;
};
export type NoteFull = Omit<NoteSummary, "hasSummary"> & { content: string; summary: string | null; chapterName: string; subjectName: string; subjectId: number };
export type SearchHit = { id: number; title: string; snippet: string; sourceType: string; chapterId: number; chapterName: string; subjectId: number; subjectName: string };

export type Citation = { n: number; noteId: number; noteTitle: string; chunkId: number; snippet: string };
export type ChatMsg = { id: number; role: "user" | "assistant"; content: string; citations: Citation[]; createdAt: string };

export type PodcastTurn = { speaker: "host" | "guest"; text: string; audioUrl?: string; duration?: number };
export type PodcastScript = {
  title: string;
  summary: string;
  turns: PodcastTurn[];
  audioUrl?: string;
  audioEngine?: "speechSynthesis" | "elevenlabs" | "kokoclone";
  audioGeneratedAt?: string;
};
export type Flashcard = { question: string; answer: string; topic: string };
export type FlashcardDeck = { cards: Flashcard[] };
export type QuizQuestion = { question: string; options: string[]; correctIndex: number; topic: string; explanation: string };
export type QuizPayload = { questions: QuizQuestion[] };

export type Asset<T> = { id: number; scopeType: Scope["scopeType"]; scopeId: number; kind: "podcast" | "flashcards" | "quiz"; options: Record<string, unknown>; payload: T; sourceNoteCount: number; createdAt: string };
export type CardProgress = { id: number; cardIndex: number; status: "new" | "learning" | "mastered"; intervalDays: number; reviews: number; dueAt: string | null };
export type QuizAttempt = { id: number; score: number; total: number; topicBreakdown: Record<string, { correct: number; total: number }>; createdAt: string };
export type AssetResponse<T> = { asset: Asset<T> | null; progress: CardProgress[]; attempts: QuizAttempt[] };

export type ToastMessage = { id: number; text: string; tone?: "success" | "info" | "error" };
export type WorkspaceView = "hub" | "editor" | "podcasts" | "flashcards" | "quizzes" | "settings";
