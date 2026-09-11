// NitroAI desktop shell (Electron main process).
// Responsibilities: start the bundled Next.js server on a loopback port with
// the user's local data directory, open a hardened BrowserWindow, and provide
// native menus. No telemetry or crash reporter is initialised.
"use strict";

const { app, BrowserWindow, Menu, dialog, shell, utilityProcess, nativeTheme } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const APP_ID = "com.nitroai.desktop";
const PRODUCT = "NitroAI";
const isDev = !app.isPackaged;

app.setAppUserModelId(APP_ID);
app.setName(PRODUCT);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/** @type {import("electron").UtilityProcess | null} */
let server = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let serverUrl = "";
let quitting = false;

const dataDir = path.join(app.getPath("appData"), PRODUCT);
const logDir = path.join(dataDir, "logs");
const logFile = path.join(logDir, "desktop.log");

function log(line) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${String(line).trimEnd()}\n`);
  } catch {
    // logging must never crash the app
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForHealth(url, timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(`${url}/api/health`, (response) => {
        response.resume();
        if (response.statusCode === 200) return resolve();
        retry();
      });
      request.on("error", retry);
      request.setTimeout(2000, () => request.destroy(new Error("timeout")));
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error("The local NitroAI service did not become ready in time."));
      setTimeout(attempt, 400);
    };
    attempt();
  });
}

function appRoot() {
  return isDev ? path.join(__dirname, "..", ".next", "standalone") : path.join(process.resourcesPath, "app");
}

async function startServer() {
  const root = appRoot();
  const entry = path.join(root, "server.js");
  if (!fs.existsSync(entry)) {
    throw new Error(`Renderer build not found at ${entry}. Run "npm run dist" inside the desktop folder first.`);
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const port = await findFreePort();
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NITRO_DATA_DIR: dataDir,
    NITRO_MIGRATIONS_DIR: path.join(root, "drizzle"),
    NITRO_DESKTOP: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  delete env.DATABASE_URL;
  delete env.ELECTRON_RUN_AS_NODE;

  server = utilityProcess.fork(entry, [], { cwd: root, env, stdio: "pipe", serviceName: "nitroai-server" });
  server.stdout?.on("data", (chunk) => log(`[server] ${chunk}`));
  server.stderr?.on("data", (chunk) => log(`[server:err] ${chunk}`));
  server.on("exit", (code) => {
    log(`server exited with code ${code}`);
    server = null;
    if (!quitting) {
      dialog.showErrorBox(`${PRODUCT} stopped`, `The local service exited unexpectedly (code ${code}).\nSee ${logFile} for details.`);
      app.quit();
    }
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(serverUrl);
  log(`server ready at ${serverUrl}`);
  return serverUrl;
}

function isSafeExternal(url) {
  return /^(https?:|mailto:)/i.test(url);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: PRODUCT,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0e0f14" : "#f5f5f8",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      devTools: isDev,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Keep the renderer inside the local app; open everything else in the default browser.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(serverUrl)) {
      event.preventDefault();
      if (isSafeExternal(url)) void shell.openExternal(url);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(serverUrl)) return { action: "allow" };
    if (isSafeExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    // Only what the study workspace needs; no camera, geolocation, notifications, etc.
    callback(["media", "clipboard-read", "clipboard-sanitized-write"].includes(permission));
  });

  void mainWindow.loadURL(serverUrl);
}

function buildMenu() {
  const version = app.getVersion();
  const openInApp = (route) => {
    if (mainWindow) void mainWindow.loadURL(`${serverUrl}${route}`);
  };
  /** @type {import("electron").MenuItemConstructorOptions[]} */
  const template = [
    {
      label: "&File",
      submenu: [
        { label: "Open data folder", click: () => void shell.openPath(dataDir) },
        { label: "Open log folder", click: () => void shell.openPath(logDir) },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { label: "&Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    {
      label: "&View",
      submenu: [
        { label: "Workspace", accelerator: "CmdOrCtrl+Home", click: () => openInApp("/") },
        { role: "reload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ type: "separator" }, { role: "toggleDevTools" }] : []),
      ],
    },
    { label: "&Window", submenu: [{ role: "minimize" }, { role: "close" }] },
    {
      label: "&Help",
      submenu: [
        { label: "Privacy Policy", click: () => openInApp("/legal/privacy") },
        { label: "Terms & Conditions", click: () => openInApp("/legal/terms") },
        { label: "Telemetry & Diagnostics", click: () => openInApp("/legal/telemetry") },
        { label: "License, Refunds & Support", click: () => openInApp("/legal/license") },
        { label: "Accessibility Statement", click: () => openInApp("/legal/accessibility") },
        { label: "Open-source licenses", click: () => openInApp("/legal/licenses") },
        { type: "separator" },
        {
          label: `About ${PRODUCT}`,
          click: () =>
            void dialog.showMessageBox({
              type: "info",
              title: `About ${PRODUCT}`,
              message: `${PRODUCT} ${version}`,
              detail: `Local-first AI study workspace.\nData folder: ${dataDir}\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}\n\nPublisher and support details are listed under Settings → About inside the app.`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    log(`starting ${PRODUCT} ${app.getVersion()} (packaged: ${!isDev})`);
    await startServer();
    buildMenu();
    createWindow();
  } catch (error) {
    log(`startup failed: ${error && error.stack ? error.stack : error}`);
    dialog.showErrorBox(`${PRODUCT} could not start`, `${error && error.message ? error.message : error}\n\nLog: ${logFile}`);
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverUrl) createWindow();
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  if (server) {
    server.kill();
    server = null;
  }
});
