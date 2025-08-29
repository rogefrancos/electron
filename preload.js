// los modulos que se ocupan en este caso
const { contextBridge, ipcRenderer } = require('electron');

// hace lo que su nombre dice, une los rendered y el main, aqui es donde tu le dices que datos pasas a el main
contextBridge.exposeInMainWorld('api', {
  // login es una propiedad, que nos apunta a los datos que queremos utilizar para poder pasarlos al main y usar el handle sobre ellos
  login: (username, password) => ipcRenderer.invoke('login', username, password),
});

  // comunicacion entre los procesos, no se puede acceder a APIs de Node 
  // desde el rendered, y no puedes acceder a los objetos de html desde
  // el main.js