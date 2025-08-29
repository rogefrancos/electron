const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    // le dices donde se ubica el preload
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  // aqui se le dice que archivo de html es el que se carga en un inicio
  win.loadFile('index.html');
}

// aqui simplemente espera la confirmacion del create window, que se termine de cargar el archivo y crea la ventana
app.whenReady().then(createWindow);

// aqui se hace el login provisional, se utiliza el handle, referenciando al invoke que estaba en el preload
ipcMain.handle('login', async (event, username, password) => {
  // logica muy simple del login
  if (username === 'admin' && password === '1234') {
    return { success: true, role: 'admin' };
  }
  return { success: false };
});
