const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (username, password) => ipcRenderer.invoke('login', username, password),
});

contextBridge.exposeInMainWorld('apiPac', {
  regPac: (nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) => ipcRenderer.invoke('regPac', nombre, apellidoP, apellidoM,  genero, fechaNac, correo, telefono),
});

contextBridge.exposeInMainWorld('apiCit', {
  regCit: (nombre, fecha, hora, nota) => ipcRenderer.invoke('regCit', nombre, fecha, hora, nota),
});

// Results page APIs
contextBridge.exposeInMainWorld('apiResults', {
  // opens native dialog and returns { canceled, filePath, content }
  selectFile: () => ipcRenderer.invoke('select-hl7-file'),
  // generate PDF from HL7 content. Parameters: content (string), filenameBase (string without extension)
  generatePDF: (content, filenameBase) => ipcRenderer.invoke('generate-pdf-from-hl7', content, filenameBase),
  // get patients list
  getPatients: () => ipcRenderer.invoke('get-patients'),
  // open external URL (WhatsApp)
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url)
});