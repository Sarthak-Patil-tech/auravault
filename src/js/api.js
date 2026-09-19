/* AuraVault — API layer.
 *
 * In the desktop app, `window.vault` is exposed by preload.js (Electron,
 * contextIsolation on) and every call is a sandboxed IPC round-trip.
 *
 * When the UI is opened directly in a browser (e.g. `npx serve src` or the
 * GitHub Pages demo), this file swaps in a localStorage-backed adapter with
 * the exact same surface, so the whole interface is previewable without
 * Electron. Sample data only — nothing sensitive ever touches this mode.
 */
'use strict';

(function () {

  const real = window.vault;
  if (real && real.mode === 'electron') {
    window.AV.api = Object.assign({ mode: 'electron' }, real);
    return;
  }

  /* ============================ demo adapter ============================ */

  const KEY = 'av.demo.v1';
  const MASTER = 'demo1234';

  const delay = (value, ms = 90) =>
    new Promise((resolve, reject) => setTimeout(() => {
      try { resolve(typeof value === 'function' ? value() : value); }
      catch (err) { reject(err); }
    }, ms));

  const uid = () => 'demo-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function demoPassword(len = 20) {
    const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';
    const rnd = new Uint32Array(len);
    crypto.getRandomValues(rnd);
    return Array.from(rnd, (n) => pool[n % pool.length]).join('');
  }

  function seedItems() {
    const mk = (o) => Object.assign({
      id: uid(), type: 'login', title: '', username: '', password: '', url: '', notes: '',
      cardNumber: '', cardHolder: '', cardExpiry: '', cardCvv: '', color: 0, favorite: false,
      deletedAt: null, createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date().toISOString(),
    }, o);
    return [
      mk({ type: 'login', title: 'Gmail', username: 'aarav.sharma@gmail.com', url: 'https://mail.google.com', password: demoPassword(22), favorite: true, color: 1 }),
      mk({ type: 'login', title: 'GitHub', username: 'aaravsharma', url: 'https://github.com', password: demoPassword(24), favorite: true, color: 0 }),
      mk({ type: 'login', title: 'Netflix', username: 'aarav.sharma', url: 'https://netflix.com', password: demoPassword(18), favorite: true, color: 7 }),
      mk({ type: 'login', title: 'HDFC NetBanking', username: 'aasharma', url: 'https://netbanking.hdfcbank.com', password: demoPassword(16), notes: 'Profile password is different — see secure note.', color: 5 }),
      mk({ type: 'login', title: 'Amazon', username: 'aarav.sharma@gmail.com', url: 'https://amazon.in', password: demoPassword(20), color: 4 }),
      mk({ type: 'login', title: 'Spotify', username: 'aarav.sharma', url: 'https://spotify.com', password: demoPassword(20), color: 2 }),
      mk({ type: 'login', title: 'AWS Console', username: 'aarav-admin', url: 'https://console.aws.amazon.com', password: demoPassword(28), notes: 'MFA is on the primary account.', color: 9 }),
      mk({ type: 'login', title: 'iCloud', username: 'aarav@icloud.com', url: 'https://icloud.com', password: demoPassword(20), color: 6 }),
      mk({ type: 'card', title: 'HDFC Visa Credit', cardNumber: '4514 8892 1103 6620', cardHolder: 'AARAV SHARMA', cardExpiry: '09/29', cardCvv: '384', color: 3 }),
      mk({ type: 'note', title: 'Home Wi-Fi', notes: 'SSID: Sunset-Antenna\nPassword: pale-violet-disk-902\nRouter admin: admin / printed on the sticker under the router.', color: 8 }),
      mk({ type: 'login', title: 'Reddit', username: 'aarav_sh', url: 'https://reddit.com', password: 'password123', color: 10 }),
      mk({ type: 'login', title: 'X (Twitter)', username: 'aarav_sh', url: 'https://x.com', password: 'Sunset-Mirage#2027', color: 3 }),
      mk({ type: 'login', title: 'Instagram', username: 'aarav.sharma', url: 'https://instagram.com', password: 'Sunset-Mirage#2027', color: 6 }),
      mk({ type: 'note', title: 'Recovery Codes — GitHub', notes: '1: 4E7A-2K9M\n2: QP3Z-8WLD\n3: 77TB-HN2C\n4: X9RK-5JQE\nStore somewhere safe after use.', color: 11, deletedAt: new Date().toISOString() }),
    ];
  }

  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  if (!db || !Array.isArray(db.items)) {
    db = {
      items: seedItems(),
      settings: { theme: 'system', autoLockMinutes: 5, clipboardClearSeconds: 20, lockOnSystemLock: false },
    };
  }

  let unlocked = true;
  let clipTimer = null;
  const listeners = { locked: [], clip: [] };

  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode */ } };
  const findItem = (id) => db.items.find((x) => x.id === id);

  function sanitize(item) {
    const s = (v) => (typeof v === 'string' ? v.slice(0, 20000) : '');
    return {
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      type: ['login', 'card', 'note'].includes(item.type) ? item.type : 'login',
      title: s(item.title), username: s(item.username), password: s(item.password),
      url: s(item.url), notes: s(item.notes),
      cardNumber: s(item.cardNumber), cardHolder: s(item.cardHolder),
      cardExpiry: s(item.cardExpiry), cardCvv: s(item.cardCvv),
      color: Number.isInteger(item.color) ? Math.max(0, Math.min(11, item.color)) : 0,
      favorite: !!item.favorite, deletedAt: item.deletedAt || null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  window.AV.api = {
    mode: 'demo',
    demoMaster: MASTER,

    getThemeSync: () => localStorage.getItem('av.theme') || 'system',

    status: () => delay({
      initialized: true, unlocked, settings: db.settings, version: '1.0.0', platform: 'web',
    }, 60),

    createVault: (pw) => delay(() => {
      if (String(pw || '').length < 8) throw new Error('weak-password');
      db.items = []; unlocked = true; persist();
      return true;
    }),

    unlock: (pw) => delay(() => {
      if (pw !== MASTER) throw new Error('invalid-password');
      unlocked = true;
      return true;
    }),

    lock: () => delay(() => {
      unlocked = false;
      listeners.locked.forEach((cb) => { try { cb(); } catch { /* noop */ } });
      return true;
    }),

    getItems: () => delay(() => {
      if (!unlocked) throw new Error('locked');
      return db.items.map((x) => Object.assign({}, x));
    }),

    upsertItem: (item) => delay(() => {
      const clean = sanitize(item || {});
      const i = db.items.findIndex((x) => x.id === clean.id);
      if (i >= 0) { clean.createdAt = db.items[i].createdAt; db.items[i] = clean; }
      else db.items.push(clean);
      persist();
      return clean;
    }),

    setFavorite: (id, fav) => delay(() => {
      const it = findItem(id);
      if (it) { it.favorite = !!fav; persist(); }
      return it ? Object.assign({}, it) : null;
    }),

    trashItem: (id) => delay(() => {
      const it = findItem(id);
      if (it) { it.deletedAt = new Date().toISOString(); persist(); }
      return it ? Object.assign({}, it) : null;
    }),

    restoreItem: (id) => delay(() => {
      const it = findItem(id);
      if (it) { it.deletedAt = null; persist(); }
      return it ? Object.assign({}, it) : null;
    }),

    deleteItemForever: (id) => delay(() => {
      db.items = db.items.filter((x) => x.id !== id);
      persist();
      return true;
    }),

    emptyTrash: () => delay(() => {
      const n = db.items.filter((x) => x.deletedAt).length;
      db.items = db.items.filter((x) => !x.deletedAt);
      persist();
      return n;
    }),

    generatePassword: (opts = {}) => delay(() => {
      const o = {
        length: parseInt(opts.length, 10) || 20,
        upper: opts.upper !== false, lower: opts.lower !== false,
        digits: opts.digits !== false, symbols: opts.symbols !== false,
      };
      let pool = '';
      if (o.upper) pool += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (o.lower) pool += 'abcdefghijklmnopqrstuvwxyz';
      if (o.digits) pool += '0123456789';
      if (o.symbols) pool += '!@#$%^&*()-_=+[]{}<>?,.;:';
      if (!pool) pool = 'abcdefghijklmnopqrstuvwxyz';
      const len = Math.max(6, Math.min(128, o.length));
      const rnd = new Uint32Array(len);
      crypto.getRandomValues(rnd);
      return Array.from(rnd, (n) => pool[n % pool.length]).join('');
    }, 60),

    changeMaster: (cur, next) => delay(() => {
      if (cur !== MASTER) throw new Error('invalid-password');
      if (String(next || '').length < 8) throw new Error('weak-password');
      return true;
    }),

    exportBackup: () => delay(() => {
      AV.toast('Encrypted export is available in the Windows app', { icon: 'download', type: 'warn' });
      return null;
    }, 200),

    importPick: () => delay(() => {
      AV.toast('Encrypted import is available in the Windows app', { icon: 'upload', type: 'warn' });
      return null;
    }, 200),

    importWithPassword: () => delay(() => { throw new Error('unavailable'); }),

    copy: (text) => {
      const str = String(text);
      const done = (navigator.clipboard && navigator.clipboard.writeText)
        ? navigator.clipboard.writeText(str)
        : Promise.resolve();
      return done.then(() => {
        clearTimeout(clipTimer);
        const secs = Number(db.settings.clipboardClearSeconds) || 0;
        if (secs > 0) {
          clipTimer = setTimeout(() => {
            listeners.clip.forEach((cb) => { try { cb(); } catch { /* noop */ } });
          }, secs * 1000);
        }
        return true;
      }).catch(() => true);
    },

    getSettings: () => delay(db.settings, 40),

    setSettings: (patch) => delay(() => {
      if (patch && typeof patch === 'object') {
        for (const k of ['theme', 'autoLockMinutes', 'clipboardClearSeconds', 'lockOnSystemLock']) {
          if (k in patch) db.settings[k] = patch[k];
        }
        persist();
      }
      return db.settings;
    }),

    openExternal: (url) => { window.open(url, '_blank', 'noopener'); return Promise.resolve(true); },

    winMinimize: () => {}, winMaximize: () => {}, winClose: () => {}, closeNow: () => {},
    activity: () => {},
    onLocked: (cb) => { listeners.locked.push(cb); },
    onClipboardCleared: (cb) => { listeners.clip.push(cb); },
    onClosing: () => {}, onMaximized: () => {},
  };
})();
