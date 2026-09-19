/* AuraVault — application controller: boot, routing, sidebar, theme,
 * activity tracking for auto-lock, and keyboard shortcuts.
 */
'use strict';

(function () {

  const S = AV.state = {
    items: [],
    settings: {
      theme: 'system',
      autoLockMinutes: 5,
      clipboardClearSeconds: 20,
      lockOnSystemLock: true,
    },
    route: { name: 'boot' },
    section: 'all',
    query: '',
    version: '',
    gen: { length: 20, upper: true, lower: true, digits: true, symbols: true, avoidAmbiguous: false, current: '' },
    genHistory: [],
  };

  /* ============================ theme ============================ */

  AV.applyTheme = function applyTheme(pref) {
    const dark = pref === 'dark'
      || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-pref', pref);
    try { localStorage.setItem('av.theme', pref); } catch { /* private mode */ }
  };

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) {
    mq.addEventListener('change', () => {
      if ((document.documentElement.getAttribute('data-theme-pref') || 'system') === 'system') {
        AV.applyTheme('system');
      }
    });
  }

  /* ========================== navigation ========================== */

  function renderRoute(route) {
    if (route.name === 'home') AV.views.renderHome();
    else if (route.name === 'detail') AV.views.renderDetail(route.id);
    else if (route.name === 'generator') AV.views.renderGenerator();
    else if (route.name === 'settings') AV.views.renderSettings();
    else if (route.name === 'trash') AV.views.renderTrash();
    else if (route.name === 'security') AV.views.renderSecurity();
  }

  function updateChrome() {
    const nav = AV.$('#sbNav');
    AV.$$('.nav-item', nav).forEach((n) => n.classList.remove('active'));
    let active = null;
    if (S.route.name === 'home') {
      active = nav.querySelector(`[data-sec="${S.section}"]`);
    } else if (['trash', 'security', 'generator', 'settings'].includes(S.route.name)) {
      active = nav.querySelector(`[data-nav="${S.route.name}"]`);
    }
    if (active) active.classList.add('active');
    AV.movePill(active);
  }

  AV.go = function go(route, opts = {}) {
    const prevName = S.route.name;
    const dir = opts.dir
      || (route.name === 'detail' ? 'forward' : prevName === 'detail' ? 'back' : 'fade');
    const nextEl = AV.$(`#page-${route.name}`);
    if (!nextEl) return;
    const prevEl = prevName && prevName !== route.name ? AV.$(`#page-${prevName}`) : null;

    if (prevEl) AV.animatePages(prevEl, nextEl, dir);
    else nextEl.classList.add('active');

    if (!(route.name === 'home' && prevName === 'detail')) {
      const sc = nextEl.querySelector('.page-scroll');
      if (sc) sc.scrollTop = 0;
    }

    S.route = route;
    renderRoute(route);
    updateChrome();
  };

  AV.setSection = function setSection(sec) {
    S.section = sec;
    const sc = AV.$('#homeScroll');
    if (sc) sc.scrollTop = 0;
    if (S.route.name === 'home') {
      AV.views.renderHome();
      updateChrome();
    } else {
      AV.go({ name: 'home' }, { dir: 'fade' });
    }
  };

  /* ============================ sidebar ============================ */

  function buildSidebar() {
    const nav = AV.$('#sbNav');
    const item = (sec, label, icon) => `
      <button class="nav-item" data-sec="${sec}">
        <span class="nav-ic">${AV.icon(icon, 18)}</span>
        <span class="nav-label">${label}</span>
        <span class="nav-count" data-count="${sec}">0</span>
      </button>`;

    nav.insertAdjacentHTML('beforeend',
      item('all', 'All Items', 'grid')
      + item('favorites', 'Favorites', 'star')
      + '<div class="sb-label">Categories</div>'
      + item('logins', 'Logins', 'key')
      + item('cards', 'Cards', 'card')
      + item('notes', 'Secure Notes', 'note')
      + '<div class="sb-spacer"></div>'
      + '<div class="sb-label">Tools</div>'
      + `<button class="nav-item" data-nav="trash">
          <span class="nav-ic">${AV.icon('trash', 18)}</span>
          <span class="nav-label">Recently Deleted</span>
          <span class="nav-count" data-count="trash">0</span>
        </button>
        <button class="nav-item" data-nav="security">
          <span class="nav-ic">${AV.icon('shield', 18)}</span>
          <span class="nav-label">Security Checkup</span>
          <span class="nav-count" data-count="security">0</span>
        </button>
        <button class="nav-item" data-nav="generator">
          <span class="nav-ic">${AV.icon('zap', 18)}</span>
          <span class="nav-label">Generator</span>
        </button>
        <button class="nav-item" data-nav="settings">
          <span class="nav-ic">${AV.icon('gear', 18)}</span>
          <span class="nav-label">Settings</span>
        </button>`);

    nav.addEventListener('click', (e) => {
      const secBtn = e.target.closest('[data-sec]');
      const pageBtn = e.target.closest('[data-nav]');
      if (secBtn) AV.setSection(secBtn.dataset.sec);
      else if (pageBtn) AV.go({ name: pageBtn.dataset.nav }, { dir: 'fade' });
    });

    AV.$('#btnLockIcon').innerHTML = AV.icon('lock', 17);
    AV.$('#btnLock').addEventListener('click', () => AV.lockNow());
  }

  /* ============================ counts ============================ */

  AV.updateCounts = function updateCounts() {
    const live = S.items.filter((x) => !x.deletedAt);
    const counts = {
      all: live.length,
      favorites: live.filter((x) => x.favorite).length,
      logins: live.filter((x) => x.type === 'login').length,
      cards: live.filter((x) => x.type === 'card').length,
      notes: live.filter((x) => x.type === 'note').length,
      trash: S.items.filter((x) => x.deletedAt).length,
      security: AV.securityFindings ? AV.securityFindings().total : 0,
    };
    AV.$$('[data-count]').forEach((el) => { el.textContent = counts[el.dataset.count] || 0; });
  };

  AV.reloadItems = async function reloadItems() {
    try { S.items = await AV.api.getItems(); }
    catch { S.items = []; }
    AV.updateCounts();
  };

  /* ========================= vault lifecycle ========================= */

  let revealed = false;
  function revealApp() {
    const app = AV.$('#app');
    if (app.hidden) {
      app.hidden = false;
      revealed = true;
    }
  }

  AV.afterUnlock = async function afterUnlock(firstRun = false) {
    AV.hideLock();
    await AV.reloadItems();
    revealApp();
    S.section = 'all';
    S.query = '';
    const si = AV.$('#searchInput');
    si.value = '';
    AV.$('#searchClear').hidden = true;
    AV.go({ name: 'home' }, { dir: 'fade' });
    if (!firstRun) AV.toast('Vault unlocked', { icon: 'lock', type: 'info', duration: 1800 });
  };

  let lockShownAt = 0;
  function onLocked() {
    const now = Date.now();
    if (now - lockShownAt < 500) return;
    lockShownAt = now;
    S.items = [];
    S.query = '';
    AV.updateCounts();
    AV.closeSheet();
    const si = AV.$('#searchInput');
    if (si) si.value = '';
    const sc = AV.$('#searchClear');
    if (sc) sc.hidden = true;
    AV.views.showLock();
  }

  AV.lockNow = async function lockNow() {
    try { await AV.api.lock(); } catch { /* already locked */ }
    onLocked(); // the locked event may also fire — onLocked debounces itself
  };

  /* ============================ chrome ============================ */

  function wireChrome() {
    AV.$('#searchIcon').innerHTML = AV.icon('search', 16);

    const si = AV.$('#searchInput');
    si.addEventListener('input', AV.debounce(() => {
      S.query = si.value;
      AV.$('#searchClear').hidden = !si.value;
      if (S.route.name === 'home') AV.views.renderHome();
    }, 120));
    AV.$('#searchClear').addEventListener('click', () => AV.setSearch(''));
    AV.$('#btnAdd').addEventListener('click', () => AV.views.openItemSheet(null, { type: S.section }));

    const hs = AV.$('#homeScroll');
    hs.addEventListener('scroll', () => {
      AV.$('#page-home').classList.toggle('scrolled', hs.scrollTop > 34);
    }, { passive: true });

    if (AV.api.mode === 'electron') {
      AV.$('#winControls').hidden = false;
      AV.$('#wcMin').addEventListener('click', () => AV.api.winMinimize());
      AV.$('#wcMax').addEventListener('click', () => AV.api.winMaximize());
      AV.$('#wcClose').addEventListener('click', () => AV.api.winClose());
    } else {
      document.body.classList.add('demo');
      AV.$('#demoPill').hidden = false;
      document.body.appendChild(AV.el(
        '<div class="demo-banner"><span class="dot"></span><span>Preview mode — sample data lives in this browser only</span></div>'
      ));
    }
  }

  AV.setSearch = function setSearch(q) {
    S.query = q;
    const si = AV.$('#searchInput');
    si.value = q;
    AV.$('#searchClear').hidden = !q;
    if (S.route.name === 'home') AV.views.renderHome();
  };

  AV.openUrl = function openUrl(url) {
    const u = String(url || '');
    if (!/^https?:\/\//i.test(u)) {
      AV.toast('Only http(s) links can be opened', { icon: 'alert', type: 'warn' });
      return;
    }
    AV.api.openExternal(u);
  };

  /* ==================== activity & shortcuts ==================== */

  let lastActivity = 0;
  ['pointerdown', 'keydown', 'wheel'].forEach((ev) => {
    document.addEventListener(ev, () => {
      const n = Date.now();
      if (n - lastActivity > 4000) {
        lastActivity = n;
        AV.api.activity();
      }
    }, { passive: true });
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      AV.lockNow();
    } else if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (S.route.name !== 'home') AV.go({ name: 'home' }, { dir: 'fade' });
      setTimeout(() => AV.$('#searchInput').focus(), 140);
    } else if (mod && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (S.route.name !== 'boot') AV.views.openItemSheet(null, { type: S.section });
    } else if (e.key === 'Escape') {
      if (AV._activeSheet) AV.closeSheet();
      else if (S.route.name === 'detail') AV.go({ name: 'home' }, { dir: 'back' });
    }
  });

  /* ===================== gallery mode (docs) ===================== */

  /* `#gallery/<view>[/dark]` renders a chosen view for the documentation
   * screenshot pipeline (scripts/web-shots.js). Gallery mode hides the
   * browser-preview banner and shows the window chrome so headless
   * captures look exactly like the desktop app.
   */
  AV.isGallery = function isGallery() {
    return location.hash.indexOf('gallery') !== -1;
  };

  function applyGalleryDirective() {
    const parts = location.hash.replace(/^#/, '').split('/').slice(1);
    const page = parts.find((p) => p !== 'dark' && p !== 'light') || 'home';
    for (const p of parts) {
      if (p === 'dark') AV.applyTheme('dark');
      if (p === 'light') AV.applyTheme('light');
    }
    setTimeout(() => {
      if (page === 'detail') {
        const row = document.querySelector('#homeList .row-wrap .row');
        if (row) row.click();
      } else if (page === 'add-sheet') {
        AV.views.openItemSheet();
      } else if (['generator', 'settings', 'trash', 'security'].includes(page)) {
        const nav = document.querySelector(`[data-nav="${page}"]`);
        if (nav) nav.click();
      } else if (page === 'lock') {
        AV.lockNow();
      }
    }, 300);
  }

  /* ============================= boot ============================= */

  document.addEventListener('DOMContentLoaded', async () => {
    // gallery mode = documentation captures: freeze every animation so the
    // screenshot can never catch a mid-flight spring (scale/offset = blur)
    if (AV.isGallery()) document.documentElement.classList.add('av-static');

    let status = null;
    try { status = await AV.api.status(); } catch { /* ipc hiccup */ }

    if (status && status.settings) S.settings = Object.assign(S.settings, status.settings);
    S.version = (status && status.version) || '';

    buildSidebar();
    wireChrome();
    AV.applyTheme(S.settings.theme || 'system');

    AV.api.onLocked(onLocked);
    AV.api.onClipboardCleared(() => AV.toast('Clipboard cleared', { icon: 'check', type: 'info' }));
    AV.api.onClosing(() => {
      AV.$('#app').classList.add('closing');
      setTimeout(() => AV.api.closeNow(), 300);
    });
    AV.api.onMaximized((m) => document.body.classList.toggle('is-max', !!m));

    if (!status || !status.initialized) {
      AV.views.showSetup();
      revealApp();
    } else if (!status.unlocked) {
      AV.views.showLock();
      revealApp();
    } else {
      await AV.afterUnlock();
    }

    // settle the sidebar pill once fonts are in
    requestAnimationFrame(updateChrome);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateChrome);
    window.addEventListener('resize', AV.debounce(updateChrome, 160));

    if (AV.isGallery()) applyGalleryDirective();

    // automation hooks — only present when loaded with #debug (screenshot suite)
    if (location.hash.indexOf('debug') !== -1) {
      window.__av = {
        seed: async (items) => {
          for (const raw of items) {
            const saved = await AV.api.upsertItem(raw);
            const ix = S.items.findIndex((x) => x.id === saved.id);
            if (ix >= 0) S.items[ix] = saved; else S.items.push(saved);
          }
          AV.updateCounts();
          if (S.route.name === 'home') AV.views.renderHome();
        },
        lock: () => AV.lockNow(),
        setTheme: (t) => AV.applyTheme(t),
        state: S,
      };
    }
  });
})();
