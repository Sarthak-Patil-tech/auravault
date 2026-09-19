/* AuraVault — shared utilities: DOM helpers, icon set, toasts, heuristics. */
'use strict';

window.AV = window.AV || {};

/* ---------- DOM helpers ---------- */

AV.$ = (sel, root) => (root || document).querySelector(sel);
AV.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

AV.el = function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

AV.esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

AV.debounce = function debounce(fn, ms) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
};

/* ---------- icon set (feather-style line icons, 24×24) ---------- */

AV.Icons = {
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/>',
  star: '<path d="M12 2.6l3.08 6.24 6.9 1-5 4.87 1.18 6.87L12 18.36l-6.16 3.24L7.02 14.7l-5-4.87 6.9-1z"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  card: '<rect x="1.5" y="4.5" width="21" height="15" rx="3"/><path d="M1.5 10h21"/>',
  note: '<path d="M14 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5z"/><path d="M14 2.5v6h6"/><path d="M16 13.5H8"/><path d="M16 17.5H8"/>',
  zap: '<path d="M13 2.5L3.5 14h9l-1 7.5L21 10h-9l1-7.5z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  lock: '<rect x="3.5" y="11" width="17" height="10.5" rx="2.5"/><path d="M7.5 11V7a4.5 4.5 0 0 1 9 0v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'chevron-right': '<path d="M9 18l6-6-6-6"/>',
  'chevron-left': '<path d="M15 18l-6-6 6-6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2.5"/><path d="M5 15H4.5a2.5 2.5 0 0 1-2.5-2.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  eye: '<path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7-10.5-7-10.5-7z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7-10.5-7-10.5-7z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  restore: '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  person: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
};

AV.icon = function icon(name, size = 18, filled = false) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${filled ? 'currentColor' : 'none'}" stroke="${filled ? 'none' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AV.Icons[name] || ''}</svg>`;
};

/* ---------- empty-state illustration ---------- */

AV.emptyArt = `
<svg viewBox="0 0 120 120" width="108" height="108" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="eag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a84ff"/><stop offset="1" stop-color="#5e5ce6"/>
    </linearGradient>
  </defs>
  <rect x="18" y="10" width="84" height="84" rx="24" fill="url(#eag)" opacity="0.16"/>
  <rect x="18" y="10" width="84" height="84" rx="24" stroke="url(#eag)" stroke-width="1.6" stroke-dasharray="5 6" opacity="0.7"/>
  <path d="M60 30l21 7.6v14.8c0 13.6-8.6 24-21 27.6-12.4-3.6-21-14-21-27.6V37.6z" fill="url(#eag)"/>
  <circle cx="60" cy="52" r="5" fill="#fff"/>
  <path d="M57.5 56h5l2 13h-9z" fill="#fff"/>
  <path d="M92 82l4.5 4.5M96.5 82L92 86.5" stroke="#0a84ff" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M25 96l3 3M28 96l-3 3" stroke="#5e5ce6" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
</svg>`;

/* ---------- strength heuristics ---------- */

AV.strength = function strength(pw) {
  if (!pw) return { score: 0, bits: 0, label: 'No password' };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  const bits = Math.round(pw.length * Math.log2(pool || 1));
  let score = 0;
  if (bits >= 36) score = 1;
  if (bits >= 60) score = 2;
  if (bits >= 83) score = 3;
  if (bits >= 110) score = 4;
  return { score, bits, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][score] };
};

AV.crackTime = function crackTime(bits) {
  // offline attack, ~10 billion guesses/second
  const secs = Math.pow(2, bits - 1) / 1e10;
  if (!isFinite(secs)) return 'eternities';
  if (secs < 1) return 'instantly';
  const units = [['year', 31557600], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [name, s] of units) {
    if (secs >= s) {
      const v = secs / s;
      if (name === 'year' && v > 1e6) return 'millions of years';
      const rounded = v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString();
      return `${rounded} ${name}${v >= 1.95 ? 's' : ''}`;
    }
  }
  return 'a moment';
};

/* ---------- formatting ---------- */

AV.fmtDate = function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};

AV.initial = (title) => {
  const t = String(title || '').trim();
  return t ? t[0].toUpperCase() : '•';
};

AV.cardTail = (num) => {
  const digits = String(num || '').replace(/\D/g, '');
  return digits ? `•••• ${digits.slice(-4)}` : '—';
};

/* ---------- toasts ---------- */

AV.toast = function toast(msg, opts = {}) {
  const { icon = 'check', type = 'ok', action, onAction, duration = 2800 } = opts;
  const wrap = AV.$('#toasts');
  if (!wrap) return () => {};
  const t = AV.el(`<div class="toast" role="status">
      <span class="toast-ic ${type}">${AV.icon(icon, 13)}</span>
      <span class="toast-msg"></span>
      ${action ? '<button class="toast-act"></button>' : ''}
    </div>`);
  t.querySelector('.toast-msg').textContent = msg;
  let gone = false;
  const dismiss = () => {
    if (gone || !t.isConnected) return;
    gone = true;
    t.classList.add('hide');
    setTimeout(() => t.remove(), 300);
  };
  if (action) {
    const b = t.querySelector('.toast-act');
    b.textContent = action;
    b.addEventListener('click', (e) => { e.stopPropagation(); dismiss(); onAction && onAction(); });
  }
  t.addEventListener('click', (e) => { if (!e.target.closest('.toast-act')) dismiss(); });
  wrap.appendChild(t);
  while (wrap.children.length > 3) wrap.firstElementChild.remove();
  setTimeout(dismiss, duration);
  return dismiss;
};

/* ---------- shared copy helper ---------- */

AV.copy = async function copy(text, label = 'Copied to clipboard') {
  if (!text) return;
  try {
    await AV.api.copy(text);
    const secs = Number(AV.state.settings.clipboardClearSeconds) || 0;
    AV.toast(secs > 0 ? `${label} · clears in ${secs}s` : label, { icon: 'copy', type: 'info' });
  } catch {
    AV.toast('Could not access the clipboard', { icon: 'alert', type: 'warn' });
  }
};
