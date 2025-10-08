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

// creacion de la tabla de pacientes

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS pacient(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellidoP TEXT,
    apellidoM TEXT
)
    `
).run();

// creacion de la tabla de citas

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS citas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    fecha DATE,
    hora TIME,
    nota TEXT
)
    `
).run();

// en la anterior no habia necesidad de insertar datos pero aqui se ve
// como le proporcionamos la informacion si es necesario.
// tambien trabaja con variables de js como se vera en el login

db.prepare(`
  INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)
`).run('admin', '1234', 'admin');

db.prepare(`
  INSERT OR IGNORE INTO pacient (nombre, apellidoP, apellidoM) VALUES (?, ?, ?)
`).run('Rogelio', 'Franco', 'Sanchez');

const citasCount = db.prepare("SELECT COUNT(*) AS count FROM citas").get();

if (citasCount.count === 0) {
    db.prepare(`
      INSERT INTO citas (nombre, fecha, hora, nota) VALUES (?, ?, ?, ?)
    `).run('Rogelio', '2025-08-18', '13:30', 'Alergico a las Abejas');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1170,
    height: 735,
    resizable: false,
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

// logica de registro de pacientes

ipcMain.handle('regPac', (event, nombre, apellidoP, apellidoM) => {

  // se escribe el query para insertar los datos que metimos en el form
  const result = db.prepare(`
    INSERT INTO pacient (nombre, apellidoP, apellidoM) VALUES (?, ?, ?)
  `).run(nombre, apellidoP, apellidoM);

  // const query2 = db.prepare(`SELECT * FROM pacient WHERE nombre = ? AND apellidoP = ? AND apellidoM = ?`);

  const pac = db.prepare("SELECT * FROM pacient WHERE id = ?").get(result.lastInsertRowid);

  if (pac) {
    return { success: true, pac};
  } else {
    return { success: false };
  }
});


// logica de registro de citas

ipcMain.handle('regCit', (event, nombre, fecha, hora, nota) => { 
  
  // Query para insertar los 4 valores de la cita
  const result = db.prepare(`
    INSERT INTO citas (nombre, fecha, hora, nota) VALUES (?, ?, ?, ?)
  `).run(nombre, fecha, hora, nota); 

  // Busca el registro de la cita recién creada
  const cit = db.prepare("SELECT * FROM citas WHERE id = ?").get(result.lastInsertRowid);

  if (cit) {
    return { success: true, cit};
  } else {
    return { success: false };
  }
});