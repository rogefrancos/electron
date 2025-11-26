const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const dbms = require('better-sqlite3');
const { parseHL7 } = require('./HL7');
const { generatePDF } = require('./pdfgen');
const bcrypt = require('bcryptjs');

// creacion de la base de datos, se encarga igualmente el new de comprobar si existe de lo contrario la crea, no se duplica
const db = new dbms('labdata.db');

// tabla de usuario con rol y datos de acceso
db.prepare(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )
`).run();

// tabla de pacientes para guardar sus datos
db.prepare(`
  CREATE TABLE IF NOT EXISTS pacient(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellidoP TEXT,
    apellidoM TEXT,
    genero TEXT,
    fechaNac DATE,
    correo TEXT,
    telefono TEXT
  )
`).run();
 
// tabla donde se guardan las citas
db.prepare(`
  CREATE TABLE IF NOT EXISTS citas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    fecha DATE,
    hora TIME,
    nota TEXT
  )
`).run();

// inserciones para tener algo en la bd
db.prepare(`
  INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)
`).run('admin', '1234', 'admin');

db.prepare(`
  INSERT OR IGNORE INTO pacient (nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('Rogelio', 'Franco', 'Sanchez', 'masculino', '2005-03-11', 'rogefs04@gmail.com', '4612523244');

// --- ensure admin exists and is hashed (migration-safe) ---
const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const adminPlain = '1234';
  const adminHash = bcrypt.hashSync(adminPlain, 10); // cost 10 is fine for desktop apps
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', adminHash, 'admin');
} else {
  // If admin exists with a plaintext-looking password, re-hash it.
  // Heuristic: bcrypt hashes start with $2a$ or $2b$ or $2y$
  if (existingAdmin.password && !existingAdmin.password.startsWith('$2')) {
    try {
      const rehashed = bcrypt.hashSync(existingAdmin.password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(rehashed, existingAdmin.id);
      console.log('[main] Migrated admin password to hashed form.');
    } catch (e) {
      console.error('[main] Failed to migrate admin password:', e);
    }
  }
}

// --- secure login handler: fetch by username, compare hashes ---
ipcMain.handle('login', (event, username, password) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return { success: false };

    // bcrypt.compareSync returns boolean; it's safe against timing attacks
    const ok = bcrypt.compareSync(password, user.password);
    if (ok) {
      return { success: true, role: user.role };
    } else {
      return { success: false };
    }
  } catch (err) {
    console.error('[main] login error:', err);
    return { success: false };
  }
});

// se crea la ventana en cuanto este listo, se especifican las medidas y propiedades
// junto con que archivo es el primero en cargarse
function createWindow() {
  const win = new BrowserWindow({
    width: 1170,
    height: 735,
    resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

// helper: sanitize filename base
/*
function sanitizeFilenameBase(s) {
  if (!s) return 'report';
  return s
    .normalize('NFKD').replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}
*/
/*
// Open native file dialog
ipcMain.handle('select-hl7-file', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select HL7 file',
    properties: ['openFile'],
    filters: [
      { name: 'HL7 / Text', extensions: ['hl7', 'txt', 'hl7.txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
    return { canceled: true };
  }

  try {
    const filePath = res.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { canceled: false, filePath, content };
  } catch (err) {
    console.error('[main] Error reading selected HL7 file:', err);
    return { canceled: true, error: err.message };
  }
});
*/

// Logica para usar la creacion de los PDFs recibe los datos de la API
ipcMain.handle('generate-pdf-from-hl7', async (event, content, filenameBase = null) => {
  console.log('Se llamo la funcion para crear PDF');
  try {
    // se intenta ver si no hay contenido para evitar errores despues
    if (!content) {
      console.warn('Se entrego sin contenido');
      return { success: false, error: 'No se recibio contenido en formato HL7' };
    }

    // de lo contrario sacamos el contenido con la funcion la cual nos regresa
    const parsed = parseHL7(content);
    // se crea el archivo con el nombre registrado en el archivo HL7 en el header, junto con la fecha y hora
    const base = filenameBase && typeof filenameBase === 'string' ? filenameBase : `report-${Date.now()}`;
// const base = filenameBase && typeof filenameBase === 'string' ? sanitizeFilenameBase(filenameBase) : `report-${Date.now()}`;
// se hace la comprobacion de si existe la carpeta, de lo contrario se crea la nueva carpeta en Documents en ese caso, llamada ReportesLab
    const reportsDir = path.join(app.getPath('documents'), 'ReportesLab');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      console.log('Se creo la carpeta en: ', reportsDir);
    }

    // se guarda la direccion de donde esta el archivo
    const outPath = path.join(reportsDir, `${base}.pdf`);

    // la primera parte manda el objeto que contiene la informacion ya traducida y el path del archivo
    // y se regresa el estado de exito junto con el path del archivo por si necesitas buscarlo
    try {
      const savedPath = await generatePDF(parsed, outPath);
      return { success: true, path: savedPath, filename: `${base}.pdf` };
    } catch (pdfErr) {
      return { success: false, error: pdfErr && pdfErr.message ? pdfErr.message : String(pdfErr) };
    }
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
});

// se consiguen los datos para exponer el la lista de contactos en Results para poder mandar los resultados
ipcMain.handle('get-patients', async () => {
  try {
    const rows = db.prepare('SELECT id, nombre, apellidoP, apellidoM, telefono FROM pacient').all();
    return { success: true, patients: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Open external URLs (WhatsApp)
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('[main] open-external-url failed:', err);
    return { success: false, error: err.message };
  }
});

/*
ipcMain.handle('login', (event, username, password) => {
  const query = db.prepare(`SELECT * FROM users WHERE username = ? AND password = ?`);
  const user = query.get(username, password);
  if (user) return { success: true, role: user.role };
  return { success: false };
});
*/

ipcMain.handle('regPac', (event, nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) => {
  const result = db.prepare(`
    INSERT INTO pacient (nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono);
  const pac = db.prepare("SELECT * FROM pacient WHERE id = ?").get(result.lastInsertRowid);
  if (pac) return { success: true, pac };
  return { success: false };
});

ipcMain.handle('regCit', (event, nombre, fecha, hora, nota) => {
  const result = db.prepare(`
    INSERT INTO citas (nombre, fecha, hora, nota) VALUES (?, ?, ?, ?)
  `).run(nombre, fecha, hora, nota);
  const cit = db.prepare("SELECT * FROM citas WHERE id = ?").get(result.lastInsertRowid);
  if (cit) return { success: true, cit };
  return { success: false };
});