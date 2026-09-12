import { chatCompletion, isLocalProvider, ProviderError, stripThinking, type ProviderConfig } from "./provider";

export type DigestNote = { id: number; title: string; content: string };
export type PodcastTurn = { speaker: "host" | "guest"; text: string };
export type PodcastScript = { title: string; summary: string; turns: PodcastTurn[] };
export type Flashcard = { question: string; answer: string; topic: string };
export type QuizQuestion = { question: string; options: string[]; correctIndex: number; topic: string; explanation: string };
export type ContextBlock = { n: number; title: string; content: string };

const PODCAST_TURNS = { short: 8, medium: 14, long: 22 } as const;
export type PodcastLength = keyof typeof PODCAST_TURNS;

function sampleText(content: string, allowance: number) {
  if (content.length <= allowance) return content;
  const head = Math.floor(allowance * 0.6);
  const middle = Math.floor(allowance * 0.25);
  const tail = allowance - head - middle;
  const midStart = Math.floor(content.length / 2 - middle / 2);
  return `${content.slice(0, head)}\n[…]\n${content.slice(midStart, midStart + middle)}\n[…]\n${content.slice(content.length - tail)}`;
}

/** Packs the scope's notes into the model's context budget, sampling long notes evenly. */
export function buildDigest(notesList: DigestNote[], budget: number) {
  const usable = notesList.filter((n) => n.content.trim().length > 0);
  const total = usable.reduce((sum, n) => sum + n.content.length, 0);
  if (!total) return { text: "", truncated: false };
  const ratio = Math.min(1, budget / total);
  const parts = usable.map((n) => {
    const allowance = Math.max(400, Math.floor(n.content.length * ratio));
    return `### ${n.title}\n${sampleText(n.content, allowance)}`;
  });
  return { text: parts.join("\n\n"), truncated: ratio < 1 };
}

export function parseJson<T>(text: string): T {
  const cleaned = stripThinking(text).replace(/```(?:json)?/gi, "").trim();
  const starts = ["{", "["].map((ch) => cleaned.indexOf(ch)).filter((i) => i >= 0);
  if (!starts.length) throw new ProviderError("The model reply did not contain JSON.", 502, "bad_json");
  const candidate = cleaned.slice(Math.min(...starts));
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  const slice = end === -1 ? candidate : candidate.slice(0, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    throw new ProviderError("The model returned malformed JSON. Try again, choose fewer items, or use a larger model.", 502, "bad_json");
  }
}

async function jsonTask<T>(cfg: ProviderConfig, system: string, user: string, validate: (raw: unknown) => T): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const suffix = attempt === 0 ? "" : "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object — no prose, no markdown fences.";
    try {
      const text = await chatCompletion(
        cfg,
        [
          { role: "system", content: system },
          { role: "user", content: user + suffix },
        ],
        { json: true, temperature: attempt === 0 ? 0.5 : 0.2, maxTokens: isLocalProvider(cfg.provider) ? 3000 : 12000 },
      );
      return validate(parseJson<unknown>(text));
    } catch (error) {
      lastError = error;
      if (!(error instanceof ProviderError) || error.code !== "bad_json") throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new ProviderError("Generation failed.");
}

const GROUNDING = "Use only the provided study notes. Never invent facts, names, numbers, or sources that the notes do not support. Output JSON only.";

/** Appends the user's stored learning preferences (persona, style, name) when set. */
function personalize(prompt: string, personalization?: string): string {
  return personalization ? `${prompt}\n\nUser's Personal Learning Preferences:\n${personalization}\n` : prompt;
}

export async function generatePodcast(cfg: ProviderConfig, digest: string, scopeTitle: string, length: PodcastLength, personalization?: string): Promise<PodcastScript> {
  const turns = PODCAST_TURNS[length];
  const user = personalize(`Study notes for "${scopeTitle}":\n\n${digest}\n\nWrite an educational podcast conversation with exactly ${turns} alternating turns between "host" (opens the show, guides the discussion, asks clarifying questions, and closes with a recap) and "guest" (an expert who explains concepts precisely with concrete examples from the notes). Each turn is 2–4 natural spoken sentences. Cover the most important ideas in a logical order and define key terms when they first appear.\nReturn JSON: {"title": string, "summary": string, "turns": [{"speaker": "host" | "guest", "text": string}]}`, personalization);
  return jsonTask(cfg, `You write engaging, accurate two-person educational podcast scripts. ${GROUNDING}`, user, (raw) => {
    const obj = raw as { title?: unknown; summary?: unknown; turns?: unknown };
    const list = Array.isArray(obj.turns) ? (obj.turns as Partial<PodcastTurn>[]) : [];
    const normalized: PodcastTurn[] = list
      .map((turn, index) => {
        const speaker: "host" | "guest" = turn?.speaker === "guest" ? "guest" : turn?.speaker === "host" ? "host" : index % 2 === 0 ? "host" : "guest";
        return { speaker, text: String(turn?.text ?? "").trim() };
      })
      .filter((turn) => turn.text.length > 0);
    if (normalized.length < 2) throw new ProviderError("The model returned an empty script.", 502, "bad_json");
    return { title: String(obj.title || scopeTitle), summary: String(obj.summary || ""), turns: normalized };
  });
}

export async function generateFlashcards(cfg: ProviderConfig, digest: string, scopeTitle: string, count: number, personalization?: string): Promise<Flashcard[]> {
  const user = personalize(`Study notes for "${scopeTitle}":\n\n${digest}\n\nCreate ${count} high-quality spaced-repetition flashcards. Each card tests one specific fact, definition, mechanism, or comparison from the notes. Questions must be answerable from the notes; answers should be concise (1–3 sentences) but complete. Highlight key terms with **bold** (double asterisks only, never triple). Assign each card a short topic label (2–4 words) so cards cluster into 3–6 sub-topics.\nReturn JSON: {"cards": [{"question": string, "answer": string, "topic": string}]}`, personalization);
  return jsonTask(cfg, `You create precise study flashcards. ${GROUNDING}`, user, (raw) => {
    const obj = raw as { cards?: unknown };
    const list = Array.isArray(obj.cards) ? (obj.cards as Partial<Flashcard>[]) : [];
    const cards = list
      .map((card) => ({ question: String(card?.question ?? "").trim(), answer: String(card?.answer ?? "").trim(), topic: String(card?.topic ?? "General").trim() || "General" }))
      .filter((card) => card.question && card.answer)
      .slice(0, count);
    if (!cards.length) throw new ProviderError("The model returned no flashcards.", 502, "bad_json");
    return cards;
  });
}

export async function generateQuiz(cfg: ProviderConfig, digest: string, scopeTitle: string, difficulty: string, count: number, personalization?: string): Promise<QuizQuestion[]> {
  const guidance =
    difficulty === "Beginner"
      ? "Focus on definitions, core terminology, and direct recall."
      : difficulty === "Advanced"
        ? "Focus on analysis, comparisons, edge cases, trade-offs, and applying concepts to new scenarios. Distractors must be plausible."
        : "Mix recall with understanding: relationships between ideas, why something works, and simple application.";
  const user = personalize(`Study notes for "${scopeTitle}":\n\n${digest}\n\nWrite ${count} multiple-choice questions at ${difficulty} level. ${guidance} Each question has exactly 4 options with exactly one correct answer; vary the position of the correct option. Provide a one- or two-sentence explanation grounded in the notes. Assign each question a short topic label (2–4 words) so the set spans 3–5 sub-topics.\nReturn JSON: {"questions": [{"question": string, "options": [string, string, string, string], "correctIndex": 0 | 1 | 2 | 3, "topic": string, "explanation": string}]}`, personalization);
  return jsonTask(cfg, `You write fair, unambiguous assessment questions. ${GROUNDING}`, user, (raw) => {
    const obj = raw as { questions?: unknown };
    const list = Array.isArray(obj.questions) ? (obj.questions as Partial<QuizQuestion>[]) : [];
    const questions: QuizQuestion[] = [];
    for (const item of list) {
      const options = Array.isArray(item?.options) ? item.options.map((o) => String(o).trim()).filter(Boolean) : [];
      const correctIndex = Number(item?.correctIndex);
      const question = String(item?.question ?? "").trim();
      if (!question || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;
      questions.push({ question, options, correctIndex, topic: String(item?.topic ?? "General").trim() || "General", explanation: String(item?.explanation ?? "").trim() });
    }
    if (!questions.length) throw new ProviderError("The model returned no usable questions.", 502, "bad_json");
    return questions.slice(0, count);
  });
}

export async function summarizeNote(cfg: ProviderConfig, title: string, content: string, personalization?: string): Promise<string> {
  const text = await chatCompletion(
    cfg,
    [
      { role: "system", content: "You summarize study material faithfully. Use only the provided text; do not add outside facts. Write Markdown." },
      { role: "user", content: personalize(`Summarize the note "${title}" for revision. Produce:\n## Key takeaways\n(5–8 bullet points)\n## Key terms\n(term — short definition, up to 8)\n## One-paragraph overview\n\nNote text:\n${content}`, personalization) },
    ],
    { temperature: 0.3, maxTokens: isLocalProvider(cfg.provider) ? 1200 : 2500 },
  );
  return stripThinking(text);
}

export async function generateStudyNotesFromTranscript(
  cfg: ProviderConfig,
  title: string,
  transcript: string,
  sourceLabel: string,
  sourceType: "youtube" | "audio",
): Promise<string> {
  const sample = transcript.slice(0, 16000);
  const prompt = `Source: ${sourceLabel} (${sourceType === "youtube" ? "YouTube video" : "Spoken audio recording"})\nTitle: "${title}"\n\nTranscript:\n${sample}\n\nConvert this transcript into clear, comprehensive study notes in Markdown:\n# ${title}\n\n## Overview\n(2-3 paragraphs explaining the core concepts and background)\n\n## Key Takeaways & Core Concepts\n(bullet points with bolded key terms)\n\n## Detailed Study Notes\n(organized by main topics discussed)\n\n## Verbatim Transcript\n<details><summary>Click to expand full transcript</summary>\n\n${transcript.slice(0, 8000)}\n\n</details>`;

  try {
    const text = await chatCompletion(
      cfg,
      [
        { role: "system", content: "You are an expert academic tutor and note synthesis assistant for Verity AI. Produce high-quality, structured Markdown study notes from spoken transcripts." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxTokens: isLocalProvider(cfg.provider) ? 1600 : 4000, timeoutMs: 12000 },
    );
    const cleaned = stripThinking(text).trim();
    if (cleaned.length > 50) return cleaned;
  } catch {
    // Fallback below
  }

  return `# ${title}\n\n*Source: ${sourceLabel}*\n\n## Overview\nTranscribed from ${sourceType === "youtube" ? "YouTube video" : "audio recording"} for study and revision.\n\n## Detailed Notes & Transcript\n\n${transcript}`;
}

export async function answerQuestion(
  cfg: ProviderConfig,
  question: string,
  context: ContextBlock[],
  history: { role: "user" | "assistant"; content: string }[],
  scopeTitle: string,
  personalization?: string,
): Promise<string> {
  const excerpts = context.map((c) => `[${c.n}] ${c.title}\n${c.content}`).join("\n\n");
  const personalGuidance = personalization ? `\nUser's Personal Learning Preferences:\n${personalization}\n` : "";
  const system = `You are Verity, the knowledgeable, helpful, and friendly study assistant inside Verity AI. Answer using the numbered source excerpts from the user's own notes in "${scopeTitle}". Cite the excerpts you rely on inline with bracketed numbers such as [1] or [2][3]. If the excerpts do not contain the answer, say so plainly and suggest what material to add; never fabricate citations or facts. Write clear Markdown with structured sections, bullet points, or code blocks as needed, and finish with a one-line "Sources used:" list of the citation numbers.${personalGuidance}`;
  const prompt = context.length
    ? `Source excerpts:\n\n${excerpts}\n\nQuestion: ${question}`
    : `No source excerpts were retrieved for this question. Question: ${question}\n\nExplain that the current collection has no relevant notes and how the user can add some.`;
  const text = await chatCompletion(
    cfg,
    [{ role: "system", content: system }, ...history.slice(-8), { role: "user", content: prompt }],
    { temperature: 0.3, maxTokens: isLocalProvider(cfg.provider) ? 1500 : 4000 },
  );
  return stripThinking(text);
}
