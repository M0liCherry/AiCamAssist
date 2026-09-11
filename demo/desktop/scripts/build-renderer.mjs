// Builds the Next.js renderer in standalone mode and assembles everything the
// Electron shell needs into ../.next/standalone (static assets, public files,
// Drizzle migrations). Cross-platform: works from cmd.exe, PowerShell, or bash.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const standalone = path.join(root, ".next", "standalone");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, NITRO_DESKTOP_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1" } });
  if (result.status !== 0) {
    console.error(`\n${command} ${args.join(" ")} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log("▸ Building NitroAI renderer (Next.js standalone)…");
rmSync(path.join(root, ".next"), { recursive: true, force: true });
run("npx", ["next", "build"]);

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("Standalone server.js was not produced. Ensure NITRO_DESKTOP_BUILD=1 enables output: 'standalone' in next.config.ts.");
  process.exit(1);
}

console.log("▸ Copying static assets, public files, and migrations…");
mkdirSync(path.join(standalone, ".next"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
if (existsSync(path.join(root, "public"))) cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
cpSync(path.join(root, "drizzle"), path.join(standalone, "drizzle"), { recursive: true });

console.log(`✓ Renderer ready at ${standalone}`);
