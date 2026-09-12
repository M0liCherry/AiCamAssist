/** Third-party components bundled with or downloaded by VerityAI, with licenses. */
export type ThirdPartyItem = { name: string; license: string; url: string; note?: string };

export const THIRD_PARTY: ThirdPartyItem[] = [
  { name: "Next.js", license: "MIT", url: "https://github.com/vercel/next.js" },
  { name: "React / React DOM", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Drizzle ORM / Drizzle Kit", license: "Apache-2.0", url: "https://github.com/drizzle-team/drizzle-orm" },
  { name: "node-postgres (pg)", license: "MIT", url: "https://github.com/brianc/node-postgres" },
  { name: "PGlite (embedded PostgreSQL)", license: "Apache-2.0", url: "https://github.com/electric-sql/pglite", note: "PostgreSQL itself is distributed under the PostgreSQL License." },
  { name: "Lucide icons (lucide-react)", license: "ISC", url: "https://lucide.dev/license", note: "All interface icons are Lucide SVGs; no proprietary icon sets are bundled." },
  { name: "unpdf (bundles PDF.js)", license: "MIT / Apache-2.0", url: "https://github.com/unjs/unpdf" },
  { name: "mammoth.js (DOCX extraction)", license: "BSD-2-Clause", url: "https://github.com/mwilliamson/mammoth.js" },
  { name: "JSZip (PPTX extraction)", license: "MIT (dual-licensed MIT/GPLv3; used under MIT)", url: "https://github.com/Stuk/jszip" },
  { name: "Transformers.js (@huggingface/transformers)", license: "Apache-2.0", url: "https://github.com/huggingface/transformers.js" },
  { name: "ONNX Runtime", license: "MIT", url: "https://github.com/microsoft/onnxruntime" },
  { name: "OpenAI Whisper weights (ONNX conversions published by Xenova)", license: "MIT", url: "https://huggingface.co/Xenova/whisper-base", note: "Downloaded on first use of audio transcription and cached locally." },
  { name: "Tailwind CSS", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "Interface typography", license: "System fonts only", url: "", note: "VerityAI uses the operating system font stack (Segoe UI on Windows). No web fonts are bundled or fetched." },
  { name: "Local LLMs pulled through Ollama (e.g. Qwen 2.5 / Qwen 3)", license: "Per model card (Qwen: Apache-2.0)", url: "https://ollama.com/library", note: "Model weights are downloaded by the user on demand and governed by their own licenses." },
];
