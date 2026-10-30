// Package the existing JB artwork; no redesign or runtime dependency.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('../../jb-web-frontend/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');

async function main() {
  const logo = await sharp(path.join(root, '../jb-web-frontend/public/jblogo.png')).trim().png().toBuffer();
  async function render(size, ratio, transparent = false) {
    const artwork = await sharp(logo).resize(Math.round(size * ratio), Math.round(size * ratio), { fit: 'inside' }).toBuffer();
    let icon = sharp({ create: { width: size, height: size, channels: 4, background: transparent ? '#00000000' : '#ffffff' } }).composite([{ input: artwork, gravity: 'centre' }]);
    if (!transparent) icon = icon.removeAlpha();
    return icon.png().toBuffer();
  }
  async function save(filename, buffer, size, alpha) {
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
    assert.equal(metadata.hasAlpha, alpha);
    await fs.writeFile(filename, buffer);
  }
  for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
    const dir = path.join(res, `mipmap-${density}`);
    const size = 48 * scale;
    const legacy = await render(size, 0.70);
    await save(path.join(dir, 'ic_launcher.png'), legacy, size, false);
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`);
    await save(path.join(dir, 'ic_launcher_round.png'), await sharp(legacy).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer(), size, true);
    // Keep all artwork inside the adaptive icon's central 66dp safe circle.
    const foreground = await render(108 * scale, 0.43, true);
    await save(path.join(dir, 'ic_launcher_foreground.png'), foreground, 108 * scale, true);
    const { data, info } = await sharp(foreground).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 10) {
        assert.ok(Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) <= 33 * scale, 'Artwork exceeds adaptive safe circle');
      }
    }
  }
  await save(path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), await render(1024, 0.74), 1024, false);
  console.log('Validated 15 Android icons and the opaque 1024px iOS icon. Adaptive safe areas passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
