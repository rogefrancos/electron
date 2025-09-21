const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dbms = require('better-sqlite3');

// utilizamos el new para crear o revisar si ya esta creado el archivo para la base de datos
const db = new dbms('labdata.db');

// el .prepare en el objeto db es para hacer consultas a la base de datos

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
)
    `
).run();

// en la anterior no habia necesidad de insertar datos pero aqui se ve
// como le proporcionamos la informacion si es necesario.
// tambien trabaja con variables de js como se vera en el login

db.prepare(`
  INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)
`).run('admin', '1234', 'admin');


function createWindow() {
  const win = new BrowserWindow({
    width: 1150,
    height: 735,
    // le dices donde se ubica el preload
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  // aqui se le dice que archivo de html es el que se carga en un inicio
  win.loadFile('index.html');
}

// aqui simplemente espera la confirmacion del create window, que se termine de cargar el archivo y crea la ventana
app.whenReady().then(createWindow);

ipcMain.handle('login', (event, username, password) => {

  // se escribe el query que queremos para recuperar informacion
  const query = db.prepare(`SELECT * FROM users WHERE username = ? AND password = ?`);
  
  // aqui le damos los datos que deberian ser la informacion de cierto registro
  // si es correcto nos regresa el objeto user, si no nos da un indefinido
  const user = query.get(username, password);

  // comprueba segun la logica anterior si si nos regreso el objeto y si si existe el login fue exitoso
  if (user) {
    return { success: true, role: user.role };
  } else {
    return { success: false };
  }
});