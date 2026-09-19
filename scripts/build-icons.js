'use strict';

/**
 * AuraVault — icon pipeline.
 * Renders src/assets/logo.svg into every size the app, the installer and
 * the stores need:
 *   resources/icon.png      (512px, window/taskbar icon)
 *   resources/icon-XX.png   (16–1024, for stores & docs)
 *   resources/icon.ico      (multi-size Windows icon)
 *
 * Usage: npm run icons   (requires devDependencies: sharp, to-ico)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'src', 'assets', 'logo.svg'));

async function main() {
  fs.mkdirSync(path.join(root, 'resources'), { recursive: true });

  // render the master once at 1024, then derive every size from it
  const master = await sharp(svg, { density: 72 }).resize(1024, 1024).png().toBuffer();

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const pngs = {};
  for (const size of sizes) {
    pngs[size] = await sharp(master).resize(size, size).png().toBuffer();
    fs.writeFileSync(path.join(root, 'resources', `icon-${size}.png`), pngs[size]);
    console.log(`  icon-${size}.png`);
  }

  fs.writeFileSync(path.join(root, 'resources', 'icon.png'), pngs[512]);
  const ico = await toIco([16, 24, 32, 48, 64, 128, 256].map((s) => pngs[s]));
  fs.writeFileSync(path.join(root, 'resources', 'icon.ico'), ico);
  console.log('  icon.ico');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
