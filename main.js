const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const dbms = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// local modules
const { parseHL7 } = require('./HL7');
const { generatePDF } = require('./pdfgen');

/*
  main.js (reemplazo completo)

  - Agrupa y corrige handlers IPC.
  - Usa una única fuente de truth para la DB (creada en app.whenReady).
  - Normaliza roles, corrige COUNT usage, desduplicación de get-patients y añade el handler
    solicitado 'getpacient-contact' que devuelve únicamente datos de contacto.
  - Incluye sanitizeFilenameBase y validaciones mínimas.
*/

let db = null;
let mainWindow = null;
let activeUser = null;

// helper: sanitize a filename base (para nombres de archivos seguros)
function sanitizeFilenameBase(s) {
  if (!s) return 'report';
  return s
    .normalize('NFKD').replace(/[\u0300-\u036F]/g, '') // remove diacritics
    .replace(/[^a-zA-Z0-9 _-]/g, '') // allow letters, numbers, space, underscore, hyphen
    .trim()
    .replace(/\s+/g, '_'); // replace spaces with underscore
}

function validDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d)); }
function validTime(t) { return t === null || t === '' || /^\d{2}:\d{2}$/.test(String(t)); }

function isAdminSession() {
  return activeUser && String(activeUser.role).trim().toLowerCase() === 'admin';
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1170,
    height: 735,
    resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  // create DB in userData for safety
  const dbPath = path.join(app.getPath('userData'), 'labdata.db');
  db = new dbms(dbPath);

  // initialize tables (idempotent)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )`).run();

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
    )`).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS citas(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      fecha DATE,
      hora TIME,
      nota TEXT
    )`).run();

  // ensure admin
  try {
    const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    if (!existingAdmin) {
      const adminPlain = '1234';
      const adminHash = bcrypt.hashSync(adminPlain, 10);
      db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', adminHash, 'admin');
      console.log('[main] Created default admin with hashed password.');
    } else if (existingAdmin.password && !existingAdmin.password.startsWith('$2')) {
      // rehash legacy
      const rehashed = bcrypt.hashSync(existingAdmin.password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(rehashed, existingAdmin.id);
      console.log('[main] Migrated admin password to bcrypt hash.');
    }
  } catch (e) {
    console.error('[main] ensureAdmin error:', e);
  }

  // seed example pacient and citas if missing
  db.prepare(`
    INSERT OR IGNORE INTO pacient (id, nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono)
    VALUES (1, 'Rogelio', 'Franco', 'Sanchez', 'masculino', '2005-03-11', 'rogefs04@gmail.com', '4612523244')
  `).run();

  const citasCount = db.prepare("SELECT COUNT(*) AS count FROM citas").get();
  if (citasCount.count === 0) {
    db.prepare(`INSERT INTO citas (nombre, fecha, hora, nota) VALUES (?, ?, ?, ?)`).run('Rogelio', '2025-08-18', '13:30', 'Alergico a las Abejas');
  }

  // create window after DB ready
  createWindow();
});

/* ============================
   IPC: utilities
   ============================ */

ipcMain.handle('reload-main-window', async () => {
  try {
    if (!mainWindow) return { success: false, error: 'Main window not found' };
    mainWindow.webContents.reloadIgnoringCache();
    return { success: true };
  } catch (err) {
    console.error('[main] reload-main-window error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('focus-main-window', async () => {
  try {
    if (!mainWindow) return { success: false, error: 'Main window not found' };
    try { mainWindow.show(); } catch {}
    try { mainWindow.focus(); } catch {}
    try { mainWindow.webContents.focus(); } catch {}
    return { success: true };
  } catch (err) {
    console.error('[main] focus-main-window error:', err);
    return { success: false, error: String(err) };
  }
});

/* ===== HL7 file selection & PDF generation ===== */
ipcMain.handle('select-hl7-file', async () => {
  try {
    const res = await dialog.showOpenDialog({
      title: 'Select HL7 file',
      properties: ['openFile'],
      filters: [
        { name: 'HL7 / Text', extensions: ['hl7', 'txt', 'hl7.txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) return { canceled: true };
    const filePath = res.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { canceled: false, filePath, content };
  } catch (err) {
    console.error('[main] select-hl7-file error:', err);
    return { canceled: true, error: String(err) };
  }
});

ipcMain.handle('generate-pdf-from-hl7', async (event, content, filenameBase = null) => {
  try {
    if (!content) return { success: false, error: 'No HL7 content provided' };
    const parsed = parseHL7(content);
    const base = filenameBase && typeof filenameBase === 'string' ? sanitizeFilenameBase(filenameBase) : `report-${Date.now()}`;
    const reportsDir = path.join(app.getPath('documents'), 'LabReports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const outPath = path.join(reportsDir, `${base}.pdf`);
    const savedPath = await generatePDF(parsed, outPath);
    return { success: true, path: savedPath, filename: `${base}.pdf` };
  } catch (err) {
    console.error('[main] generate-pdf-from-hl7 error:', err);
    return { success: false, error: String(err) };
  }
});

/* ===== Authentication ===== */
ipcMain.handle('login', (event, username, password) => {
  try {
    if (!db) return { success: false, error: 'DB not initialized' };
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return { success: false };
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return { success: false };
    const roleClean = user.role ? String(user.role).trim().toLowerCase() : 'user';
    activeUser = { id: user.id, username: user.username, role: roleClean };
    console.log(`[main] login success: ${user.username} (${roleClean})`);
    return { success: true, role: roleClean };
  } catch (err) {
    console.error('[main] login error:', err);
    return { success: false };
  }
});

ipcMain.handle('get-active-user', async () => {
  return activeUser ? { success: true, user: activeUser } : { success: true, user: null };
});

ipcMain.handle('logout', async () => {
  activeUser = null;
  return { success: true };
});

/* ===== Users management (admin) ===== */
ipcMain.handle('get-all-users', async () => {
  try {
    if (!isAdminSession()) return { success: false, error: 'Not authorized' };
    const rows = db.prepare('SELECT id, username, role FROM users').all();
    return { success: true, users: rows };
  } catch (err) {
    console.error('[main] get-all-users error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('create-user', async (event, username, plainPassword, role = 'user') => {
  try {
    if (!isAdminSession()) return { success: false, error: 'Not authorized' };
    if (!username || !plainPassword) return { success: false, error: 'Missing username or password' };
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return { success: false, error: 'Username already exists' };
    const roleClean = role ? String(role).trim().toLowerCase() : 'user';
    const hash = bcrypt.hashSync(plainPassword, 10);
    const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hash, roleClean);
    const newUser = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, user: newUser };
  } catch (err) {
    console.error('[main] create-user error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('update-user', async (event, id, fields = {}) => {
  try {
    if (!isAdminSession()) return { success: false, error: 'Not authorized' };
    if (!id) return { success: false, error: 'Missing id' };
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return { success: false, error: 'User not found' };

    if (fields.role && fields.role !== 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('admin').c;
      if (user.role === 'admin' && adminCount <= 1) return { success: false, error: 'Cannot remove last admin role' };
    }

    const updates = [];
    const params = [];
    if (fields.username && typeof fields.username === 'string') { updates.push('username = ?'); params.push(fields.username); }
    if (fields.role && typeof fields.role === 'string') { updates.push('role = ?'); params.push(String(fields.role).trim().toLowerCase()); }
    if (fields.password && typeof fields.password === 'string' && fields.password.length > 0) {
      const hash = bcrypt.hashSync(fields.password, 10);
      updates.push('password = ?'); params.push(hash);
    }
    if (updates.length === 0) return { success: false, error: 'No fields to update' };
    params.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    const updated = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
    return { success: true, user: updated };
  } catch (err) {
    console.error('[main] update-user error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('delete-user', async (event, id) => {
  try {
    if (!isAdminSession()) return { success: false, error: 'Not authorized' };
    if (!id) return { success: false, error: 'Missing id' };
    if (activeUser && activeUser.id === id) return { success: false, error: 'Cannot delete currently logged-in user' };
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return { success: false, error: 'User not found' };
    if (user.role === 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('admin').c;
      if (adminCount <= 1) return { success: false, error: 'Cannot delete the last admin' };
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    console.error('[main] delete-user error:', err);
    return { success: false, error: String(err) };
  }
});

/* ===== Patients: single flexible handler + contact-only handler + CRUD ===== */
// Flexible get-patients (no args => all, { query } => search, { id } => single)
ipcMain.handle('get-patients', async (event, opts) => {
  try {
    opts = opts || {};
    if (opts.id) {
      const p = db.prepare('SELECT id, nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono FROM pacient WHERE id = ?').get(opts.id);
      return { success: true, patients: p ? [p] : [] };
    }
    if (opts.query && String(opts.query).trim().length > 0) {
      const q = `%${String(opts.query).trim().toLowerCase()}%`;
      const rows = db.prepare(`
        SELECT id, nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono
        FROM pacient
        WHERE LOWER(nombre || ' ' || ifnull(apellidoP,'') || ' ' || ifnull(apellidoM,'')) LIKE ?
           OR LOWER(telefono) LIKE ?
           OR LOWER(correo) LIKE ?
        ORDER BY nombre COLLATE NOCASE ASC
        LIMIT 200
      `).all(q, q, q);
      return { success: true, patients: rows };
    }
    const rows = db.prepare('SELECT id, nombre, apellidoP, apellidoM, telefono, correo FROM pacient ORDER BY nombre COLLATE NOCASE ASC').all();
    return { success: true, patients: rows };
  } catch (err) {
    console.error('[main] get-patients error:', err);
    return { success: false, error: String(err) };
  }
});

// Contact-only handler (named as requested)
ipcMain.handle('getpacient-contact', async (event, opts) => {
  try {
    opts = opts || {};
    if (opts.id) {
      const p = db.prepare('SELECT id, nombre, apellidoP, apellidoM, telefono FROM pacient WHERE id = ?').get(opts.id);
      return { success: true, contacts: p ? [p] : [] };
    }
    if (opts.query && String(opts.query).trim().length > 0) {
      const q = `%${String(opts.query).trim().toLowerCase()}%`;
      const rows = db.prepare(`
        SELECT id, nombre, apellidoP, apellidoM, telefono
        FROM pacient
        WHERE LOWER(nombre || ' ' || ifnull(apellidoP,'') || ' ' || ifnull(apellidoM,'')) LIKE ?
           OR LOWER(telefono) LIKE ?
        ORDER BY nombre COLLATE NOCASE ASC
        LIMIT 200
      `).all(q, q);
      return { success: true, contacts: rows };
    }
    // fallback: return minimal list
    const rows = db.prepare('SELECT id, nombre, apellidoP, apellidoM, telefono FROM pacient ORDER BY nombre COLLATE NOCASE ASC').all();
    return { success: true, contacts: rows };
  } catch (err) {
    console.error('[main] getpacient-contact error:', err);
    return { success: false, error: String(err) };
  }
});

// Create patient (original regPac)
ipcMain.handle('regPac', (event, nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) => {
  try {
    const result = db.prepare(`
      INSERT INTO pacient (nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono);
    const pac = db.prepare("SELECT * FROM pacient WHERE id = ?").get(result.lastInsertRowid);
    if (pac) return { success: true, pac };
    return { success: false };
  } catch (err) {
    console.error('[main] regPac error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('update-patient', async (event, id, fields = {}) => {
  try {
    if (!id) return { success: false, error: 'Missing id' };
    const updates = [];
    const params = [];
    if (fields.nombre) { updates.push('nombre = ?'); params.push(fields.nombre); }
    if (fields.apellidoP) { updates.push('apellidoP = ?'); params.push(fields.apellidoP); }
    if (fields.apellidoM) { updates.push('apellidoM = ?'); params.push(fields.apellidoM); }
    if (fields.genero) { updates.push('genero = ?'); params.push(fields.genero); }
    if (fields.fechaNac) { updates.push('fechaNac = ?'); params.push(fields.fechaNac); }
    if (fields.correo) { updates.push('correo = ?'); params.push(fields.correo); }
    if (fields.telefono) { updates.push('telefono = ?'); params.push(fields.telefono); }
    if (updates.length === 0) return { success: false, error: 'No fields to update' };
    params.push(id);
    const sql = `UPDATE pacient SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    const updated = db.prepare('SELECT id, nombre, apellidoP, apellidoM, genero, fechaNac, correo, telefono FROM pacient WHERE id = ?').get(id);
    return { success: true, patient: updated };
  } catch (err) {
    console.error('[main] update-patient error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('delete-patient', async (event, id) => {
  try {
    if (!id) return { success: false, error: 'Missing id' };
    db.prepare('DELETE FROM pacient WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    console.error('[main] delete-patient error:', err);
    return { success: false, error: String(err) };
  }
});

/* ===== Citas (appointments) ===== */
ipcMain.handle('regCit', (event, nombre, fecha, hora, nota) => {
  try {
    if (!validDate(fecha)) return { success: false, error: 'Fecha inválida (YYYY-MM-DD)' };
    if (!validTime(hora)) return { success: false, error: 'Hora inválida (HH:MM)' };
    const result = db.prepare('INSERT INTO citas (nombre, fecha, hora, nota) VALUES (?, ?, ?, ?)').run(nombre, fecha, hora, nota);
    const cit = db.prepare("SELECT * FROM citas WHERE id = ?").get(result.lastInsertRowid);
    if (cit) return { success: true, cit };
    return { success: false };
  } catch (err) {
    console.error('[main] regCit error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('get-todays-citas', async () => {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    const rows = db.prepare('SELECT * FROM citas WHERE fecha = ? ORDER BY hora ASC').all(today);
    return { success: true, citas: rows };
  } catch (err) {
    console.error('[main] get-todays-citas error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('get-all-citas', async () => {
  try {
    const rows = db.prepare('SELECT * FROM citas ORDER BY fecha ASC, hora ASC').all();
    return { success: true, citas: rows };
  } catch (err) {
    console.error('[main] get-all-citas error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('update-cita', async (event, id, fields = {}) => {
  try {
    if (!id) return { success: false, error: 'Missing id' };
    const updates = [];
    const params = [];
    if (fields.nombre) { updates.push('nombre = ?'); params.push(fields.nombre); }
    if (fields.fecha) {
      if (!validDate(fields.fecha)) return { success: false, error: 'Fecha inválida (YYYY-MM-DD)' };
      updates.push('fecha = ?'); params.push(fields.fecha);
    }
    if (fields.hora) {
      if (!validTime(fields.hora)) return { success: false, error: 'Hora inválida (HH:MM)' };
      updates.push('hora = ?'); params.push(fields.hora);
    }
    if (fields.nota) { updates.push('nota = ?'); params.push(fields.nota); }
    if (updates.length === 0) return { success: false, error: 'No fields to update' };
    params.push(id);
    const sql = `UPDATE citas SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    const updated = db.prepare('SELECT * FROM citas WHERE id = ?').get(id);
    return { success: true, cita: updated };
  } catch (err) {
    console.error('[main] update-cita error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('delete-cita', async (event, id) => {
  try {
    if (!id) return { success: false, error: 'Missing id' };
    db.prepare('DELETE FROM citas WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    console.error('[main] delete-cita error:', err);
    return { success: false, error: String(err) };
  }
});

/* ===== Open external URL (WhatsApp etc) ===== */
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('[main] open-external-url failed:', err);
    return { success: false, error: String(err) };
  }
});

// Add this handler to your existing main.js (near other ipcMain handlers).
// It reveals a file in the OS file explorer (so user can attach the generated PDF).
ipcMain.handle('reveal-file', async (event, filePath) => {
  try {
    if (!filePath) return { success: false, error: 'No file path provided' };
    // showItemInFolder will open the folder and select the file on most platforms
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) {
    console.error('[main] reveal-file error:', err);
    return { success: false, error: String(err) };
  }
});