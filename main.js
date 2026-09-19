'use strict';

/**
 * AuraVault — Electron main process.
 *
 * Security model
 * --------------
 * • The vault is a single file on disk, encrypted with AES-256-GCM.
 * • The encryption key is derived from the master password with scrypt
 *   (N=16384, r=8, p=1) and a random 16-byte salt.
 * • The derived key and the decrypted vault exist ONLY in main-process
 *   memory while the vault is unlocked, and are wiped on lock/quit.
 * • No plaintext secret is ever written to disk, logged, or sent over
 *   the network. There is no network code in this app at all.
 */

const {
  app, BrowserWindow, ipcMain, clipboard, dialog, powerMonitor, shell, nativeTheme,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const TRASH_RETENTION_DAYS = 30;

/** Screenshot / E2E mode: `npm run shots` */
const SHOOT = process.argv.includes('--shoot');

/* ------------------------------------------------------------------ */
/*  Paths & flags (must run before anything reads userData)            */
/* ------------------------------------------------------------------ */

app.setName('AuraVault');

if (SHOOT) {
  // Fresh throwaway profile for deterministic end-to-end runs
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'auravault-shoot-')));
  // Container-friendly GL path (SwiftShader) — real GPUs on user machines
  // composite the same UI natively; this only affects headless test runs.
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('use-gl', 'angle');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('force-device-scale-factor', '2');
}

const vaultPath = () => path.join(app.getPath('userData'), 'vault.avault');
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let mainWindow = null;
let isQuitting = false;

let vaultKey = null;   // Buffer(32) — lives only in memory while unlocked
let vaultSalt = null;  // Buffer(16)
let vaultData = null;  // decrypted { items: [] }

let settings = {
  theme: 'system',
  autoLockMinutes: 5,
  clipboardClearSeconds: 20,
  lockOnSystemLock: true,
};

let autoLockTimer = null;
let clipboardTimer = null;
let closeFallbackTimer = null;

/* ------------------------------------------------------------------ */
/*  Settings (non-sensitive preferences only — vault data is encrypted)*/
/* ------------------------------------------------------------------ */

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    if (raw && typeof raw === 'object') settings = { ...settings, ...raw };
  } catch { /* first run or corrupt — defaults are fine */ }
  return settings;
}

function saveSettings() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Could not save settings:', err.message);
  }
}

loadSettings();

// Synchronous theme lookup so the renderer can theme itself before first
// paint (avoids a light/dark flash at startup).
ipcMain.on('theme:get-sync', (event) => { event.returnValue = settings.theme; });

/* ------------------------------------------------------------------ */
/*  Crypto core                                                        */
/* ------------------------------------------------------------------ */

function deriveKey(password, salt) {
  return crypto.scryptSync(String(password), salt, 32, SCRYPT);
}

function encryptJSON(obj, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), data: Buffer.concat([ct, tag]).toString('base64') };
}

function decryptJSON(enc, key) {
  const raw = Buffer.from(enc.data, 'base64');
  const ct = raw.subarray(0, raw.length - 16);
  const tag = raw.subarray(raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'));
}

function readVaultFile() {
  try {
    const file = JSON.parse(fs.readFileSync(vaultPath(), 'utf8'));
    if (!file || !file.salt || !file.enc) return null;
    return file;
  } catch { return null; }
}

function writeVaultFile() {
  if (!vaultKey || !vaultData) return;
  const file = {
    app: 'AuraVault',
    version: 1,
    kdf: 'scrypt-N16384-r8-p1',
    cipher: 'aes-256-gcm',
    salt: vaultSalt.toString('base64'),
    enc: encryptJSON(vaultData, vaultKey),
  };
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(vaultPath(), JSON.stringify(file), { mode: 0o600 });
}

/* ------------------------------------------------------------------ */
/*  Vault lifecycle                                                    */
/* ------------------------------------------------------------------ */

function requireUnlocked() {
  if (!vaultData) {
    const err = new Error('vault is locked');
    err.code = 'LOCKED';
    throw err;
  }
}

function lockVault(notify = true) {
  if (!vaultKey && !vaultData) return;
  vaultKey = null;
  vaultSalt = null;
  vaultData = null;
  clearTimeout(autoLockTimer);
  if (notify && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('vault:locked');
  }
}

function resetAutoLock() {
  clearTimeout(autoLockTimer);
  const minutes = Number(settings.autoLockMinutes) || 0;
  if (vaultKey && minutes > 0) {
    autoLockTimer = setTimeout(() => lockVault(), minutes * 60 * 1000);
  }
}

function sanitizeItem(item) {
  const s = (v) => (typeof v === 'string' ? v.slice(0, 20000) : '');
  return {
    id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
    type: ['login', 'card', 'note'].includes(item.type) ? item.type : 'login',
    title: s(item.title),
    username: s(item.username),
    password: s(item.password),
    url: s(item.url),
    notes: s(item.notes),
    cardNumber: s(item.cardNumber),
    cardHolder: s(item.cardHolder),
    cardExpiry: s(item.cardExpiry),
    cardCvv: s(item.cardCvv),
    color: Number.isInteger(item.color) ? Math.max(0, Math.min(11, item.color)) : 0,
    favorite: !!item.favorite,
    deletedAt: item.deletedAt || null,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function purgeExpiredTrash() {
  if (!vaultData) return;
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 86400000;
  const before = vaultData.items.length;
  vaultData.items = vaultData.items.filter((it) => !it.deletedAt || new Date(it.deletedAt).getTime() > cutoff);
  if (vaultData.items.length !== before) writeVaultFile();
}

/* ------------------------------------------------------------------ */
/*  Password generator (CSPRNG)                                        */
/* ------------------------------------------------------------------ */

const GEN_SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}<>?,.;:',
  upperSafe: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowerSafe: 'abcdefghijkmnopqrstuvwxyz',
  digitsSafe: '23456789',
};

function generatePassword(opts = {}) {
  const o = {
    length: parseInt(opts.length, 10) || 20,
    upper: opts.upper !== false,
    lower: opts.lower !== false,
    digits: opts.digits !== false,
    symbols: opts.symbols !== false,
    avoidAmbiguous: !!opts.avoidAmbiguous,
  };
  const classes = [];
  if (o.upper) classes.push(o.avoidAmbiguous ? GEN_SETS.upperSafe : GEN_SETS.upper);
  if (o.lower) classes.push(o.avoidAmbiguous ? GEN_SETS.lowerSafe : GEN_SETS.lower);
  if (o.digits) classes.push(o.avoidAmbiguous ? GEN_SETS.digitsSafe : GEN_SETS.digits);
  if (o.symbols) classes.push(GEN_SETS.symbols);
  const pool = classes.join('') || GEN_SETS.lower;
  const len = Math.max(6, Math.min(128, o.length));
  const chars = [];
  // guarantee at least one character from every selected class
  for (const set of classes) chars.push(set[crypto.randomInt(set.length)]);
  while (chars.length < len) chars.push(pool[crypto.randomInt(pool.length)]);
  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/* ------------------------------------------------------------------ */
/*  IPC                                                                */
/* ------------------------------------------------------------------ */

const send = (channel, ...args) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
};

function registerIpc() {
  const h = ipcMain.handle.bind(ipcMain);

  h('vault:status', () => ({
    initialized: !!readVaultFile(),
    unlocked: !!vaultKey,
    settings,
    version: app.getVersion(),
    platform: process.platform,
  }));

  h('vault:create', (_e, masterPassword) => {
    if (readVaultFile()) throw new Error('vault-exists');
    if (String(masterPassword || '').length < 8) throw new Error('weak-password');
    vaultSalt = crypto.randomBytes(16);
    vaultKey = deriveKey(masterPassword, vaultSalt);
    vaultData = { items: [] };
    writeVaultFile();
    resetAutoLock();
    return true;
  });

  h('vault:unlock', (_e, masterPassword) => {
    const file = readVaultFile();
    if (!file) throw new Error('no-vault');
    const salt = Buffer.from(file.salt, 'base64');
    const key = deriveKey(masterPassword, salt);
    let data;
    try {
      data = decryptJSON(file.enc, key); // GCM auth fails ⇒ wrong password
    } catch {
      throw new Error('invalid-password');
    }
    vaultKey = key;
    vaultSalt = salt;
    vaultData = Array.isArray(data.items) ? data : { items: [] };
    purgeExpiredTrash();
    resetAutoLock();
    return true;
  });

  h('vault:lock', () => { lockVault(); return true; });

  h('vault:getItems', () => { requireUnlocked(); return vaultData.items; });

  h('vault:upsertItem', (_e, item) => {
    requireUnlocked();
    const clean = sanitizeItem(item || {});
    const i = vaultData.items.findIndex((x) => x.id === clean.id);
    if (i >= 0) {
      clean.createdAt = vaultData.items[i].createdAt;
      vaultData.items[i] = clean;
    } else {
      vaultData.items.push(clean);
    }
    writeVaultFile();
    return clean;
  });

  h('vault:setFavorite', (_e, id, fav) => {
    requireUnlocked();
    const it = vaultData.items.find((x) => x.id === id);
    if (it) { it.favorite = !!fav; it.updatedAt = new Date().toISOString(); writeVaultFile(); }
    return it || null;
  });

  h('vault:trashItem', (_e, id) => {
    requireUnlocked();
    const it = vaultData.items.find((x) => x.id === id);
    if (it) { it.deletedAt = new Date().toISOString(); writeVaultFile(); }
    return it || null;
  });

  h('vault:restoreItem', (_e, id) => {
    requireUnlocked();
    const it = vaultData.items.find((x) => x.id === id);
    if (it) { it.deletedAt = null; it.updatedAt = new Date().toISOString(); writeVaultFile(); }
    return it || null;
  });

  h('vault:deleteItemForever', (_e, id) => {
    requireUnlocked();
    vaultData.items = vaultData.items.filter((x) => x.id !== id);
    writeVaultFile();
    return true;
  });

  h('vault:emptyTrash', () => {
    requireUnlocked();
    const n = vaultData.items.filter((x) => x.deletedAt).length;
    vaultData.items = vaultData.items.filter((x) => !x.deletedAt);
    writeVaultFile();
    return n;
  });

  h('vault:generatePassword', (_e, opts) => generatePassword(opts));

  h('vault:changeMaster', (_e, current, next) => {
    requireUnlocked();
    const file = readVaultFile();
    const curKey = deriveKey(current, Buffer.from(file.salt, 'base64'));
    try { decryptJSON(file.enc, curKey); } catch { throw new Error('invalid-password'); }
    if (String(next || '').length < 8) throw new Error('weak-password');
    vaultSalt = crypto.randomBytes(16);      // brand-new salt…
    vaultKey = deriveKey(next, vaultSalt);   // …and key, then re-encrypt
    writeVaultFile();
    return true;
  });

  h('vault:export', async () => {
    requireUnlocked();
    const file = readVaultFile();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const r = await dialog.showSaveDialog(mainWindow, {
      title: 'Export encrypted backup',
      defaultPath: `auravault-backup-${today}.avault`,
      filters: [{ name: 'AuraVault Backup', extensions: ['avault'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, JSON.stringify({ ...file, app: 'AuraVault', exportedAt: new Date().toISOString() }));
    return r.filePath;
  });

  h('vault:importPick', async () => {
    requireUnlocked();
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'Import backup',
      properties: ['openFile'],
      filters: [{ name: 'AuraVault Backup', extensions: ['avault', 'json'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    try {
      const blob = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (!blob || !blob.salt || !blob.enc || !blob.enc.data) throw new Error('bad');
      return {
        path: r.filePaths[0],
        exportedAt: blob.exportedAt || null,
        blob: { salt: blob.salt, enc: blob.enc },
      };
    } catch { throw new Error('bad-file'); }
  });

  h('vault:importWithPassword', (_e, password, blob) => {
    requireUnlocked();
    if (!blob || !blob.salt || !blob.enc) throw new Error('bad-file');
    let data;
    try {
      data = decryptJSON(blob.enc, deriveKey(password, Buffer.from(blob.salt, 'base64')));
    } catch { throw new Error('invalid-password'); }
    if (!Array.isArray(data.items)) throw new Error('bad-file');
    const existing = new Set(vaultData.items.map((i) => i.id));
    let added = 0;
    for (const it of data.items) {
      if (!existing.has(it.id)) { vaultData.items.push(sanitizeItem(it)); added++; }
    }
    writeVaultFile();
    return added;
  });

  h('clipboard:write', (_e, text) => {
    const str = String(text);
    clipboard.writeText(str);
    clearTimeout(clipboardTimer);
    const secs = Number(settings.clipboardClearSeconds) || 0;
    if (secs > 0) {
      clipboardTimer = setTimeout(() => {
        // only clear if the user hasn't copied something else meanwhile
        if (clipboard.readText() === str) {
          clipboard.writeText('');
          send('clipboard:cleared');
        }
      }, secs * 1000);
    }
    return true;
  });

  h('settings:get', () => settings);

  h('settings:set', (_e, patch) => {
    if (patch && typeof patch === 'object') {
      const allowed = ['theme', 'autoLockMinutes', 'clipboardClearSeconds', 'lockOnSystemLock'];
      for (const k of allowed) {
        if (k in patch) settings[k] = patch[k];
      }
      saveSettings();
      resetAutoLock();
    }
    return settings;
  });

  h('app:openExternal', (_e, url) => {
    try {
      const u = new URL(String(url));
      if (u.protocol !== 'https:') return false;
      shell.openExternal(u.href);
      return true;
    } catch { return false; }
  });

  ipcMain.on('activity', () => resetAutoLock());
  ipcMain.on('win:closeNow', () => {
    isQuitting = true;
    if (mainWindow) mainWindow.destroy();
  });

  h('win:minimize', () => { if (mainWindow) mainWindow.minimize(); return true; });
  h('win:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
    return true;
  });
  h('win:closeRequest', () => { requestClose(); return true; });
}

function requestClose() {
  if (isQuitting) return;
  isQuitting = true;
  send('app:closing'); // renderer plays the close animation, then calls win:closeNow
  clearTimeout(closeFallbackTimer);
  closeFallbackTimer = setTimeout(() => {
    if (mainWindow) mainWindow.destroy(); // never let a hung renderer trap the window
  }, 1500);
}

/* ------------------------------------------------------------------ */
/*  Window                                                             */
/* ------------------------------------------------------------------ */

function createWindow() {
  const dark = settings.theme === 'dark'
    || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors);

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    show: SHOOT, // in shoot mode map the window immediately so X capture works
    resizable: true,
    backgroundColor: dark ? '#0a0b10' : '#e9edf6',
    icon: path.join(__dirname, 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('maximize', () => send('win:maximized', true));
  mainWindow.on('unmaximize', () => send('win:maximized', false));
  mainWindow.on('closed', () => { mainWindow = null; });

  // Intercept Alt+F4 / taskbar close so the renderer can animate first.
  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); requestClose(); }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'), SHOOT ? { hash: 'debug' } : undefined);

  if (SHOOT) {
    console.log('[shoot] window created, waiting for load…');
    const watchdog = setTimeout(() => {
      console.error('[shoot] WATCHDOG: suite did not finish in 110s, aborting');
      app.exit(2);
    }, 110000);
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => console.error('[shoot] did-fail-load', code, desc, url));
    mainWindow.webContents.on('render-process-gone', (_e, details) => console.error('[shoot] renderer gone:', details && details.reason));
    mainWindow.webContents.on('unresponsive', () => console.error('[shoot] renderer UNRESPONSIVE'));
    mainWindow.webContents.once('did-finish-load', async () => {
      console.log('[shoot] page loaded — running suite');
      try {
        await require('./scripts/screenshots').run(mainWindow);
        console.log('[shoot] suite finished');
      } catch (err) {
        console.error('shoot failed:', err);
      }
      clearTimeout(watchdog);
      app.exit(0);
    });
  }
}

/* ------------------------------------------------------------------ */
/*  App bootstrap                                                      */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

registerIpc();

app.whenReady().then(() => {
  createWindow();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Lock the vault when the user locks their Windows session
  powerMonitor.on('lock-screen', () => {
    if (settings.lockOnSystemLock) lockVault();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  lockVault(false); // wipe the key from memory
});
