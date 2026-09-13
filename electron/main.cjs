// Verity AI — Windows desktop shell (Electron main process).
// Runs the Next.js standalone server in-process (no separate Node needed:
// PGlite is WASM and onnxruntime-node is N-API, both load inside Electron),
// stores all data under %APPDATA%/Verity AI, and lives in the system tray.
//
// Dev:  npm run dev  (terminal 1) +  npm run electron:dev  (terminal 2)
// Prod: built by `npm run dist:win` into a double-clickable installer.
const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");

const PORT = Number(process.env.VERITY_PORT || "3000");
const URL = `http://127.0.0.1:${PORT}`;
const isDev = !app.isPackaged;

let mainWindow = null;
let tray = null;

function iconPath() {
  if (isDev) {
    const png = path.join(__dirname, "..", "main-logo.png");
    if (fs.existsSync(png)) return png;
  }
  const ico = path.join(__dirname, "..", "build", "icon.ico");
  if (fs.existsSync(ico)) return ico;
  return undefined;
}

/** Start the bundled Next.js standalone server inside this process. */
function startServer() {
  // Writable home for the embedded DB, KokoClone checkout/venv, and models.
  // chdir first so every cwd-relative path (./.verity, ./kokoclone) lands here.
  try {
    process.chdir(app.getPath("userData"));
  } catch {
    // Non-fatal: falls back to the install dir (may need admin rights).
  }
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "127.0.0.1";
  // Migrations ship inside Resources; resolve absolutely (cwd just changed).
  const migrations = isDev
    ? path.join(__dirname, "..", "drizzle")
    : path.join(process.resourcesPath, "app", "drizzle");
  if (fs.existsSync(migrations)) process.env.VERITY_MIGRATIONS_DIR = migrations;

  const serverJs = isDev
    ? null
    : path.join(process.resourcesPath, "app", ".next", "standalone", "server.js");
  if (!serverJs || !fs.existsSync(serverJs)) {
    throw new Error(
      isDev
        ? "Dev server not bundled (expected — run `npm run dev` first)."
        : `Server bundle missing: ${serverJs}\nReinstall Verity AI.`,
    );
  }
  require(serverJs);
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
  mainWindow.on("close", (event) => {
    // Keep running in the tray like a home-server app; quit from the tray.
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const img = nativeImage.createFromPath(iconPath() || "");
  if (!img.isEmpty()) {
    tray = new Tray(img.resize({ width: 16, height: 16 }));
  } else {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip("Verity AI");
  const loginItem = app.getLoginItemSettings();
  const menu = Menu.buildFromTemplate([
    { label: "Open Verity AI", click: () => (mainWindow ? mainWindow.show() : createWindow()) },
    { label: "Open in browser", click: () => void shell.openExternal(URL) },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: Boolean(loginItem.openAtLogin),
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, name: "Verity AI" }),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        tray.destroy();
        app.exit(0);
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else mainWindow.show();
    }
  });
}

async function boot() {
  if (isDev) {
    // Dev expects `npm run dev` already running; just wait for it.
    try {
      await waitForPort(15000);
    } catch {
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
    } catch (err) {
      await dialog.showMessageBox({
        type: "error",
        title: "Verity AI could not start",
        message: "The local server failed to start.",
        detail: err instanceof Error ? err.message : String(err),
      });
      app.exit(1);
      return;
    }
  }
  createWindow();
  createTray();
  mainWindow.loadURL(URL).catch(() => undefined);
}

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
  app.on("window-all-closed", () => {
    // Stay resident in the tray (Windows home-server behavior).
  });
  app.on("activate", () => {
    if (mainWindow) mainWindow.show();
  });
}
