const { contextBridge, ipcRenderer } = require('electron');


//Autenticacion
contextBridge.exposeInMainWorld('api', {
  //Ivoca el handler "login" en main.js pasando username y password
  login: (username, password) => ipcRenderer.invoke('login', username, password),
});
//Gestion de usuario (Solo admin)
contextBridge.exposeInMainWorld('apiUsers', {
  getActiveUser: () => ipcRenderer.invoke('get-active-user'),//Obtiene el usuario
  logout: () => ipcRenderer.invoke('logout'),//Cierra sesion
  getAllUsers: () => ipcRenderer.invoke('get-all-users'),//Obtiene todos los usuarios
  createUser: (username, password, role) => ipcRenderer.invoke('create-user', username, password, role), //Crea un nuevo usuario
  updateUser: (id, fields) => ipcRenderer.invoke('update-user', id, fields), // Actualiza datos de un usuario
  deleteUser: (id) => ipcRenderer.invoke('delete-user', id)//Elimina un usuario
});
//Pacientes
contextBridge.exposeInMainWorld('apiPac', {
  regPac: (nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) => ipcRenderer.invoke('regPac', nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono), //Registra un paciente nuevo
  getPatients: (opts) => ipcRenderer.invoke('get-patients', opts), // Obtiene pacientes
  getPatientContact: (opts) => ipcRenderer.invoke('getpacient-contact', opts),// obtiene solo datos de contacto
  updatePatient: (id, fields) => ipcRenderer.invoke('update-patient', id, fields),// Actualiza datos del paciente
  deletePatient: (id) => ipcRenderer.invoke('delete-patient', id) // Elimina un paciente
});
//Citas
contextBridge.exposeInMainWorld('apiCitas', {
  createCita: (nombre, fecha, hora, nota) => ipcRenderer.invoke('regCit', nombre, fecha, hora, nota),//Crea una nueva cita
  getTodaysCitas: () => ipcRenderer.invoke('get-todays-citas'),//Obtiene citas del dia actual
  getAllCitas: () => ipcRenderer.invoke('get-all-citas'),//Obtiene todas las citas
  updateCita: (id, fields) => ipcRenderer.invoke('update-cita', id, fields),//Actualiza datos de una cita
  deleteCita: (id) => ipcRenderer.invoke('delete-cita', id)//Elimina una cita
});
//Resultados Archivos HL7/PDF
contextBridge.exposeInMainWorld('apiResults', {
  selectFile: () => ipcRenderer.invoke('select-hl7-file'),//Abre un dialogo para seleccionar archivo HL7
  generatePDF: (content, filenameBase) => ipcRenderer.invoke('generate-pdf-from-hl7', content, filenameBase),//Genera PDF a partir de HL7
  getPatients: (opts) => ipcRenderer.invoke('get-patients', opts),//Obtiene pacientes
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url)//Abre URL externa
});

//Resultados Archivos HL7/PDF
contextBridge.exposeInMainWorld('apiResults', {
  selectFile: () => ipcRenderer.invoke('select-hl7-file'),//Abre un dialogo para seleccionar archivo HL7
  generatePDF: (content, filenameBase) => ipcRenderer.invoke('generate-pdf-from-hl7', content, filenameBase),//Genera PDF a partir de HL7
  getPatients: (opts) => ipcRenderer.invoke('get-patients', opts),//Obtiene pacientes
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),//Abre URL externa
  revealFile: (path) => ipcRenderer.invoke('reveal-file', path) //Muestra un archivo en el explorador del sistema
});
//Utilidades de la app
contextBridge.exposeInMainWorld('apiUtils', {
  reloadApp: () => ipcRenderer.invoke('reload-main-window'),//Recarga la ventana principal
  focusApp: () => ipcRenderer.invoke('focus-main-window')//Trae la ventana principal al frente
});