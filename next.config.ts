import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Native/WASM/ESM-only runtimes are loaded by Node at runtime instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@huggingface/transformers", "onnxruntime-node", "unpdf", "mammoth", "jszip", "pg"],
};

export default nextConfig;
