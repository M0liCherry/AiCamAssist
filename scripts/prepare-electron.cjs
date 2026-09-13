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

// The standalone server calls chdir(__dirname) on boot. Inside Electron's
// app.asar archive that path is virtual, so the call always throws ENOENT.
// All Verity data paths are absolute via env (VERITY_DATA_DIR /
// VERITY_KOKO_ROOT / VERITY_MIGRATIONS_DIR), so the chdir is unnecessary:
// neutralize it. Fail loudly if Next changes this line in a future upgrade.
const serverJs = path.join(standalone, "server.js");
const source = fs.readFileSync(serverJs, "utf8");
const CHDIR = "chdir(__dirname)";
if (!source.includes(CHDIR)) {
  throw new Error(
    `prepare-electron: expected "${CHDIR}" in .next/standalone/server.js (Next.js upgrade changed the boot code?) — review electron packaging before shipping.`,
  );
}
fs.writeFileSync(
  serverJs,
  source.replace(
    CHDIR,
    "/* verity-desktop: chdir disabled — app runs inside read-only app.asar, all data paths are absolute via env */",
  ),
);

console.log("\nElectron bundle ready at .next/standalone");
