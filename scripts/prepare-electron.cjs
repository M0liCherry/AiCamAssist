// Prepares the Next.js standalone output for Electron packaging:
// 1. `next build` with VERITY_STANDALONE=true
// 2. copies public/ and .next/static into .next/standalone (Next standalone layout)
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

execSync("npx next build", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VERITY_STANDALONE: "true" },
});

fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

console.log("\nElectron bundle ready at .next/standalone");
