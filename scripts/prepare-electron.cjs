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
// Replace the FULL call expression: replacing only "chdir(__dirname)" leaves
// a dangling "process." prefix and ships a SyntaxError (seen in v1.0.0).
const CHDIR = "process.chdir(__dirname)";
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

// Next/Turbopack externalizes server packages as hashed alias entries that are
// ABSOLUTE SYMLINKS into this machine's node_modules:
//   .next/standalone/.next/node_modules/<pkg>-<hash> -> /abs/path/.../node_modules/<pkg>
// They resolve on the build machine but dangle everywhere else — including
// inside app.asar (which is exactly the "Cannot find package '<pkg>-<hash>'"
// 500 on installed apps). Materialize every link into a real copy.
function dereferenceAliases(dir) {
  let replaced = 0;
  const materialize = (linkPath) => {
    const target = fs.realpathSync(linkPath);
    fs.rmSync(linkPath, { recursive: true, force: true });
    fs.cpSync(target, linkPath, { recursive: true, dereference: true });
    replaced++;
  };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      materialize(full);
    } else if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
        if (sub.isSymbolicLink()) materialize(path.join(full, sub.name));
      }
    }
  }
  return replaced;
}

const aliasRoot = path.join(standalone, ".next", "node_modules");
const dereferenced = dereferenceAliases(aliasRoot);
console.log(`dereferenced ${dereferenced} hashed-alias symlinks under .next/node_modules`);

// Syntax-gate the patched bundle: a bad replacement shipped a SyntaxError in
// v1.0.0. This fails the build instead of the user's first launch.
execSync(`node --check "${serverJs}"`, { cwd: root, stdio: "inherit" });

console.log("\nElectron bundle ready at .next/standalone");
