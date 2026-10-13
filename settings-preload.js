const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsApi", {
  get: () => ipcRenderer.invoke("settings:get"),
  set: (patch) => ipcRenderer.invoke("settings:set", patch),
  reset: () => ipcRenderer.invoke("settings:reset"),
  demo: (on) => ipcRenderer.invoke("settings:demo", on),
  edit: (on) => ipcRenderer.invoke("settings:edit", on),
  onChanged: (cb) => ipcRenderer.on("settings-changed", (_event, s) => cb(s)),
});
