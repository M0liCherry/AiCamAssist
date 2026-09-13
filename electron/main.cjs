// Verity AI — Windows desktop shell (Electron main process).
// Runs the Next.js standalone server in-process (no separate Node needed:
// PGlite is WASM and onnxruntime-node is N-API, both load inside Electron)
// and stores all data under %APPDATA%/Verity AI. Closing the window quits
// the app (and its local server) outright — no tray residence.
//
// Dev:  npm run dev  (terminal 1) +  npm run electron:dev  (terminal 2)
// Prod: built by `npm run dist:win` into a double-clickable installer.
const { app, BrowserWindow, shell, dialog, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const os = require("os");

const PORT = Number(process.env.VERITY_PORT || "3000");
const URL = `http://127.0.0.1:${PORT}`;
const isDev = !app.isPackaged;

let mainWindow = null;
let logPath = null;
const logLines = [];

/** Append-only startup log: %APPDATA%/Verity AI/launcher.log (temp fallback). */
function initLog() {
  try {
    const dir = app.getPath("userData");
    fs.mkdirSync(dir, { recursive: true });
    logPath = path.join(dir, "launcher.log");
  } catch {
    logPath = path.join(os.tmpdir(), "verity-ai-launcher.log");
  }
  log(
    `=== Verity AI launch ${new Date().toISOString()} ===`,
    `version=${app.getVersion()} packaged=${app.isPackaged} platform=${process.platform} arch=${process.arch}`,
    `electron=${process.versions.electron} node=${process.versions.node}`,
  );
}

function log(...lines) {
  for (const line of lines) {
    const entry = `[${new Date().toISOString()}] ${line}`;
    logLines.push(entry);
    try {
      if (logPath) fs.appendFileSync(logPath, `${entry}\n`);
    } catch {
      // Logging must never break startup.
    }
  }
}

/**
 * Failure dialog with Copy details (clipboard) + Open log folder, so users
 * can send the full report instead of a screenshot.
 */
async function reportFailure(title, message) {
  const report = [
    `Verity AI startup failure — ${new Date().toISOString()}`,
    `App ${app.getVersion()} (packaged=${app.isPackaged}) on ${process.platform} ${process.arch}`,
    `resourcesPath=${process.resourcesPath}`,
    "",
    message,
    "",
    "--- launcher.log ---",
    ...logLines.slice(-80),
  ].join("\n");
  log(`FAILURE: ${message}`);
  try {
    clipboard.writeText(report);
  } catch {
    // Clipboard unavailable — the log file is still on disk.
  }
  const { response } = await dialog.showMessageBox({
    type: "error",
    title: "Verity AI could not start",
    message: title,
    detail: `${message}\n\nFull details were copied to your clipboard and saved to:\n${logPath || "(log unavailable)"}`,
    buttons: ["Copy details again", "Open log folder", "OK"],
    defaultId: 2,
    noLink: true,
  });
  if (response === 0) {
    try {
      clipboard.writeText(report);
    } catch {
      // ignore
    }
  } else if (response === 1 && logPath) {
    shell.showItemInFolder(logPath).catch(() => undefined);
  }
}

function iconPath() {
  if (isDev) {
    const png = path.join(__dirname, "..", "main-logo.png");
    if (fs.existsSync(png)) return png;
  }
  const ico = path.join(__dirname, "..", "build", "icon.ico");
  if (fs.existsSync(ico)) return ico;
  return undefined;
}

/** Locate the bundled Next.js standalone server, with diagnostics. */
function findServer() {
  const candidates = [
    path.join(process.resourcesPath, "app", ".next", "standalone", "server.js"),
    path.join(process.resourcesPath, "app.asar", ".next", "standalone", "server.js"),
  ];
  for (const candidate of candidates) {
    let exists = false;
    try {
      exists = fs.existsSync(candidate);
    } catch {
      // try next
    }
    log(`probe server bundle: ${candidate} -> ${exists ? "FOUND" : "missing"}`);
    if (exists) return candidate;
  }
  return null;
}

/** Start the bundled Next.js standalone server inside this process. */
function startServer() {
  // All writable state lives under %APPDATA%/Verity AI. NOTE: do NOT chdir
  // there — the Next.js standalone server calls chdir(__dirname) on boot,
  // which fails inside the asar archive. Every data path is absolute instead:
  // the app honors VERITY_DATA_DIR / VERITY_KOKO_ROOT absolutely.
  const home = app.getPath("userData");
  log(`userData=${home}`);
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(home, ".verity"), { recursive: true });
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.VERITY_DATA_DIR = path.join(home, ".verity");
  process.env.VERITY_KOKO_ROOT = home;
  // Migrations ship inside Resources; resolve absolutely. Probe the explicit
  // asar path too: never rely on implicit app/ -> app.asar fallback (a stray
  // real directory shadows the archive and silently resolves wrong).
  const migrations = isDev
    ? path.join(__dirname, "..", "drizzle")
    : [
        path.join(process.resourcesPath, "app", "drizzle"),
        path.join(process.resourcesPath, "app.asar", "drizzle"),
      ].find((candidate) => {
        try {
          return fs.existsSync(candidate);
        } catch {
          return false;
        }
      });
  if (migrations) process.env.VERITY_MIGRATIONS_DIR = migrations;
  log(`migrations=${migrations || "MISSING!"} (${migrations ? "present" : "not found in resources"})`);
  log(`cwd=${process.cwd()}`);

  const serverJs = isDev ? null : findServer();
  if (!serverJs) {
    let hint = "";
    try {
      hint = `\nresourcesPath: ${process.resourcesPath}\nresources: ${(fs.readdirSync(process.resourcesPath) || []).join(", ")}`;
    } catch {
      hint = `\nresourcesPath unreadable: ${process.resourcesPath}`;
    }
    log(`FATAL: server bundle not found.${hint.replaceAll("\n", " | ")}`);
    throw new Error(
      isDev
        ? "Dev server not bundled (expected — run `npm run dev` first)."
        : `Server bundle missing.${hint}\nReinstall Verity AI.`,
    );
  }
  log(`requiring server bundle: ${serverJs}`);
  try {
    require(serverJs);
    log("server bundle loaded, waiting for port");
  } catch (err) {
    const message = err instanceof Error ? (err.stack || err.message) : String(err);
    log(`FATAL: require(serverJs) threw: ${message}`);
    throw new Error(`Server bundle failed to load: ${serverJs}\n${message}`);
  }
}

/** Wait until 127.0.0.1:PORT accepts connections. */
function waitForPort(timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(PORT, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Verity AI server did not start on port ${PORT} in time.`));
        } else {
          setTimeout(attempt, 500);
        }
      });
    };
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: "Verity AI",
    icon: iconPath(),
    backgroundColor: "#141218",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  // Closing the window quits the app entirely (no tray residence).
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot() {
  initLog();
  if (isDev) {
    // Dev expects `npm run dev` already running; just wait for it.
    try {
      await waitForPort(15000);
    } catch {
      log("dev server not detected on port 3000");
      await dialog.showMessageBox({
        type: "warning",
        title: "Verity AI",
        message: "Dev server not detected.",
        detail: `Start it first with "npm run dev", then relaunch the desktop shell.`,
      });
      app.exit(0);
      return;
    }
  } else {
    try {
      startServer();
      await waitForPort();
      log(`server accepting connections on ${URL}`);
    } catch (err) {
      await reportFailure(
        "The local server failed to start.",
        err instanceof Error ? err.message : String(err),
      );
      app.exit(1);
      return;
    }
  }
  createWindow();
  mainWindow.loadURL(URL).catch(() => undefined);
}

process.on("uncaughtException", (err) => {
  try {
    log(`UNCAUGHT: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  } catch {
    // ignore
  }
});
process.on("unhandledRejection", (reason) => {
  try {
    log(`UNHANDLED REJECTION: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
  } catch {
    // ignore
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => void boot());
  // Closing the window ends the app (including its local server).
  app.on("window-all-closed", () => {
    app.quit();
  });
  app.on("activate", () => {
    if (mainWindow) mainWindow.show();
  });
}
