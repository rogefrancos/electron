const { contextBridge, ipcRenderer } = require('electron');

/*
  preload.js
  - Exponemos APIs seguras para renderer.
*/

contextBridge.exposeInMainWorld('api', {
  login: (username, password) => ipcRenderer.invoke('login', username, password),
});

contextBridge.exposeInMainWorld('apiUsers', {
  getActiveUser: () => ipcRenderer.invoke('get-active-user'),
  logout: () => ipcRenderer.invoke('logout'),
  getAllUsers: () => ipcRenderer.invoke('get-all-users'),
  createUser: (username, password, role) => ipcRenderer.invoke('create-user', username, password, role),
  updateUser: (id, fields) => ipcRenderer.invoke('update-user', id, fields),
  deleteUser: (id) => ipcRenderer.invoke('delete-user', id)
});

contextBridge.exposeInMainWorld('apiPac', {
  regPac: (nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) => ipcRenderer.invoke('regPac', nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono),
  getPatients: (opts) => ipcRenderer.invoke('get-patients', opts),
  getPatientContact: (opts) => ipcRenderer.invoke('getpacient-contact', opts),
  updatePatient: (id, fields) => ipcRenderer.invoke('update-patient', id, fields),
  deletePatient: (id) => ipcRenderer.invoke('delete-patient', id)
});

contextBridge.exposeInMainWorld('apiCitas', {
  createCita: (nombre, fecha, hora, nota) => ipcRenderer.invoke('regCit', nombre, fecha, hora, nota),
  getTodaysCitas: () => ipcRenderer.invoke('get-todays-citas'),
  getAllCitas: () => ipcRenderer.invoke('get-all-citas'),
  updateCita: (id, fields) => ipcRenderer.invoke('update-cita', id, fields),
  deleteCita: (id) => ipcRenderer.invoke('delete-cita', id)
});

contextBridge.exposeInMainWorld('apiResults', {
  selectFile: () => ipcRenderer.invoke('select-hl7-file'),
  generatePDF: (content, filenameBase) => ipcRenderer.invoke('generate-pdf-from-hl7', content, filenameBase),
  getPatients: (opts) => ipcRenderer.invoke('get-patients', opts),
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
  selectPDFFile: () => ipcRenderer.invoke('select-pdf-file'),
  analyzePDF: (filePath) => ipcRenderer.invoke('analyze-pdf-file', filePath),
    revealFile: (path) => ipcRenderer.invoke('reveal-file', path) // new
});

/* Add to the apiResults exposure in preload.js (merge with your existing apiResults)
contextBridge.exposeInMainWorld('apiResults', {
  selectFile: () => ipcRenderer.invoke('select-hl7-file'),
  generatePDF: (content, filenameBase) => ipcRenderer.invoke('generate-pdf-from-hl7', content, filenameBase),
  getPatients: (opts) => ipcRenderer.invoke('get-patients', opts),
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
  revealFile: (path) => ipcRenderer.invoke('reveal-file', path) // new
});
*/
contextBridge.exposeInMainWorld('apiUtils', {
  reloadApp: () => ipcRenderer.invoke('reload-main-window'),
  focusApp: () => ipcRenderer.invoke('focus-main-window')
});