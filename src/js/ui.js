/* AuraVault — UI primitives: modal sheets, action sheets, segmented
 * controls, the sliding sidebar pill, and page transition helpers.
 */
'use strict';

(function () {

  /* ---------- modal sheet ---------- */

  AV.openSheet = function openSheet(build) {
    const layer = AV.$('#sheetLayer');
    layer.hidden = false;
    const backdrop = AV.el('<div class="backdrop"></div>');
    const sheet = AV.el('<div class="sheet" role="dialog" aria-modal="true"></div>');
    layer.replaceChildren(backdrop, sheet);
    build(sheet);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      backdrop.classList.add('closing');
      sheet.classList.add('closing');
      setTimeout(() => { layer.hidden = true; layer.replaceChildren(); }, 320);
    };

    backdrop.addEventListener('click', close);
    AV._activeSheet = { close, el: sheet };

    const first = sheet.querySelector('input, textarea, button');
    if (first) setTimeout(() => first.focus(), 80);
    return { close, el: sheet };
  };

  AV.closeSheet = function closeSheet() {
    if (AV._activeSheet) AV._activeSheet.close();
  };

  /* ---------- action sheet (iOS-style confirm) ---------- */

  AV.confirmAction = function confirmAction({ title, message, confirmText = 'Delete', cancelText = 'Cancel' }) {
    return new Promise((resolve) => {
      const layer = AV.$('#actionLayer');
      layer.hidden = false;
      const backdrop = AV.el('<div class="backdrop"></div>');
      const card = AV.el(`<div class="action-card" role="alertdialog" aria-modal="true">
          <div class="action-msg">
            <div class="action-title"></div>
            ${message ? '<div class="action-sub"></div>' : ''}
          </div>
          <div class="action-btns"></div>
        </div>`);
      card.querySelector('.action-title').textContent = title;
      if (message) card.querySelector('.action-sub').textContent = message;

      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        backdrop.classList.add('closing');
        card.classList.add('closing');
        setTimeout(() => { layer.hidden = true; layer.replaceChildren(); }, 280);
        resolve(v);
      };

      const confirmBtn = AV.el('<button class="action-btn danger"></button>');
      confirmBtn.textContent = confirmText;
      confirmBtn.addEventListener('click', () => done(true));
      const cancelBtn = AV.el('<button class="action-btn"></button>');
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener('click', () => done(false));
      card.querySelector('.action-btns').append(confirmBtn, cancelBtn);

      backdrop.addEventListener('click', () => done(false));
      layer.replaceChildren(backdrop, card);
      setTimeout(() => confirmBtn.focus(), 60);
    });
  };

  /* ---------- segmented control ---------- */

  AV.initSeg = function initSeg(seg, value, onChange) {
    if (!seg || seg.dataset.init) return;
    seg.dataset.init = '1';
    const thumb = AV.el('<div class="seg-thumb" aria-hidden="true"></div>');
    seg.prepend(thumb);
    const btns = AV.$$(':scope > button', seg);

    const place = () => {
      const on = seg.querySelector('button.on');
      if (!on) return;
      thumb.style.width = `${on.offsetWidth}px`;
      thumb.style.transform = `translateX(${on.offsetLeft}px)`;
    };

    btns.forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('on')) return;
      btns.forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      place();
      onChange && onChange(b.dataset.v);
    }));

    const initial = btns.find((b) => b.dataset.v === String(value)) || btns[0];
    if (initial) initial.classList.add('on');

    // place after layout settles (fonts can shift widths)
    requestAnimationFrame(place);
    setTimeout(place, 60);
    setTimeout(place, 400);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    window.addEventListener('resize', place);

    return {
      set(v) {
        const b = btns.find((x) => x.dataset.v === String(v));
        if (b && !b.classList.contains('on')) {
          btns.forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          place();
        }
      },
    };
  };

  /* ---------- switch ---------- */

  AV.makeSwitch = function makeSwitch(checked, onChange) {
    const sw = AV.el('<button class="switch" role="switch" aria-checked="false"></button>');
    const set = (v, fire = true) => {
      sw.classList.toggle('on', !!v);
      sw.setAttribute('aria-checked', String(!!v));
      if (fire && onChange) onChange(!!v);
    };
    set(checked, false);
    sw.addEventListener('click', () => set(!sw.classList.contains('on')));
    return sw;
  };

  /* ---------- sidebar pill ---------- */

  AV.movePill = function movePill(item) {
    const nav = AV.$('#sbNav');
    const pill = AV.$('#sbPill');
    if (!nav || !pill) return;
    if (!item) { pill.style.opacity = '0'; return; }
    pill.style.opacity = '1';
    pill.style.height = `${item.offsetHeight}px`;
    pill.style.transform = `translateY(${item.offsetTop - 2}px)`;
  };

  /* ---------- page transitions ---------- */

  const ENTER = ['enter-fwd', 'enter-bwd', 'enter-fade'];
  const EXIT = ['exit-fwd', 'exit-bwd', 'exit-fade'];

  AV.animatePages = function animatePages(prevEl, nextEl, dir) {
    const enterClass = dir === 'forward' ? 'enter-fwd' : dir === 'back' ? 'enter-bwd' : 'enter-fade';
    const exitClass = dir === 'forward' ? 'exit-bwd' : dir === 'back' ? 'exit-fwd' : 'exit-fade';

    const cleanup = (el) => () => ENTER.concat(EXIT).forEach((c) => el.classList.remove(c));

    if (prevEl && prevEl !== nextEl) {
      prevEl.classList.remove('active');
      prevEl.classList.add(exitClass);
      prevEl.addEventListener('animationend', cleanup(prevEl), { once: true });
      setTimeout(cleanup(prevEl), 700);
    }
    if (nextEl) {
      nextEl.classList.add('active', enterClass);
      nextEl.addEventListener('animationend', cleanup(nextEl), { once: true });
      setTimeout(() => nextEl.classList.remove(enterClass), 700);
      setTimeout(cleanup(nextEl), 700);
    }
  };

  /* ---------- strength meter helper ---------- */

  /* Fill a `.meter` element that already exists in the DOM */
  AV.setMeter = function setMeter(meterEl, score) {
    if (!meterEl) return;
    meterEl.className = `meter s${score}`;
    const bar = meterEl.querySelector('i');
    if (bar) bar.style.width = `${[8, 25, 50, 75, 100][score] || 8}%`;
  };
})();
