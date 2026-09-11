import type { NextConfig } from "next";

const desktopBuild = process.env.NITRO_DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  // The Electron shell packages the self-contained standalone server.
  output: desktopBuild ? "standalone" : undefined,
  // Native/WASM/ESM-only runtimes are loaded by Node at runtime instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@huggingface/transformers", "onnxruntime-node", "unpdf", "mammoth", "jszip", "pg"],
};

export default nextConfig;
