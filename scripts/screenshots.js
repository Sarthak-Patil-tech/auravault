'use strict';

/**
 * AuraVault — automated UI test & screenshot suite (`npm run shots`).
 *
 * Launches the real app with a throwaway profile on a virtual display
 * (xvfb-run) and drives it end-to-end through the actual DOM: first-run
 * setup → vault creation → adding an item via the sheet → seeding →
 * every page → dark mode → lock screen. Captures PNGs into shots/ and
 * writes an e2e report (any console error or failed assertion fails).
 *
 * Run:  xvfb-run -a -s "-screen 0 2560x1664x24" npx electron . --shoot
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SEED = [
  { type: 'login', title: 'Gmail', username: 'aarav.sharma@gmail.com', url: 'https://mail.google.com', password: 'mX9vT#q2LpZ8wR5nKd', favorite: true, color: 1 },
  { type: 'login', title: 'Netflix', username: 'aarav.sharma', url: 'https://netflix.com', password: 'Str0ng-Pass!here1', favorite: true, color: 7 },
  { type: 'login', title: 'HDFC NetBanking', username: 'aasharma', url: 'https://netbanking.hdfcbank.com', password: 'N0t-my-real-pw!9', notes: 'Profile password is separate — see secure note.', color: 5 },
  { type: 'login', title: 'Amazon', username: 'aarav.sharma@gmail.com', url: 'https://amazon.in', password: 'Amaz0n!Sh0p-S3cure', color: 4 },
  { type: 'login', title: 'Spotify', username: 'aarav.sharma', url: 'https://spotify.com', password: 'PlayIt-L0ud!77', color: 2 },
  { type: 'login', title: 'AWS Console', username: 'aarav-admin', url: 'https://console.aws.amazon.com', password: 'Cl0ud-Native-Key!2026', notes: 'MFA is enabled on the root account.', color: 9 },
  { type: 'login', title: 'iCloud', username: 'aarav@icloud.com', url: 'https://icloud.com', password: 'Appl3-Orchard#Green', color: 6 },
  { type: 'card', title: 'HDFC Visa Credit', cardNumber: '4514 8892 1103 6620', cardHolder: 'AARAV SHARMA', cardExpiry: '09/29', cardCvv: '384', color: 3 },
  { type: 'login', title: 'Reddit', username: 'aarav_sh', url: 'https://reddit.com', password: 'password123', color: 10 },
  { type: 'login', title: 'X (Twitter)', username: 'aarav_sh', url: 'https://x.com', password: 'PlayIt-L0ud!77', color: 3 },
  { type: 'note', title: 'Home Wi-Fi', notes: 'SSID: Sunset-Antenna\nPassword: pale-violet-disk-902\nRouter admin password is on the sticker under the router.', color: 8 },
];

module.exports.run = async function run(win) {
  const wc = win.webContents;
  const outDir = path.join(__dirname, '..', 'shots');
  fs.mkdirSync(outDir, { recursive: true });

  const errors = [];
  wc.on('console-message', (...a) => {
    // tolerate both positional and object signatures across Electron versions
    const obj = a.find((x) => x && typeof x === 'object' && 'level' in x);
    const level = obj ? obj.level : a[1];
    const message = obj ? obj.message : a[3] || a[2] || a[1];
    if (level >= 2) errors.push(String(message));
  });
  wc.on('render-process-gone', () => errors.push('renderer crashed'));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const display = process.env.DISPLAY || ':99';

  // Capture straight from the X server — robust under software GL, and it
  // captures exactly what a user would see on screen.
  const shot = async (name) => {
    await sleep(420);
    try {
      execSync(`import -window root -display ${display} "${path.join(outDir, name)}.png"`, {
        stdio: 'ignore',
        timeout: 20000,
      });
      console.log('[shots] saved', name);
    } catch {
      errors.push(`screenshot failed: ${name}`);
      console.error('[shots] screenshot FAILED:', name);
    }
  };

  const js = (code) => wc.executeJavaScript(code);
  const check = (cond, msg) => {
    if (!cond) {
      errors.push(`ASSERT: ${msg}`);
      console.error('[shots] ASSERT FAIL:', msg);
    }
  };

  try { win.setBounds({ x: 0, y: 0, width: 1280, height: 832 }); } catch (e) { console.log('[shots] setBounds threw:', e.message); }
  console.log('[shots] suite starting');
  await sleep(900);
  try { console.log('[shots] probe readyState:', await js('document.readyState')); }
  catch (e) { console.log('[shots] probe threw:', e.message); }

  /* 1 — first-run setup */
  check(await js(`!!document.querySelector('#setupNext')`), 'setup step 1 visible');
  check(await js(`getComputedStyle(document.getElementById('lockLayer')).display === 'grid'`), 'setup overlay is visually rendered');
  check(await js(`getComputedStyle(document.getElementById('app')).display === 'flex'`), 'app rendered behind setup overlay (no reveal flash)');
  await shot('01-setup');

  /* 2 — create the vault through the real flow */
  await js(`document.querySelector('#setupNext').click()`);
  await sleep(500);
  check(await js(`!!document.querySelector('#setupMaster')`), 'setup step 2 visible');
  await shot('02-master-password');
  await js(`(() => {
    const m = document.querySelector('#setupMaster'), c = document.querySelector('#setupConfirm');
    m.value = 'Corr3ct-Horse!Battery';
    m.dispatchEvent(new Event('input'));
    c.value = 'Corr3ct-Horse!Battery';
    document.querySelector('#setupCreate').click();
  })()`);
  await sleep(1300);
  check(await js(`!document.getElementById('app').hidden`), 'app revealed after vault creation');
  check(await js(`getComputedStyle(document.getElementById('app')).display === 'flex'`), 'app visually rendered after reveal');
  check(await js(`document.querySelectorAll('.empty').length > 0`), 'empty state shown');
  await shot('03-empty-vault');

  /* 3 — add an item through the real sheet UI */
  await js(`document.querySelector('#btnAdd').click()`);
  await sleep(700);
  check(await js(`!!document.querySelector('.sheet')`), 'add sheet opens');
  await shot('04-add-sheet');
  await js(`(() => {
    document.querySelector('#f-title').value = 'GitHub';
    document.querySelector('#f-user').value = 'aarav@sharma.dev';
    document.querySelector('#f-pass').value = 'T4ngy-Papaya!42';
    document.querySelector('#f-url').value = 'https://github.com';
    document.querySelector('.sheet-save').click();
  })()`);
  await sleep(1000);
  check(await js(`document.querySelectorAll('#homeList .row-wrap').length === 1`), 'one row after add');
  check(await js(`getComputedStyle(document.getElementById('sheetLayer')).display === 'none'`), 'sheet overlay fully hidden after save');
  check(await js(`document.querySelectorAll('.backdrop').length === 0`), 'backdrop removed after save');

  /* 4 — seed the rest through the real IPC path */
  await js(`window.__av.seed(${JSON.stringify(SEED)})`);
  await sleep(1100);
  check(await js(`document.querySelectorAll('#homeList .row-wrap').length === ${SEED.length + 1}`), 'all rows rendered');

  /* design sanity assertions */
  check(await js(`(() => {
    const cs = getComputedStyle(document.querySelector('.sidebar'));
    return (cs.backdropFilter || cs.webkitBackdropFilter || '').includes('blur');
  })()`), 'backdrop-filter blur active on sidebar');

  check(await js(`(() => {
    const active = document.querySelector('#sbNav .nav-item.active');
    const pill = document.querySelector('#sbPill');
    if (!active || !pill.style.transform) return false;
    const y = parseFloat(pill.style.transform.replace(/[^0-9.-]/g, ''));
    return Math.abs(active.offsetTop - 2 - y) < 3;
  })()`), 'sidebar pill aligned with active item');

  await shot('05-home');

  /* 5 — detail */
  await js(`document.querySelector('#homeList .row-wrap .row').click()`);
  await sleep(750);
  check(await js(`document.querySelector('#page-detail').classList.contains('active')`), 'detail page active');
  await shot('06-detail');

  /* 6 — generator */
  await js(`document.querySelector('[data-nav="generator"]').click()`);
  await sleep(850);
  check(await js(`((document.querySelector('#genPass') || {}).textContent || '').length >= 8`), 'password generated');
  await shot('07-generator');

  /* 7 — settings */
  await js(`document.querySelector('[data-nav="settings"]').click()`);
  await sleep(850);
  check(await js(`document.querySelectorAll('.seg').length >= 2`), 'settings segments rendered');
  await shot('08-settings');

  /* 8 — security checkup (seed contains one weak + one reused password) */
  await js(`document.querySelector('[data-nav="security"]').click()`);
  await sleep(850);
  check(await js(`document.querySelector('#page-security').classList.contains('active')`), 'security page active');
  check(await js(`document.querySelectorAll('#secScroll .row-wrap').length === 3`), 'security findings rendered (1 weak + 2 reused)');
  check(await js(`document.querySelectorAll('#secScroll .allclear').length === 1`), 'clean section shows all-clear row');
  check(await js(`(document.querySelector('[data-count="security"]') || {}).textContent === '3'`), 'security badge count');
  await shot('09-security');

  /* 9 — dark mode */
  await js(`window.__av.setTheme('dark')`);
  await js(`document.querySelector('[data-sec="all"]').click()`);
  await sleep(1100);
  await shot('10-home-dark');

  /* 9 — lock screen */
  await js(`window.__av.setTheme('light')`);
  await sleep(800);
  await js(`window.__av.lock()`);
  await sleep(1100);
  check(await js(`!document.getElementById('lockLayer').hidden`), 'lock screen shown');
  await shot('11-lock');

  /* 10 — wrong password is rejected, correct password unlocks (real crypto) */
  await js(`(() => {
    const i = document.querySelector('#lockInput');
    i.value = 'definitely-wrong-password';
    document.querySelector('.unlock-btn').click();
  })()`);
  await sleep(1000);
  check(await js(`!document.getElementById('lockLayer').hidden`), 'wrong password keeps the vault locked');
  await shot('12-lock-error');
  await js(`(() => {
    const i = document.querySelector('#lockInput');
    i.value = 'Corr3ct-Horse!Battery';
    document.querySelector('.unlock-btn').click();
  })()`);
  await sleep(1500);
  check(await js(`document.getElementById('lockLayer').hidden`), 'correct password unlocks the vault');
  check(await js(`getComputedStyle(document.getElementById('lockLayer')).display === 'none'`), 'lock overlay fully hidden after unlock (no stuck blur)');
  check(await js(`document.querySelectorAll('#homeList .row-wrap').length === ${SEED.length + 1}`), 'items restored after unlock');
  console.log('[shots] diag:', await js(`JSON.stringify({
    hidden: document.getElementById('lockLayer').hidden,
    err: (document.querySelector('.lock-err') || {}).textContent,
    btn: (document.querySelector('.unlock-btn') || {}).textContent,
    disabled: (document.querySelector('.unlock-btn') || {}).disabled,
  })`));
  await shot('13-home-after-unlock');

  const report = { ok: errors.length === 0, errors, at: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, 'e2e-report.json'), JSON.stringify(report, null, 2));
  console.log('[shots] done —', errors.length ? `ERRORS:\n${errors.join('\n')}` : 'all assertions passed');
};
