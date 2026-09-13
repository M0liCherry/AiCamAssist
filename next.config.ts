import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // VERITY_STANDALONE=true produces the self-contained server bundle that the
  // Windows desktop shell (Electron) runs. Regular `next build` / Vercel are
  // unaffected.
  ...(process.env.VERITY_STANDALONE === "true" ? { output: "standalone" as const } : {}),
  // Native/WASM/ESM-only runtimes are loaded by Node at runtime instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@huggingface/transformers", "onnxruntime-node", "unpdf", "mammoth", "jszip", "pg"],
};

export default nextConfig;
