/* AuraVault — view renderers: home, detail, generator, settings, trash,
 * lock screen, first-run setup, and the add/edit sheet.
 */
'use strict';

(function () {

  AV.views = {};

  const TYPE_LABEL = { login: 'Login', card: 'Payment Card', note: 'Secure Note' };

  AV.SECTIONS = {
    all: { label: 'All Items', icon: 'grid' },
    favorites: { label: 'Favorites', icon: 'star' },
    logins: { label: 'Logins', icon: 'key' },
    cards: { label: 'Cards', icon: 'card' },
    notes: { label: 'Secure Notes', icon: 'note' },
    trash: { label: 'Recently Deleted', icon: 'trash' },
  };

  const state = () => AV.state;

  /* ============================== HOME ============================== */

  function visibleItems() {
    const st = state();
    const q = st.query.trim().toLowerCase();
    return st.items.filter((it) => {
      if (st.section === 'trash' ? !it.deletedAt : it.deletedAt) return false;
      if (st.section === 'favorites' && !it.favorite) return false;
      if (['logins', 'cards', 'notes'].includes(st.section) && it.type !== st.section.slice(0, -1)) return false;
      if (q) {
        const hay = `${it.title} ${it.username} ${it.url} ${it.notes} ${it.cardHolder}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  AV.views.renderHome = function renderHome() {
    const st = state();
    const sec = AV.SECTIONS[st.section] || AV.SECTIONS.all;
    AV.$('#homeTitle').textContent = sec.label;
    AV.$('#homeCompactTitle').textContent = sec.label;
    const root = AV.$('#homeList');
    root.replaceChildren();

    const items = visibleItems();
    if (!items.length) {
      root.appendChild(emptyState(st.section, st.query));
      return;
    }

    let idx = 0;
    if (st.section === 'all' || st.section === 'favorites') {
      for (const [type, label] of [['login', 'Logins'], ['card', 'Cards'], ['note', 'Secure Notes']]) {
        const its = items.filter((x) => x.type === type);
        if (!its.length) continue;
        root.appendChild(groupBlock(label, its, idx));
        idx += its.length;
      }
      if (!root.childElementCount) root.appendChild(groupBlock(null, items, 0));
    } else {
      root.appendChild(groupBlock(null, items, 0));
    }
  };

  function groupBlock(label, items, startIdx) {
    const wrap = AV.el('<div class="list-group"></div>');
    if (label) {
      const t = AV.el('<div class="group-title"></div>');
      t.textContent = label;
      wrap.appendChild(t);
    }
    const g = AV.el('<div class="group"></div>');
    items.forEach((it, i) => g.appendChild(rowEl(it, startIdx + i)));
    wrap.appendChild(g);
    return wrap;
  }

  function iconContent(it, size) {
    if (it.type === 'card') return AV.icon('card', size || 18);
    if (it.type === 'note') return AV.icon('note', size || 18);
    return null; // logins show a letter
  }

  function applyIcon(el, it, letterSize) {
    const ic = iconContent(it);
    if (ic) el.innerHTML = ic;
    else el.textContent = AV.initial(it.title);
  }

  function rowSub(it) {
    if (it.type === 'card') return `${AV.cardTail(it.cardNumber)} · ${it.cardHolder || 'Cardholder'}`;
    if (it.type === 'note') return (it.notes || '').split('\n')[0].slice(0, 80) || 'Empty note';
    return it.username || it.url || '—';
  }

  function rowEl(it, i) {
    const wrap = AV.el(`<div class="row-wrap" data-id="${it.id}"></div>`);
    const row = AV.el(`<div class="row" tabindex="0" role="button">
        <div class="row-icon ic-${it.color % 12}"></div>
        <div class="row-main">
          <div class="row-title"></div>
          <div class="row-sub"></div>
        </div>
        <div class="row-trail">
          <button class="icon-btn row-fav ${it.favorite ? 'is-fav' : ''}" aria-label="Toggle favorite">${AV.icon('star', 17, it.favorite)}</button>
          <button class="icon-btn row-copy" aria-label="Copy secret">${AV.icon('copy', 16)}</button>
          <span class="chev">${AV.icon('chevron-right', 15)}</span>
        </div>
      </div>`);
    row.style.setProperty('--i', Math.min(i, 14));
    applyIcon(row.querySelector('.row-icon'), it);
    row.querySelector('.row-title').textContent = it.title || 'Untitled';
    row.querySelector('.row-sub').textContent = rowSub(it);
    wrap.appendChild(row);

    row.addEventListener('click', (e) => {
      if (e.target.closest('.icon-btn')) return;
      AV.go({ name: 'detail', id: it.id });
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') AV.go({ name: 'detail', id: it.id });
    });
    row.querySelector('.row-fav').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(it, e.currentTarget);
    });
    row.querySelector('.row-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      quickCopy(it);
    });
    return wrap;
  }

  async function toggleFavorite(it, btn) {
    const updated = await AV.api.setFavorite(it.id, !it.favorite);
    if (!updated) return;
    Object.assign(it, updated);
    AV.updateCounts();
    document.querySelectorAll(`.row-wrap[data-id="${it.id}"] .row-fav`).forEach((b) => {
      b.classList.toggle('is-fav', it.favorite);
      b.innerHTML = AV.icon('star', 17, it.favorite);
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    });
    document.querySelectorAll(`.d-fav[data-for="${it.id}"]`).forEach((b) => {
      b.classList.toggle('is-fav', it.favorite);
      b.innerHTML = AV.icon('star', 19, it.favorite);
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    });
    if (state().section === 'favorites' && !it.favorite) AV.views.renderHome();
  }

  function quickCopy(it) {
    if (it.type === 'card') return AV.copy(it.cardNumber, 'Card number copied');
    if (it.type === 'note') return AV.copy(it.notes, 'Note copied');
    return AV.copy(it.password, 'Password copied');
  }

  function emptyState(section, query) {
    const st = AV.SECTIONS[section] || AV.SECTIONS.all;
    const box = AV.el(`<div class="empty">
        <div class="empty-art">${AV.emptyArt}</div>
        <div class="empty-title"></div>
        <div class="empty-sub"></div>
        <button class="btn btn-primary empty-cta">${AV.icon('plus', 16)}<span></span></button>
      </div>`);
    const title = box.querySelector('.empty-title');
    const sub = box.querySelector('.empty-sub');
    const cta = box.querySelector('.empty-cta');

    if (query) {
      title.textContent = 'No results';
      sub.textContent = `Nothing in your vault matches “${query.trim()}”.`;
      cta.querySelector('span').textContent = 'Clear search';
      cta.addEventListener('click', () => AV.setSearch(''));
      return box;
    }
    if (section === 'trash') {
      title.textContent = 'Trash is empty';
      sub.textContent = 'Items you delete rest here for 30 days before disappearing forever.';
      cta.remove();
      return box;
    }
    if (section === 'favorites') {
      title.textContent = 'No favorites yet';
      sub.textContent = 'Tap the star on any item to keep it within easy reach here.';
      cta.remove();
      return box;
    }
    if (section === 'all') {
      title.textContent = 'Your vault is ready';
      sub.textContent = 'Add your first password, card or secure note. Everything is encrypted on this PC before it ever touches the disk.';
    } else {
      title.textContent = `No ${st.label.toLowerCase()} yet`;
      sub.textContent = `Items you save as “${st.label}” will appear here.`;
    }
    cta.querySelector('span').textContent = 'Add your first item';
    cta.addEventListener('click', () => AV.views.openItemSheet(null, { type: section }));
    return box;
  }

  /* ============================= DETAIL ============================= */

  AV.views.renderDetail = function renderDetail(id) {
    const root = AV.$('#detailScroll');
    root.replaceChildren();
    const it = state().items.find((x) => x.id === id);
    if (!it) {
      const miss = AV.el('<div class="page-inner"><div class="empty"><div class="empty-title">Item not found</div></div></div>');
      root.appendChild(miss);
      return;
    }

    const inner = AV.el('<div class="page-inner"></div>');

    const top = AV.el(`<div class="d-top"><button class="back-btn">${AV.icon('chevron-left', 17)}<span>Back</span></button></div>`);
    top.querySelector('.back-btn').addEventListener('click', () => AV.go({ name: 'home' }, { dir: 'back' }));
    inner.appendChild(top);

    const hero = AV.el(`<div class="d-hero">
        <div class="d-icon ic-${it.color % 12}"></div>
        <div class="d-hero-main">
          <div class="d-title"></div>
          <div class="d-sub"></div>
        </div>
        <div class="d-hero-actions">
          <button class="icon-btn d-fav ${it.favorite ? 'is-fav' : ''}" data-for="${it.id}" aria-label="Toggle favorite">${AV.icon('star', 19, it.favorite)}</button>
          <button class="icon-btn d-edit" aria-label="Edit item">${AV.icon('edit', 18)}</button>
        </div>
      </div>`);
    applyIcon(hero.querySelector('.d-icon'), it, 26);
    hero.querySelector('.d-title').textContent = it.title || 'Untitled';
    hero.querySelector('.d-sub').textContent = `${TYPE_LABEL[it.type]}${it.url ? ' · ' + it.url.replace(/^https?:\/\//, '') : ''}`;
    hero.querySelector('.d-fav').addEventListener('click', (e) => toggleFavorite(it, e.currentTarget));
    hero.querySelector('.d-edit').addEventListener('click', () => AV.views.openItemSheet(it));
    inner.appendChild(hero);

    const group = AV.el('<div class="group"></div>');

    function fieldRow({ label, value, mono, secret, copy, link, pre }) {
      const row = AV.el(`<div class="field">
          <div class="f-label"></div>
          <div class="f-value ${mono ? 'mono' : ''} ${pre ? 'pre' : ''} ${link ? 'link' : ''}"></div>
          <div class="f-actions">
            ${secret ? `<button class="icon-btn f-eye" aria-label="Reveal">${AV.icon('eye', 16)}</button>` : ''}
            ${copy ? `<button class="icon-btn f-copy" aria-label="Copy">${AV.icon('copy', 16)}</button>` : ''}
            ${link ? `<button class="icon-btn f-open" aria-label="Open website">${AV.icon('external', 15)}</button>` : ''}
          </div>
        </div>`);
      row.querySelector('.f-label').textContent = label;
      const valEl = row.querySelector('.f-value');
      const masked = () => '•'.repeat(String(value || '').length || 6);
      let revealed = false;
      const paint = () => {
        if (secret && !revealed) valEl.textContent = masked();
        else valEl.textContent = value || '—';
      };
      paint();

      const eyeBtn = row.querySelector('.f-eye');
      if (eyeBtn) eyeBtn.addEventListener('click', () => {
        revealed = !revealed;
        eyeBtn.innerHTML = revealed ? AV.icon('eye-off', 16) : AV.icon('eye', 16);
        paint();
      });
      const copyBtn = row.querySelector('.f-copy');
      if (copyBtn) copyBtn.addEventListener('click', () => AV.copy(value, `${label} copied`));
      const openBtn = row.querySelector('.f-open');
      if (openBtn) openBtn.addEventListener('click', () => AV.openUrl(value));
      if (link && value) valEl.addEventListener('click', () => AV.openUrl(value));
      return row;
    }

    if (it.type === 'login') {
      if (it.username) group.appendChild(fieldRow({ label: 'Username', value: it.username, copy: true }));
      if (it.password) group.appendChild(fieldRow({ label: 'Password', value: it.password, mono: true, secret: true, copy: true }));
      if (it.url) group.appendChild(fieldRow({ label: 'Website', value: it.url, copy: true, link: true }));
    } else if (it.type === 'card') {
      if (it.cardNumber) group.appendChild(fieldRow({ label: 'Card number', value: it.cardNumber, mono: true, secret: true, copy: true }));
      if (it.cardHolder) group.appendChild(fieldRow({ label: 'Cardholder', value: it.cardHolder, copy: true }));
      if (it.cardExpiry) group.appendChild(fieldRow({ label: 'Expires', value: it.cardExpiry, copy: true }));
      if (it.cardCvv) group.appendChild(fieldRow({ label: 'CVV', value: it.cardCvv, mono: true, secret: true, copy: true }));
    }
    if (it.notes) group.appendChild(fieldRow({ label: 'Notes', value: it.notes, copy: true, pre: true }));

    if (group.childElementCount) inner.appendChild(group);

    if (it.type === 'login' && it.password) {
      const s = AV.strength(it.password);
      const meterGroup = AV.el(`<div class="group"><div class="meter-row">
          <div class="meter-label"><span>Password strength</span><b></b></div>
          <div class="meter"><i></i></div>
        </div></div>`);
      meterGroup.querySelector('b').textContent = s.label;
      AV.setMeter(meterGroup.querySelector('.meter'), s.score);
      const bar = meterGroup.querySelector('.meter i');
      bar.style.width = `${[8, 25, 50, 75, 100][s.score]}%`;
      inner.appendChild(meterGroup);
    }

    const meta = AV.el('<div class="group"></div>');
    meta.appendChild(fieldRow({ label: 'Created', value: AV.fmtDate(it.createdAt) }));
    meta.appendChild(fieldRow({ label: 'Modified', value: AV.fmtDate(it.updatedAt) }));
    inner.appendChild(meta);

    const danger = AV.el(`<div class="group"><button class="danger-btn">${AV.icon('trash', 16)}&nbsp; Move to Trash</button></div>`);
    danger.querySelector('.danger-btn').addEventListener('click', () => AV.deleteItemFlow(it, { fromDetail: true }));
    inner.appendChild(danger);

    root.appendChild(inner);
  };

  /* ------------------------- delete flow ------------------------- */

  AV.deleteItemFlow = async function deleteItemFlow(it, { fromDetail = false } = {}) {
    const ok = await AV.confirmAction({
      title: `Move “${it.title || 'Untitled'}” to trash?`,
      message: 'You can restore it from Recently Deleted for 30 days.',
      confirmText: 'Move to Trash',
    });
    if (!ok) return;
    const removed = await AV.api.trashItem(it.id);
    if (removed) Object.assign(it, removed);
    AV.updateCounts();

    if (fromDetail) AV.go({ name: 'home' }, { dir: 'back' });

    const wrap = document.querySelector(`#homeList .row-wrap[data-id="${it.id}"]`);
    if (wrap) {
      wrap.classList.add('removing');
      setTimeout(() => {
        wrap.remove();
        if (!AV.$('#homeList').childElementCount) AV.views.renderHome();
      }, 420);
    } else if (state().route.name === 'home') {
      AV.views.renderHome();
    }

    AV.toast('Moved to trash', {
      icon: 'trash', type: 'warn', duration: 5200, action: 'Undo',
      onAction: async () => {
        const restored = await AV.api.restoreItem(it.id);
        if (restored) {
          Object.assign(it, restored);
          AV.updateCounts();
          if (state().route.name === 'home') {
            AV.views.renderHome();
            const w = document.querySelector(`#homeList .row-wrap[data-id="${it.id}"]`);
            if (w) w.classList.add('adding');
          }
          AV.toast('Restored to your vault', { icon: 'restore', type: 'ok' });
        }
      },
    });
  };

  /* ============================ GENERATOR ============================ */

  AV.views.renderGenerator = function renderGenerator() {
    const root = AV.$('#genScroll');
    root.replaceChildren();
    const inner = AV.el('<div class="page-inner"></div>');
    const g = state().gen;

    inner.appendChild(AV.el('<div class="ph-row"><h1 class="big-title">Generator</h1></div>'));

    const hero = AV.el(`<div class="gen-hero">
        <div class="gen-pass-row">
          <div class="gen-pass" id="genPass"></div>
          <div class="gen-actions">
            <button class="icon-btn gen-btn" id="genRegen" aria-label="Generate a new password">${AV.icon('refresh', 18)}</button>
            <button class="icon-btn" id="genCopy" aria-label="Copy password">${AV.icon('copy', 17)}</button>
          </div>
        </div>
        <div class="gen-strength">
          <div class="meter"><i></i></div>
          <div class="gen-meta"><span id="genLabel"></span><span id="genBits"></span></div>
        </div>
      </div>`);
    inner.appendChild(hero);

    const opts = AV.el('<div class="group"></div>');

    const lenRow = AV.el(`<div class="field g-row">
        <div class="f-label">Length</div>
        <input type="range" min="8" max="64" step="1" aria-label="Password length" />
        <div class="range-val"></div>
      </div>`);
    const range = lenRow.querySelector('input');
    const lenVal = lenRow.querySelector('.range-val');
    const setFill = () => {
      const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--fill', `${pct}%`);
      lenVal.textContent = range.value;
    };
    range.value = g.length;
    setFill();
    range.addEventListener('input', () => {
      g.length = parseInt(range.value, 10);
      setFill();
      regen(false);
    });
    opts.appendChild(lenRow);

    const switches = [
      ['upper', 'Uppercase', 'A B C'],
      ['lower', 'Lowercase', 'a b c'],
      ['digits', 'Digits', '0 – 9'],
      ['symbols', 'Symbols', '! @ # $'],
      ['avoidAmbiguous', 'Avoid look-alikes', 'O/0, I/l'],
    ];
    for (const [key, label, hint] of switches) {
      const row = AV.el(`<div class="field g-row">
          <div class="f-label">${label} <span class="f-hint">${hint}</span></div>
          <div class="f-value"></div>
        </div>`);
      row.querySelector('.f-value').appendChild(AV.makeSwitch(g[key], (v) => {
        g[key] = v;
        regen(false);
      }));
      opts.appendChild(row);
    }
    inner.appendChild(opts);

    const histTitle = AV.el('<div class="list-group"><div class="group-title">History</div><div class="group" id="genHistory"></div></div>');
    inner.appendChild(histTitle);

    const useBtn = AV.el(`<button class="btn btn-soft" style="">Use in a new item</button>`); // no inline style
    useBtn.removeAttribute('style');
    useBtn.insertAdjacentHTML('afterbegin', AV.icon('plus', 15));
    useBtn.addEventListener('click', () => AV.views.openItemSheet(null, { password: g.current }));
    const useWrap = AV.el('<div class="use-row"></div>');
    useWrap.appendChild(useBtn);
    inner.appendChild(useWrap);

    root.appendChild(inner);

    async function regen(animate = true) {
      const pass = await AV.api.generatePassword(g);
      g.current = pass;
      const el = AV.$('#genPass');
      if (!el) return;
      el.textContent = pass;
      if (animate) {
        el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
        const btn = AV.$('#genRegen');
        btn.classList.remove('busy'); void btn.offsetWidth; btn.classList.add('busy');
      }
      const s = AV.strength(pass);
      AV.setMeter(hero.querySelector('.meter'), s.score);
      AV.$('#genLabel').textContent = s.label;
      AV.$('#genBits').textContent = `${s.bits} bits · cracks in ~${AV.crackTime(s.bits)}`;
      pushHistory(pass);
    }

    function pushHistory(pass) {
      const h = state().genHistory;
      h.unshift({ pass, ts: Date.now() });
      if (h.length > 5) h.length = 5;
      const box = AV.$('#genHistory');
      if (!box) return;
      box.replaceChildren();
      h.forEach(({ pass: p }) => {
        const row = AV.el(`<div class="gen-hist-row">
            <div class="gh-pass"></div>
            <button class="icon-btn" aria-label="Copy">${AV.icon('copy', 15)}</button>
          </div>`);
        row.querySelector('.gh-pass').textContent = p;
        row.querySelector('button').addEventListener('click', () => AV.copy(p, 'Password copied'));
        box.appendChild(row);
      });
    }

    AV.$('#genRegen').addEventListener('click', () => regen(true));
    AV.$('#genCopy').addEventListener('click', () => AV.copy(g.current, 'Password copied'));
    regen(true);
  };

  /* ============================ SETTINGS ============================ */

  AV.views.renderSettings = function renderSettings() {
    const root = AV.$('#setScroll');
    root.replaceChildren();
    const st = state();
    const inner = AV.el('<div class="page-inner"></div>');
    inner.appendChild(AV.el('<div class="ph-row"><h1 class="big-title">Settings</h1></div>'));

    const group = (title) => {
      const g = AV.el('<div class="list-group"></div>');
      if (title) {
        const t = AV.el('<div class="group-title"></div>');
        t.textContent = title;
        g.appendChild(t);
      }
      const body = AV.el('<div class="group"></div>');
      g.appendChild(body);
      inner.appendChild(g);
      return body;
    };

    /* appearance */
    const appear = group('Appearance');
    const themeRow = AV.el(`<div class="field g-row"><div class="f-label">Theme</div><div class="f-value"></div></div>`);
    const themeSeg = AV.el(`<div class="seg">
        <button data-v="system">System</button><button data-v="light">Light</button><button data-v="dark">Dark</button>
      </div>`);
    themeRow.querySelector('.f-value').appendChild(themeSeg);
    appear.appendChild(themeRow);
    AV.initSeg(themeSeg, st.settings.theme, async (v) => {
      st.settings.theme = v;
      AV.applyTheme(v);
      await AV.api.setSettings({ theme: v });
    });

    /* security */
    const sec = group('Security');
    const lockRow = AV.el(`<div class="field g-row"><div class="f-label">Auto-lock after</div><div class="f-value"></div></div>`);
    const lockSeg = AV.el(`<div class="seg">
        <button data-v="1">1 min</button><button data-v="5">5 min</button><button data-v="15">15 min</button><button data-v="0">Never</button>
      </div>`);
    lockRow.querySelector('.f-value').appendChild(lockSeg);
    sec.appendChild(lockRow);
    AV.initSeg(lockSeg, st.settings.autoLockMinutes, async (v) => {
      st.settings.autoLockMinutes = Number(v);
      await AV.api.setSettings({ autoLockMinutes: Number(v) });
      AV.toast(`Auto-lock ${Number(v) === 0 ? 'disabled' : `set to ${v} minute${v === '1' ? '' : 's'} of inactivity`}`, { icon: 'lock', type: 'info' });
    });

    if (AV.api.mode === 'electron') {
      const sysRow = AV.el(`<div class="field g-row"><div class="f-label">Lock when Windows locks</div><div class="f-value"></div></div>`);
      sysRow.querySelector('.f-value').appendChild(AV.makeSwitch(st.settings.lockOnSystemLock, async (v) => {
        st.settings.lockOnSystemLock = v;
        await AV.api.setSettings({ lockOnSystemLock: v });
      }));
      sec.appendChild(sysRow);
    }

    const clipRow = AV.el(`<div class="field g-row"><div class="f-label">Clear clipboard after</div><div class="f-value"></div></div>`);
    const clipSeg = AV.el(`<div class="seg">
        <button data-v="10">10 s</button><button data-v="20">20 s</button><button data-v="30">30 s</button><button data-v="0">Never</button>
      </div>`);
    clipRow.querySelector('.f-value').appendChild(clipSeg);
    sec.appendChild(clipRow);
    AV.initSeg(clipSeg, st.settings.clipboardClearSeconds, async (v) => {
      st.settings.clipboardClearSeconds = Number(v);
      await AV.api.setSettings({ clipboardClearSeconds: Number(v) });
    });
    const note = AV.el('<div class="set-note">Copied passwords are wiped from the clipboard automatically — even if you forget they’re there.</div>');
    sec.appendChild(note);

    /* vault */
    const vault = group('Vault');
    const mkRow = (label, icon, fn) => {
      const row = AV.el(`<div class="field clickable">
          <div class="f-label"></div>
          <div class="f-value" ></div>
          <div class="f-actions"><span class="chev">${AV.icon('chevron-right', 15)}</span></div>
        </div>`);
      row.querySelector('.f-label').innerHTML = `${AV.icon(icon, 16)}&nbsp;`;
      row.querySelector('.f-value').textContent = label;
      row.addEventListener('click', fn);
      return row;
    };
    vault.appendChild(mkRow('Change master password', 'key', () => AV.views.openMasterSheet()));
    if (AV.api.mode === 'electron') {
      vault.appendChild(mkRow('Export encrypted backup…', 'download', async () => {
        const p = await AV.api.exportBackup();
        if (p) AV.toast(`Backup saved to ${p}`, { icon: 'download', type: 'ok', duration: 4200 });
      }));
      vault.appendChild(mkRow('Import backup…', 'upload', () => AV.views.openImportSheet()));
    }

    /* about */
    const about = group('About');
    const verRow = AV.el('<div class="field"><div class="f-label">Version</div><div class="f-value muted"></div></div>');
    verRow.querySelector('.f-value').textContent = `${st.version || '1.0.0'} ${AV.api.mode === 'demo' ? '(web preview)' : ''}`;
    about.appendChild(verRow);
    const ghRow = AV.el(`<div class="field clickable">
        <div class="f-label">${AV.icon('external', 15)}&nbsp;</div>
        <div class="f-value">View source on GitHub</div>
        <div class="f-actions"><span class="chev">${AV.icon('chevron-right', 15)}</span></div>
      </div>`);
    ghRow.addEventListener('click', () => AV.openUrl('https://github.com/your-username/auravault'));
    about.appendChild(ghRow);
    const fine = AV.el('<div class="set-note">AuraVault stores everything locally with AES-256-GCM and never connects to the internet. No accounts, no sync, no telemetry.</div>');
    about.appendChild(fine);

    root.appendChild(inner);
  };

  /* --------------------- master password sheet --------------------- */

  AV.views.openMasterSheet = function openMasterSheet() {
    AV.openSheet((sheet) => {
      sheet.innerHTML = `
        <div class="sheet-grab"></div>
        <div class="sheet-head">
          <button class="btn-text sheet-cancel">Cancel</button>
          <div class="sheet-title">Master Password</div>
          <button class="btn-text sheet-save">Update</button>
        </div>
        <div class="sheet-body">
          <div class="field-group">
            <div class="in-row">
              <label class="in-label" for="m-cur">Current</label>
              <input id="m-cur" type="password" autocomplete="off" />
              <button class="icon-btn in-act m-eye" aria-label="Show password">${AV.icon('eye', 15)}</button>
            </div>
          </div>
          <div class="field-group">
            <div class="in-row">
              <label class="in-label" for="m-new">New</label>
              <input id="m-new" type="password" autocomplete="off" />
              <button class="icon-btn in-act m-eye" aria-label="Show password">${AV.icon('eye', 15)}</button>
            </div>
            <div class="in-row">
              <label class="in-label" for="m-conf">Confirm</label>
              <input id="m-conf" type="password" autocomplete="off" />
            </div>
            <div class="mini-meter">
              <div class="meter"><i></i></div>
              <div class="mini-hint"></div>
            </div>
          </div>
        </div>`;

      const cur = sheet.querySelector('#m-cur');
      const nw = sheet.querySelector('#m-new');
      const conf = sheet.querySelector('#m-conf');
      const meter = sheet.querySelector('.mini-meter .meter');
      const hint = sheet.querySelector('.mini-hint');

      nw.addEventListener('input', () => {
        const s = AV.strength(nw.value);
        AV.setMeter(meter, s.score);
        hint.textContent = nw.value ? `${s.label} · ${s.bits} bits` : 'Use a long, unique phrase you don’t use anywhere else.';
      });
      hint.textContent = 'Use a long, unique phrase you don’t use anywhere else.';
      sheet.querySelectorAll('.m-eye').forEach((btn) => btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.innerHTML = AV.icon(showing ? 'eye' : 'eye-off', 15);
      }));
      sheet.querySelector('.sheet-cancel').addEventListener('click', () => AV.closeSheet());

      sheet.querySelector('.sheet-save').addEventListener('click', async () => {
        if (String(nw.value).length < 8) {
          nw.parentElement.classList.add('shakeit');
          setTimeout(() => nw.parentElement.classList.remove('shakeit'), 500);
          hint.textContent = 'The new password needs at least 8 characters.';
          return;
        }
        if (nw.value !== conf.value) {
          conf.parentElement.classList.add('shakeit');
          setTimeout(() => conf.parentElement.classList.remove('shakeit'), 500);
          hint.textContent = 'The two new passwords don’t match.';
          return;
        }
        try {
          await AV.api.changeMaster(cur.value, nw.value);
          AV.closeSheet();
          AV.toast('Master password updated — vault re-encrypted', { icon: 'check', type: 'ok' });
        } catch (err) {
          cur.parentElement.classList.add('shakeit');
          setTimeout(() => cur.parentElement.classList.remove('shakeit'), 500);
          hint.textContent = err.message === 'invalid-password' ? 'Your current password is incorrect.' : 'Could not update the master password.';
        }
      });
    });
  };

  /* ------------------------- import sheet ------------------------- */

  AV.views.openImportSheet = async function openImportSheet() {
    let picked;
    try {
      picked = await AV.api.importPick();
    } catch { picked = null; }
    if (!picked) return;

    AV.openSheet((sheet) => {
      sheet.innerHTML = `
        <div class="sheet-grab"></div>
        <div class="sheet-head">
          <button class="btn-text sheet-cancel">Cancel</button>
          <div class="sheet-title">Import Backup</div>
          <button class="btn-text sheet-save">Import</button>
        </div>
        <div class="sheet-body">
          <div class="field-group">
            <div class="in-row">
              <label class="in-label" for="i-pw">Password</label>
              <input id="i-pw" type="password" placeholder="Master password of the backup" autocomplete="off" />
            </div>
          </div>
          <div class="set-note">Enter the master password this backup was encrypted with. Existing items are kept — duplicates are skipped.</div>
        </div>`;
      const pw = sheet.querySelector('#i-pw');
      const err = () => {
        pw.parentElement.classList.add('shakeit');
        setTimeout(() => pw.parentElement.classList.remove('shakeit'), 500);
      };
      sheet.querySelector('.sheet-cancel').addEventListener('click', () => AV.closeSheet());
      sheet.querySelector('.sheet-save').addEventListener('click', async () => {
        try {
          const added = await AV.api.importWithPassword(pw.value, picked.blob);
          AV.closeSheet();
          await AV.reloadItems();
          AV.go({ name: 'home' }, { dir: 'fade' });
          AV.toast(`Imported ${added} item${added === 1 ? '' : 's'} from backup`, { icon: 'check', type: 'ok' });
        } catch (e) {
          if (e && e.message === 'invalid-password') err();
          else { AV.closeSheet(); AV.toast('That file is not a valid AuraVault backup', { icon: 'alert', type: 'warn' }); }
        }
      });
      setTimeout(() => pw.focus(), 120);
    });
  };

  /* ============================== TRASH ============================== */

  AV.views.renderTrash = function renderTrash() {
    const root = AV.$('#trashScroll');
    root.replaceChildren();
    const inner = AV.el('<div class="page-inner"></div>');
    const items = state().items.filter((x) => x.deletedAt);

    const head = AV.el(`<div class="trash-head">
        <h1 class="big-title">Recently Deleted</h1>
        ${items.length ? '<button class="btn-text danger" id="emptyTrash">Empty Trash</button>' : ''}
      </div>`);
    if (items.length) {
      head.querySelector('#emptyTrash').addEventListener('click', async () => {
        const ok = await AV.confirmAction({
          title: 'Empty the trash?',
          message: `${items.length} item${items.length === 1 ? '' : 's'} will be permanently destroyed. This cannot be undone.`,
          confirmText: 'Delete Forever',
        });
        if (!ok) return;
        const n = await AV.api.emptyTrash();
        await AV.reloadItems();
        AV.views.renderTrash();
        AV.toast(`Permanently deleted ${n} item${n === 1 ? '' : 's'}`, { icon: 'trash', type: 'warn' });
      });
    }
    inner.appendChild(head);

    if (!items.length) {
      const empty = AV.el(`<div class="empty">
          <div class="empty-art">${AV.emptyArt}</div>
          <div class="empty-title">Trash is empty</div>
          <div class="empty-sub">Items you delete rest here for 30 days before disappearing forever.</div>
        </div>`);
      inner.appendChild(empty);
    } else {
      const g = AV.el('<div class="group"></div>');
      items.forEach((it, i) => {
        const row = AV.el(`<div class="row" tabindex="0">
            <div class="row-icon ic-${it.color % 12}" ></div>
            <div class="row-main">
              <div class="row-title"></div>
              <div class="row-sub"></div>
            </div>
            <div class="row-trail">
              <button class="icon-btn restore-btn" aria-label="Restore">${AV.icon('restore', 17)}</button>
              <button class="icon-btn del-forever-btn" aria-label="Delete forever">${AV.icon('trash', 17)}</button>
            </div>
          </div>`);
        row.style.setProperty('--i', Math.min(i, 14));
        applyIcon(row.querySelector('.row-icon'), it);
        row.querySelector('.row-title').textContent = it.title || 'Untitled';
        row.querySelector('.row-sub').textContent = `Deleted ${AV.fmtDate(it.deletedAt)} · ${TYPE_LABEL[it.type]}`;
        row.querySelector('.restore-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          const restored = await AV.api.restoreItem(it.id);
          if (restored) {
            Object.assign(it, restored);
            AV.updateCounts();
            row.parentElement.classList.add('removing');
            setTimeout(() => AV.views.renderTrash(), 380);
            AV.toast(`“${it.title}” restored to your vault`, { icon: 'restore', type: 'ok' });
          }
        });
        row.querySelector('.del-forever-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await AV.confirmAction({
            title: `Delete “${it.title}” forever?`,
            message: 'This cannot be undone.',
            confirmText: 'Delete Forever',
          });
          if (!ok) return;
          await AV.api.deleteItemForever(it.id);
          await AV.reloadItems();
          AV.views.renderTrash();
          AV.toast('Deleted permanently', { icon: 'trash', type: 'warn' });
        });
        g.appendChild(row);
      });
      inner.appendChild(g);
    }
    root.appendChild(inner);
  };

  /* ========================= ADD / EDIT SHEET ========================= */

  AV.views.openItemSheet = function openItemSheet(existing, opts = {}) {
    const st = state();
    const it = existing ? Object.assign({}, existing) : {
      id: null,
      type: ['login', 'card', 'note'].includes(opts.type) ? opts.type : 'login',
      title: '', username: '', password: opts.password || '', url: '', notes: '',
      cardNumber: '', cardHolder: '', cardExpiry: '', cardCvv: '',
      color: Math.floor(Math.random() * 12), favorite: false,
    };

    AV.openSheet((sheet) => {
      sheet.innerHTML = `
        <div class="sheet-grab"></div>
        <div class="sheet-head">
          <button class="btn-text sheet-cancel">Cancel</button>
          <div class="sheet-title">${existing ? 'Edit Item' : 'New Item'}</div>
          <button class="btn-text sheet-save">Save</button>
        </div>
        <div class="sheet-body">
          <div class="seg sheet-type">
            <button data-v="login">Login</button>
            <button data-v="card">Card</button>
            <button data-v="note">Note</button>
          </div>
          <div class="field-group">
            <div class="in-row">
              <label class="in-label" for="f-title">Title</label>
              <input id="f-title" placeholder="${it.type === 'card' ? 'e.g. HDFC Visa' : it.type === 'note' ? 'e.g. Home Wi-Fi' : 'e.g. GitHub'}" maxlength="90" autocomplete="off" />
            </div>
            <div class="in-row">
              <label class="in-label">Icon</label>
              <div class="swatches"></div>
            </div>
          </div>
          <div class="field-group f-login">
            <div class="in-row">
              <label class="in-label" for="f-user">Username</label>
              <input id="f-user" autocomplete="off" spellcheck="false" />
            </div>
            <div class="in-row">
              <label class="in-label" for="f-pass">Password</label>
              <input id="f-pass" type="password" autocomplete="off" spellcheck="false" />
              <button class="icon-btn in-act p-eye" aria-label="Show password">${AV.icon('eye', 15)}</button>
              <button class="icon-btn in-act p-gen" aria-label="Generate password" title="Generate">${AV.icon('zap', 15)}</button>
            </div>
            <div class="mini-meter"><div class="meter"><i></i></div><div class="mini-hint"></div></div>
            <div class="in-row">
              <label class="in-label" for="f-url">Website</label>
              <input id="f-url" placeholder="https://…" spellcheck="false" />
            </div>
          </div>
          <div class="field-group f-card" hidden>
            <div class="in-row">
              <label class="in-label" for="f-num">Number</label>
              <input id="f-num" inputmode="numeric" placeholder="1234 5678 9012 3456" maxlength="23" autocomplete="off" />
            </div>
            <div class="in-row">
              <label class="in-label" for="f-hold">Cardholder</label>
              <input id="f-hold" maxlength="60" autocomplete="off" />
            </div>
            <div class="in-row">
              <label class="in-label" for="f-exp">Expires</label>
              <input id="f-exp" placeholder="MM/YY" maxlength="5" inputmode="numeric" autocomplete="off" />
            </div>
            <div class="in-row">
              <label class="in-label" for="f-cvv">CVV</label>
              <input id="f-cvv" maxlength="4" inputmode="numeric" type="password" autocomplete="off" />
            </div>
          </div>
          <div class="field-group">
            <div class="in-row notes">
              <label class="in-label" for="f-notes">Notes</label>
              <textarea id="f-notes" placeholder="Anything else worth remembering…"></textarea>
            </div>
          </div>
        </div>`;

      const $ = (sel) => sheet.querySelector(sel);
      const title = $('#f-title'), user = $('#f-user'), pass = $('#f-pass'), url = $('#f-url');
      const num = $('#f-num'), hold = $('#f-hold'), exp = $('#f-exp'), cvv = $('#f-cvv');
      const notes = $('#f-notes');

      title.value = it.title; user.value = it.username; pass.value = it.password;
      url.value = it.url; num.value = it.cardNumber; hold.value = it.cardHolder;
      exp.value = it.cardExpiry; cvv.value = it.cardCvv; notes.value = it.notes;

      /* type segment */
      let type = it.type;
      const syncType = () => {
        sheet.querySelector('.f-login').hidden = type === 'note';
        sheet.querySelector('.f-card').hidden = type !== 'card';
        sheet.querySelector('.mini-meter').hidden = type !== 'login';
        title.placeholder = type === 'card' ? 'e.g. HDFC Visa' : type === 'note' ? 'e.g. Home Wi-Fi' : 'e.g. GitHub';
      };
      AV.initSeg(sheet.querySelector('.sheet-type'), type, (v) => { type = v; syncType(); });
      syncType();

      /* color swatches */
      const swatches = sheet.querySelector('.swatches');
      for (let c = 0; c < 12; c++) {
        const b = AV.el(`<button class="sw ic-${c}" aria-label="Icon color ${c + 1}"></button>`);
        if (c === it.color) b.classList.add('on');
        b.addEventListener('click', () => {
          it.color = c;
          swatches.querySelectorAll('.sw').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
        });
        swatches.appendChild(b);
      }

      /* password helpers */
      const meter = sheet.querySelector('.mini-meter .meter');
      const hint = sheet.querySelector('.mini-hint');
      const paintMeter = () => {
        const s = AV.strength(pass.value);
        AV.setMeter(meter, s.score);
        hint.textContent = pass.value ? `${s.label} · ${s.bits} bits` : '';
      };
      pass.addEventListener('input', paintMeter);
      paintMeter();
      sheet.querySelector('.p-eye').addEventListener('click', () => {
        const showing = pass.type === 'text';
        pass.type = showing ? 'password' : 'text';
        sheet.querySelector('.p-eye').innerHTML = AV.icon(showing ? 'eye' : 'eye-off', 15);
      });
      sheet.querySelector('.p-gen').addEventListener('click', async () => {
        pass.value = await AV.api.generatePassword(st.gen);
        pass.type = 'text';
        sheet.querySelector('.p-eye').innerHTML = AV.icon('eye-off', 15);
        paintMeter();
      });

      /* card input formatting */
      num.addEventListener('input', () => {
        const d = num.value.replace(/\D/g, '').slice(0, 19);
        num.value = d.replace(/(.{4})/g, '$1 ').trim();
      });
      exp.addEventListener('input', () => {
        const d = exp.value.replace(/\D/g, '').slice(0, 4);
        exp.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
      });
      cvv.addEventListener('input', () => {
        cvv.value = cvv.value.replace(/\D/g, '').slice(0, 4);
      });

      sheet.querySelector('.sheet-cancel').addEventListener('click', () => AV.closeSheet());

      sheet.querySelector('.sheet-save').addEventListener('click', async () => {
        if (!title.value.trim()) {
          title.parentElement.classList.add('shakeit');
          setTimeout(() => title.parentElement.classList.remove('shakeit'), 500);
          title.focus();
          return;
        }
        const payload = Object.assign({}, it, {
          type,
          title: title.value.trim(),
          username: user.value.trim(),
          password: pass.value,
          url: url.value.trim(),
          notes: notes.value,
          cardNumber: num.value,
          cardHolder: hold.value.trim(),
          cardExpiry: exp.value.trim(),
          cardCvv: cvv.value,
        });
        const saved = await AV.api.upsertItem(payload);
        const ix = st.items.findIndex((x) => x.id === saved.id);
        if (ix >= 0) st.items[ix] = saved; else st.items.push(saved);
        AV.updateCounts();

        AV.closeSheet();
        if (state().route.name === 'home') {
          AV.views.renderHome();
          const w = document.querySelector(`#homeList .row-wrap[data-id="${saved.id}"]`);
          if (w) w.classList.add('adding');
        }
        if (state().route.name === 'detail' && state().route.id === saved.id) {
          AV.views.renderDetail(saved.id);
        }
        AV.toast(existing ? 'Item updated' : 'Added to your vault', { icon: existing ? 'check' : 'plus', type: 'ok' });
      });
    });
  };

  /* ========================= SECURITY CHECKUP ========================= */

  /* Audits live logins: weak passwords, passwords reused across accounts,
   * and items not updated in over a year. Purely local, nothing leaves
   * the vault. */
  AV.securityFindings = function securityFindings() {
    const logins = state().items.filter((x) => !x.deletedAt && x.type === 'login' && x.password);
    const weak = logins.filter((x) => AV.strength(x.password).score <= 1);

    const byPw = new Map();
    for (const it of logins) {
      const list = byPw.get(it.password) || [];
      list.push(it);
      byPw.set(it.password, list);
    }
    const reused = [];
    for (const list of byPw.values()) if (list.length > 1) reused.push(...list);

    const yearAgo = Date.now() - 365 * 86400000;
    const old = logins.filter((x) => new Date(x.updatedAt || x.createdAt).getTime() < yearAgo);

    const total = new Set([...weak, ...reused, ...old].map((x) => x.id)).size;
    return { weak, reused, old, total };
  };

  AV.views.renderSecurity = function renderSecurity() {
    const root = AV.$('#secScroll');
    root.replaceChildren();
    const inner = AV.el('<div class="page-inner"></div>');
    inner.appendChild(AV.el('<div class="ph-row"><h1 class="big-title">Security Checkup</h1></div>'));

    const f = AV.securityFindings();
    const score = Math.max(0, 100 - f.weak.length * 15 - f.reused.length * 10 - f.old.length * 5);
    const band = score >= 85 ? 4 : score >= 65 ? 3 : score >= 45 ? 2 : score >= 25 ? 1 : 0;
    const bandLabel = ['Critical', 'Needs attention', 'Fair', 'Good', 'Excellent'][band];

    /* health hero */
    const hero = AV.el(`<div class="group sec-hero">
        <div class="sec-score-row">
          <div class="sec-score"><b></b><span>/ 100</span></div>
          <div class="sec-score-side">
            <div class="sec-band"></div>
            <div class="sec-band-sub"></div>
          </div>
        </div>
        <div class="meter s${band}"><i></i></div>
      </div>`);
    hero.querySelector('.sec-score b').textContent = score;
    hero.querySelector('.sec-band').textContent = `${bandLabel} vault health`;
    hero.querySelector('.sec-band-sub').textContent = f.total
      ? `${f.total} item${f.total === 1 ? '' : 's'} need${f.total === 1 ? 's' : ''} attention`
      : 'No issues found — keep it up';
    AV.setMeter(hero.querySelector('.meter'), band);
    hero.querySelector('.meter i').style.width = `${Math.max(score, 4)}%`;
    inner.appendChild(hero);

    const findingRow = (it, sub, tone) => {
      const wrap = AV.el(`<div class="row-wrap" data-id="${it.id}"></div>`);
      const row = AV.el(`<div class="row" tabindex="0" role="button">
          <div class="row-icon ic-${it.color % 12}"></div>
          <div class="row-main">
            <div class="row-title"></div>
            <div class="row-sub ${tone}"></div>
          </div>
          <div class="row-trail"><span class="chev">${AV.icon('chevron-right', 15)}</span></div>
        </div>`);
      applyIcon(row.querySelector('.row-icon'), it);
      row.querySelector('.row-title').textContent = it.title || 'Untitled';
      row.querySelector('.row-sub').textContent = sub;
      row.addEventListener('click', () => AV.go({ name: 'detail', id: it.id }));
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') AV.go({ name: 'detail', id: it.id }); });
      wrap.appendChild(row);
      return wrap;
    };

    const section = (label, items, subFn, tone) => {
      const g = AV.el('<div class="list-group"></div>');
      const t = AV.el('<div class="group-title"></div>');
      t.textContent = label;
      g.appendChild(t);
      const body = AV.el('<div class="group"></div>');
      if (!items.length) {
        body.appendChild(AV.el(`<div class="row allclear">
            <div class="row-icon ok-ic">${AV.icon('check', 18)}</div>
            <div class="row-main"><div class="row-title">All good</div></div>
          </div>`));
      } else {
        items.forEach((it) => body.appendChild(findingRow(it, subFn(it), tone)));
      }
      g.appendChild(body);
      return g;
    };

    inner.appendChild(section('Weak passwords', f.weak,
      (it) => `${AV.strength(it.password).label} · ${AV.strength(it.password).bits} bits`, 'warn'));
    inner.appendChild(section('Reused across accounts', f.reused,
      (it) => `Same password used on ${f.reused.filter((x) => x.password === it.password).length} accounts`, 'warn'));
    inner.appendChild(section('Not updated in over a year', f.old,
      () => `Last changed ${AV.fmtDate(it.updatedAt || it.createdAt)}`, ''));

    const tip = AV.el('<div class="set-note">AuraVault checks strength locally — the generator (Tools → Generator) can replace weak passwords in one click.</div>');
    inner.appendChild(tip);

    root.appendChild(inner);
  };

  /* ========================== LOCK SCREEN ========================== */

  AV.views.showLock = function showLock() {
    const layer = AV.$('#lockLayer');
    layer.classList.remove('closing');
    layer.hidden = false;
    layer.replaceChildren();

    const demo = AV.api.mode === 'demo' && !AV.isGallery();
    const card = AV.el(`<div class="lock-card">
        <img class="lock-logo" src="assets/logo.svg" alt="AuraVault" />
        <div class="lock-title">AuraVault</div>
        <div class="lock-sub">Enter your master password to unlock your vault.</div>
        <div class="lock-form">
          <div class="lock-input-wrap" id="lockWrap">
            ${AV.icon('lock', 17)}
            <input id="lockInput" type="password" placeholder="Master password" autocomplete="off" />
            <button class="lock-peek" aria-label="Show password">${AV.icon('eye', 16)}</button>
          </div>
          <div class="lock-err"></div>
          <button class="btn btn-primary unlock-btn">Unlock</button>
        </div>
        ${demo ? '<div class="lock-hint">Demo vault — password: <code>demo1234</code></div>' : ''}
      </div>`);
    layer.appendChild(card);

    const input = card.querySelector('#lockInput');
    const errEl = card.querySelector('.lock-err');
    const btn = card.querySelector('.unlock-btn');
    const wrap = card.querySelector('#lockWrap');

    const shake = () => {
      wrap.classList.remove('shakeit'); void wrap.offsetWidth; wrap.classList.add('shakeit');
      errEl.textContent = 'That password doesn’t match this vault.';
    };

    const submit = async () => {
      const pw = input.value;
      if (!pw) { shake(); return; }
      btn.disabled = true;
      btn.textContent = 'Unlocking…';
      try {
        await AV.api.unlock(pw);
      } catch {
        btn.disabled = false;
        btn.textContent = 'Unlock';
        shake();
        input.select();
        return;
      }
      await AV.afterUnlock();
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    card.querySelector('.lock-peek').addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      card.querySelector('.lock-peek').innerHTML = AV.icon(showing ? 'eye' : 'eye-off', 16);
    });
    setTimeout(() => input.focus(), 200);
  };

  AV.hideLock = function hideLock() {
    const layer = AV.$('#lockLayer');
    if (layer.hidden) return;
    layer.classList.add('closing');
    setTimeout(() => {
      layer.hidden = true;
      layer.classList.remove('closing');
      layer.replaceChildren();
    }, 420);
  };

  /* ========================= FIRST-RUN SETUP ========================= */

  AV.views.showSetup = function showSetup() {
    const layer = AV.$('#lockLayer');
    layer.classList.remove('closing');
    layer.hidden = false;
    layer.replaceChildren();

    const card = AV.el(`<div class="lock-card wiz">
        <div class="wiz-step on" id="wiz1">
          <img class="lock-logo" src="assets/logo.svg" alt="AuraVault" />
          <div class="lock-title">Welcome to AuraVault</div>
          <div class="lock-sub">A private, beautifully simple home for every password, card and secret note — encrypted on this PC with AES-256.</div>
          <button class="btn btn-primary" id="setupNext">Create My Vault</button>
          <div class="lock-note">No account. No cloud. No tracking.<br/>Your master password is the only key — if you forget it, no one can recover it.</div>
        </div>
        <div class="wiz-step" id="wiz2">
          <div class="lock-title" >Choose a master password</div>
          <div class="lock-sub">This single password unlocks everything. Make it long and unique.</div>
          <div class="lock-form">
            <div class="lock-input-wrap" id="swMaster">
              ${AV.icon('lock', 17)}
              <input id="setupMaster" type="password" placeholder="Master password" autocomplete="off" />
              <button class="lock-peek" id="peek1" aria-label="Show password">${AV.icon('eye', 16)}</button>
            </div>
            <div class="lock-input-wrap" id="swConfirm">
              ${AV.icon('shield', 17)}
              <input id="setupConfirm" type="password" placeholder="Repeat password" autocomplete="off" />
              <button class="lock-peek" id="peek2" aria-label="Show password">${AV.icon('eye', 16)}</button>
            </div>
            <div class="wiz-meter"><div class="meter"><i></i></div></div>
            <div class="wiz-checks">
              <span class="chip" data-chk="len">${AV.icon('check', 11)}8+ characters</span>
              <span class="chip" data-chk="num">${AV.icon('check', 11)}a number</span>
              <span class="chip" data-chk="sym">${AV.icon('check', 11)}a symbol</span>
              <span class="chip" data-chk="case">${AV.icon('check', 11)}upper &amp; lowercase</span>
            </div>
            <div class="lock-err" id="setupErr"></div>
            <button class="btn btn-primary" id="setupCreate">Create Vault</button>
            <button class="btn-text wiz-back" id="setupBack">‹ Back</button>
          </div>
        </div>
      </div>`);
    layer.appendChild(card);

    const step1 = card.querySelector('#wiz1');
    const step2 = card.querySelector('#wiz2');
    const master = card.querySelector('#setupMaster');
    const confirm = card.querySelector('#setupConfirm');
    const err = card.querySelector('#setupErr');
    const meter = card.querySelector('.wiz-meter .meter');

    const shake = (el) => {
      el.classList.remove('shakeit'); void el.offsetWidth; el.classList.add('shakeit');
    };

    card.querySelector('#setupNext').addEventListener('click', () => {
      step1.classList.remove('on');
      step2.classList.add('on');
      setTimeout(() => master.focus(), 200);
    });
    card.querySelector('#setupBack').addEventListener('click', () => {
      step2.classList.remove('on');
      step2.classList.add('back');
      step1.classList.add('on');
      setTimeout(() => step2.classList.remove('back'), 500);
    });

    const liveCheck = () => {
      const v = master.value;
      const set = (k, ok) => card.querySelector(`[data-chk="${k}"]`).classList.toggle('ok', ok);
      set('len', v.length >= 8);
      set('num', /\d/.test(v));
      set('sym', /[^A-Za-z0-9]/.test(v));
      set('case', /[a-z]/.test(v) && /[A-Z]/.test(v));
      AV.setMeter(meter, AV.strength(v).score);
      err.textContent = '';
    };
    master.addEventListener('input', liveCheck);

    for (const [btnId, input] of [['#peek1', master], ['#peek2', confirm]]) {
      card.querySelector(btnId).addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        card.querySelector(btnId).innerHTML = AV.icon(showing ? 'eye' : 'eye-off', 16);
      });
    }

    const create = async () => {
      const pw = master.value;
      if (pw.length < 8) { shake(card.querySelector('#swMaster')); err.textContent = 'Use at least 8 characters.'; return; }
      if (pw !== confirm.value) { shake(card.querySelector('#swConfirm')); err.textContent = 'The passwords don’t match.'; return; }
      const btn = card.querySelector('#setupCreate');
      btn.disabled = true;
      btn.textContent = 'Creating…';
      try {
        await AV.api.createVault(pw);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Create Vault';
        err.textContent = 'Could not create the vault.';
        return;
      }
      await AV.afterUnlock(true);
      AV.toast('Vault created — welcome to AuraVault', { icon: 'shield', type: 'ok', duration: 3600 });
    };
    card.querySelector('#setupCreate').addEventListener('click', create);
    confirm.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    master.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm.focus(); });
  };
})();
