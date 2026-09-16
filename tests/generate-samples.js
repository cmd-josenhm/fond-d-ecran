'use strict';
/*
 * Génère des échantillons PNG réels dans /samples (gitignoré).
 * Usage : npm run samples
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Core = require('../js/car-core.js');

const out = path.join(__dirname, '..', 'samples');
fs.mkdirSync(out, { recursive: true });

const samples = [
  { name: 'sedan-city-1920x1080', cfg: { body: 'sedan', color: '#D7263D', wheels: 'sport', logo: 'volta', scene: 'city', caption: 'ROUGE PASSION' }, w: 1920, h: 1080 },
  { name: 'coupe-neon-2560x1440', cfg: { body: 'coupe', color: '#7048E8', wheels: 'turbo', logo: 'nova', scene: 'neon', caption: 'NUIT NEON' }, w: 2560, h: 1440 },
  { name: 'suv-aurora-1920x1080', cfg: { body: 'suv', color: '#0EA5A4', wheels: 'offroad', logo: 'custom', logoLetter: 'X', badge: 'noir', scene: 'aurora' }, w: 1920, h: 1080 },
  { name: 'hatch-desert-1920x1080', cfg: { body: 'hatch', color: '#F26430', wheels: 'aero', logo: 'kairos', badge: 'car', scene: 'desert', caption: 'ROUTE 66' }, w: 1920, h: 1080 }
];

(async () => {
  for (const s of samples) {
    const svg = Core.wallpaperSVG(Core.normalizeConfig(s.cfg), 's', s.w, s.h);
    const file = path.join(out, s.name + '.png');
    await sharp(Buffer.from(svg, 'utf8')).png().toFile(file);
    const meta = await sharp(file).metadata();
    console.log('✓ ' + path.basename(file) + '  (' + meta.width + 'x' + meta.height + ', ' + (fs.statSync(file).size / 1024).toFixed(0) + ' Ko)');
  }
  console.log('\nÉchantillons générés dans ' + out);
})().catch((e) => { console.error(e); process.exit(1); });
