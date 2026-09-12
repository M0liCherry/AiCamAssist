// Minimal, read-only bridge. The renderer talks to the local API over HTTP;
// no Node or Electron APIs are exposed to page scripts.
"use strict";

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nitroDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }),
}));
