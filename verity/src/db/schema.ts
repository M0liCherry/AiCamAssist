import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

/** Single-row application settings (provider choice, encrypted key, consents). */
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 32 }).default("none").notNull(),
  model: varchar("model", { length: 160 }).default("").notNull(),
  embeddingModel: varchar("embedding_model", { length: 160 }).default("").notNull(),
  endpoint: varchar("endpoint", { length: 400 }).default("").notNull(),
  apiKeyEncrypted: text("api_key_encrypted"),
  sttModel: varchar("stt_model", { length: 160 }).default("Xenova/whisper-base").notNull(),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
  providerConsentAt: timestamp("provider_consent_at", { withTimezone: true }),
  diagnosticsOptIn: boolean("diagnostics_opt_in").default(false).notNull(),
  theme: varchar("theme", { length: 12 }).default("dark").notNull(),
  elevenLabsApiKeyEncrypted: text("elevenlabs_api_key_encrypted"),
  podcastAudioEngine: varchar("podcast_audio_engine", { length: 32 }).default("speechSynthesis").notNull(),
  elevenLabsHostVoice: varchar("elevenlabs_host_voice", { length: 80 }).default("21m00Tcm4TlvDq8ikWAM").notNull(),
  elevenLabsGuestVoice: varchar("elevenlabs_guest_voice", { length: 80 }).default("pNInz6obpgDQGcFmaJgB").notNull(),
  kokoCloneEndpoint: varchar("kokoclone_endpoint", { length: 255 }).default("http://127.0.0.1:7860").notNull(),
  ...timestamps,
});

/** Subject collections, e.g. "Database Systems". */
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").default("").notNull(),
  position: integer("position").default(0).notNull(),
  ...timestamps,
});

/** Chapter sub-collections nested inside a subject. */
export const chapters = pgTable(
  "chapters",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (table) => [index("chapters_subject_idx").on(table.subjectId)],
);

/** Parsed notes. Content is Markdown/plain text extracted from the source. */
export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    chapterId: integer("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 300 }).notNull(),
    content: text("content").default("").notNull(),
    summary: text("summary"),
    sourceType: varchar("source_type", { length: 32 }).default("document").notNull(),
    sourceLabel: varchar("source_label", { length: 600 }),
    status: varchar("status", { length: 24 }).default("ready").notNull(),
    indexState: varchar("index_state", { length: 24 }).default("none").notNull(),
    errorMessage: text("error_message"),
    wordCount: integer("word_count").default(0).notNull(),
    ...timestamps,
  },
  (table) => [index("notes_chapter_idx").on(table.chapterId)],
);

/** Retrieval chunks with optional embedding vectors (stored as JSON arrays). */
export const chunks = pgTable(
  "chunks",
  {
    id: serial("id").primaryKey(),
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    chapterId: integer("chapter_id").notNull(),
    subjectId: integer("subject_id").notNull(),
    position: integer("position").default(0).notNull(),
    content: text("content").notNull(),
    embedding: jsonb("embedding").$type<number[] | null>(),
    embeddingModel: varchar("embedding_model", { length: 200 }),
  },
  (table) => [
    index("chunks_note_idx").on(table.noteId),
    index("chunks_chapter_idx").on(table.chapterId),
    index("chunks_subject_idx").on(table.subjectId),
  ],
);

export type Citation = { n: number; noteId: number; noteTitle: string; chunkId: number; snippet: string };

/** Assistant chat history per scope (chapter or subject). */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    scopeType: varchar("scope_type", { length: 12 }).notNull(),
    scopeId: integer("scope_id").notNull(),
    role: varchar("role", { length: 12 }).notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<Citation[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("chat_scope_idx").on(table.scopeType, table.scopeId)],
);

/** Generated podcasts, flashcard decks, and quizzes per scope. */
export const generatedAssets = pgTable(
  "generated_assets",
  {
    id: serial("id").primaryKey(),
    scopeType: varchar("scope_type", { length: 12 }).notNull(),
    scopeId: integer("scope_id").notNull(),
    kind: varchar("kind", { length: 16 }).notNull(),
    options: jsonb("options").$type<Record<string, unknown>>().default({}).notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    sourceNoteCount: integer("source_note_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("assets_scope_idx").on(table.scopeType, table.scopeId, table.kind)],
);

/** Spaced-repetition state for each card in a deck. */
export const flashcardProgress = pgTable(
  "flashcard_progress",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => generatedAssets.id, { onDelete: "cascade" }),
    cardIndex: integer("card_index").notNull(),
    status: varchar("status", { length: 12 }).default("new").notNull(),
    intervalDays: integer("interval_days").default(0).notNull(),
    reviews: integer("reviews").default(0).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("progress_asset_idx").on(table.assetId)],
);

/** Completed quiz attempts with per-topic mastery. */
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => generatedAssets.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, number>>().default({}).notNull(),
    score: integer("score").default(0).notNull(),
    total: integer("total").default(0).notNull(),
    topicBreakdown: jsonb("topic_breakdown")
      .$type<Record<string, { correct: number; total: number }>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("attempts_asset_idx").on(table.assetId)],
);

export type Settings = typeof settings.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type GeneratedAsset = typeof generatedAssets.$inferSelect;
export type FlashcardProgressRow = typeof flashcardProgress.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
