'use strict';
/*
 * Test d'intégration : le SVG du fond d'écran est rasterisé (sharp/libvips)
 * aux dimensions demandées — prouve que la composition est un SVG valide
 * et que le rendu PNG 16:9 est générable.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Core = require('../js/car-core.js');

let sharp;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

const samplesDir = path.join(__dirname, '..', 'samples');

function run() {
  test('sharp : rasterisation du wallpaper 1920x1080', async () => {
    assert.ok(sharp, 'sharp doit être installé (npm install)');
    const cfg = Core.normalizeConfig({ body: 'sedan', scene: 'city', caption: 'AURA DRIVE' });
    const svg = Core.wallpaperSVG(cfg, 't', 1920, 1080);
    fs.mkdirSync(samplesDir, { recursive: true });
    const file = path.join(samplesDir, 'test-1920x1080.png');
    await sharp(Buffer.from(svg, 'utf8')).png().toFile(file);
    const meta = await sharp(file).metadata();
    assert.equal(meta.width, 1920);
    assert.equal(meta.height, 1080);
    assert.equal(meta.format, 'png');
    const stat = fs.statSync(file);
    assert.ok(stat.size > 50 * 1024, 'PNG non vide (>' + stat.size + ' octets)');
  });

  test('sharp : rasterisation 4K (3840x2160)', async () => {
    assert.ok(sharp, 'sharp doit être installé (npm install)');
    const cfg = Core.normalizeConfig({ body: 'suv', scene: 'aurora', color: '#2563EB' });
    const svg = Core.wallpaperSVG(cfg, 't4k', 3840, 2160);
    const file = path.join(samplesDir, 'test-3840x2160.png');
    fs.mkdirSync(samplesDir, { recursive: true });
    await sharp(Buffer.from(svg, 'utf8')).png().toFile(file);
    const meta = await sharp(file).metadata();
    assert.equal(meta.width, 3840);
    assert.equal(meta.height, 2160);
  });

  test('sharp : toutes les vues isolées sont rasterisables', async () => {
    assert.ok(sharp, 'sharp doit être installé (npm install)');
    for (const v of Core.VIEWS) {
      const svg = Core.isolatedViewSVG(Core.normalizeConfig({ body: 'coupe' }), 'tv' + v.id + '-', v.id);
      const buf = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
      const { width, height, format } = await sharp(buf).metadata();
      assert.equal(format, 'png', 'format png pour ' + v.id);
      assert.ok(width >= 800 && height >= 400, v.id + ' : dimensions raisonnables (' + width + 'x' + height + ')');
    }
  });
}

if (sharp) run();
else test('sharp absent — skip', () => assert.ok(true));
