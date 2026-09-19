'use strict';

/**
 * AuraVault — wallpaper pipeline (`npm run wallpapers`).
 *
 * Renders the two vault wallpapers as smooth "silk" gradient compositions,
 * natively at 3200×2000 (larger than any window/background the app shows,
 * so they never get upscaled — crisp on 4K and high-DPI displays).
 *
 * Pure SVG gradients → rasterized with sharp. Deterministic and easy to
 * re-tune: edit the palettes below and re-run.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 3200;
const H = 2000;
const OUT = path.join(__dirname, '..', 'src', 'assets');

/* soft blob helper: a rotated ellipse filled with a radial gradient */
function blob({ id, color, opacity, x, y, rx, ry, angle }) {
  return {
    def: `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${color}" stop-opacity="${opacity}"/>
            <stop offset="55%" stop-color="${color}" stop-opacity="${(opacity * 0.45).toFixed(3)}"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </radialGradient>`,
    use: `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${id})" transform="rotate(${angle} ${x} ${y})"/>`,
  };
}

function wallpaper({ base, baseAngle, blobs, vignette }) {
  const defs = blobs.map((b) => b.def).join('\n    ');
  const body = blobs.map((b) => b.use).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="${baseAngle[0]}" y2="${baseAngle[1]}">
      ${base.map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}
    </linearGradient>
    ${defs}
    ${vignette ? `<radialGradient id="vig" cx="50%" cy="45%" r="75%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.35"/>
    </radialGradient>` : ''}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${body}
  ${vignette ? '<rect width="' + W + '" height="' + H + '" fill="url(#vig)"/>' : ''}
</svg>`;
}

/* ---------- light: airy pastel silk (powder blue → lavender → peach) ---------- */

const light = wallpaper({
  base: [[0, '#e9f1fc'], [0.42, '#f1eafb'], [0.75, '#f9edf3'], [1, '#fdeee3']],
  baseAngle: [1, 1],
  blobs: [
    blob({ id: 'l1', color: '#7fa8f2', opacity: 0.50, x: 640, y: 420, rx: 1500, ry: 760, angle: -20 }),
    blob({ id: 'l2', color: '#a68cf5', opacity: 0.42, x: 2350, y: 620, rx: 1400, ry: 720, angle: -14 }),
    blob({ id: 'l3', color: '#f2a98c', opacity: 0.40, x: 1750, y: 1650, rx: 1600, ry: 700, angle: -10 }),
    blob({ id: 'l4', color: '#8fd9c3', opacity: 0.30, x: 2750, y: 1500, rx: 1100, ry: 560, angle: -22 }),
    blob({ id: 'l5', color: '#f58fb4', opacity: 0.26, x: 500, y: 1500, rx: 1000, ry: 520, angle: -16 }),
    blob({ id: 'l6', color: '#ffffff', opacity: 0.55, x: 1500, y: 260, rx: 1700, ry: 520, angle: -12 }),
  ],
  vignette: false,
});

/* ---------- dark: midnight indigo with violet/electric ridges ---------- */

const dark = wallpaper({
  base: [[0, '#070a18'], [0.38, '#0d1330'], [0.72, '#161243'], [1, '#1b0f38']],
  baseAngle: [1, 1],
  blobs: [
    blob({ id: 'd1', color: '#2f56d6', opacity: 0.55, x: 700, y: 500, rx: 1500, ry: 700, angle: -18 }),
    blob({ id: 'd2', color: '#7a4df0', opacity: 0.50, x: 2450, y: 700, rx: 1450, ry: 680, angle: -12 }),
    blob({ id: 'd3', color: '#e0489b', opacity: 0.30, x: 1900, y: 1600, rx: 1500, ry: 640, angle: -8 }),
    blob({ id: 'd4', color: '#1b9be0', opacity: 0.38, x: 2850, y: 1550, rx: 1000, ry: 520, angle: -20 }),
    blob({ id: 'd5', color: '#4f46e5', opacity: 0.35, x: 350, y: 1500, rx: 1050, ry: 500, angle: -15 }),
    blob({ id: 'd6', color: '#9db5ff', opacity: 0.22, x: 1500, y: 200, rx: 1600, ry: 460, angle: -10 }),
  ],
  vignette: true,
});

async function render(name, svg) {
  const out = path.join(OUT, `wallpaper-${name}.jpg`);
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`wallpaper-${name}.jpg → ${meta.width}×${meta.height} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

(async () => {
  await render('light', light);
  await render('dark', dark);
  console.log('Done.');
})().catch((err) => { console.error(err); process.exit(1); });
