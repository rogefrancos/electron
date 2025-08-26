const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,

  ping: () => ipcRenderer.invoke('ping')
  // comunicacion entre los procesos, no se puede acceder a APIs de Node 
  // desde el rendered, y no puedes acceder a los objetos de html desde
  // el main.js
})