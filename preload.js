const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  onState: (cb) => ipcRenderer.on("state", (_event, state) => cb(state)),
  onSettings: (cb) => ipcRenderer.on("settings", (_event, s) => cb(s)),
  onEdit: (cb) => ipcRenderer.on("edit", (_event, on) => cb(on)),
});
