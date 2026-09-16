'use strict';
/*
 * Tests unitaires du moteur (js/car-core.js) — Node 18+ (node:test).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/car-core.js');

const P = 'test-';

/* ---------------- couleurs ---------------- */

test('mix()', () => {
  assert.equal(Core.mix('#000000', '#FFFFFF', 0), '#000000');
  assert.equal(Core.mix('#000000', '#FFFFFF', 1), '#FFFFFF');
  assert.equal(Core.mix('#000000', '#FFFFFF', 0.5), '#808080');
});

test('shade()', () => {
  assert.equal(Core.shade('#000000', 0.5), '#808080');
  assert.equal(Core.shade('#FFFFFF', -0.5), '#808080');
  assert.equal(Core.shade('#FF0000', 1), '#FFFFFF');
  assert.equal(Core.shade('#00FF00', -1), '#000000');
});

test('isLight()', () => {
  assert.ok(Core.isLight('#FFFFFF'));
  assert.ok(Core.isLight('#EEF1F4'));
  assert.ok(!Core.isLight('#23262B'));
  assert.ok(!Core.isLight('#1B2A5B'));
});

test('rgba()', () => {
  assert.equal(Core.rgba('#FF0000', 0.5), 'rgba(255,0,0,0.5)');
});

/* ---------------- config ---------------- */

test('normalizeConfig : valeurs invalides → défauts', () => {
  const c = Core.normalizeConfig({ body: 'x', color: 'bleu', wheels: 'y', logo: 'z', badge: 'q', scene: 'n', res: 'nope' });
  assert.equal(c.body, 'sedan');
  assert.equal(c.color, '#D7263D');
  assert.equal(c.wheels, 'sport');
  assert.equal(c.logo, 'volta');
  assert.equal(c.badge, 'chrome');
  assert.equal(c.scene, 'city');
  assert.equal(c.res, '1920x1080');
});

test('normalizeConfig : valeurs valides conservées', () => {
  const c = Core.normalizeConfig({ body: 'suv', color: '#abcdef', wheels: 'aero', logo: 'custom', logoLetter: 'kx', scene: 'aurora', caption: 'mon auto!!', res: '3840x2160' });
  assert.equal(c.body, 'suv');
  assert.equal(c.color, '#ABCDEF');
  assert.equal(c.wheels, 'aero');
  assert.equal(c.logoLetter, 'KX');
  assert.equal(c.scene, 'aurora');
  assert.equal(c.res, '3840x2160');
  assert.ok(c.caption.length <= 28);
});

test('normalizeConfig : custom sans lettre → M', () => {
  const c = Core.normalizeConfig({ logo: 'custom' });
  assert.equal(c.logoLetter, 'M');
});

test('encode/decode config : aller-retour', () => {
  const cfg = { body: 'coupe', color: '#7048E8', wheels: 'turbo', logo: 'custom', logoLetter: 'Z', badge: 'noir', scene: 'neon', caption: 'Z-DRIVE', res: '2560x1440' };
  const dec = Core.decodeConfig(Core.encodeConfig(cfg));
  assert.deepEqual(dec, Core.normalizeConfig(cfg));
});

test('decodeConfig : corrompu → null', () => {
  assert.equal(Core.decodeConfig('!!!pas-un-base64!!!'), null);
  assert.equal(Core.decodeConfig(''), null);
  assert.equal(Core.decodeConfig(Core.base64url ? '' : 'cHVo'), null); // "pho" invalide en JSON
});

test('resolution()', () => {
  assert.equal(Core.resolution({ res: '3840x2160' }).w, 3840);
  assert.equal(Core.resolution({ res: 'inconnu' }).w, 1920);
});

/* ---------------- rendu voiture ---------------- */

function assertSvgLike(s, label) {
  assert.ok(typeof s === 'string' && s.length > 500, label + ' : SVG attendu');
  assert.ok(!s.includes('NaN'), label + ' : aucun NaN dans le SVG');
  assert.ok(!s.includes('undefined'), label + ' : aucun "undefined" dans le SVG');
  assert.ok(!s.includes('null'), label + ' : aucune "null" dans le SVG');
}

test('vue de côté : 4 carrosseries distinctes', () => {
  const ids = ['sedan', 'coupe', 'suv', 'hatch'];
  const outs = ids.map((b) => Core.carSide(Core.normalizeConfig({ body: b }), P));
  outs.forEach((s, i) => assertSvgLike(s, 'side ' + ids[i]));
  const set = new Set(outs);
  assert.equal(set.size, 4, 'les 4 carrosseries diffèrent');
  assert.ok(outs[0].includes('<circle'), 'roues présentes');
});

test('vue de côté : badge + jantes + couleur', () => {
  const cfg = Core.normalizeConfig({ logo: 'custom', logoLetter: 'ZZ', wheels: 'aero', color: '#0EA5A4' });
  const s = Core.carSide(cfg, P);
  assert.ok(s.includes('>ZZ<'), 'lettre du logo custom');
  assert.ok(s.includes('url(#' + P + 'body)'), 'carrosserie référence le dégradé de couleur');
  // le SVG complet (defs inclus) doit contenir la couleur exacte
  const full = Core.carViewSVG(cfg, P, 'side');
  assert.ok(full.includes('#0EA5A4'), 'couleur carrosserie dans les defs');
  const s2 = Core.carSide(Core.normalizeConfig({ wheels: 'offroad' }), P);
  assert.notEqual(s.match(/rect/g).length, s2.match(/rect/g).length, 'jantes différentes');
});

test('vue de face / arrière / dessus', () => {
  assertSvgLike(Core.carFront(Core.normalizeConfig({}), P), 'front');
  assertSvgLike(Core.carRear(Core.normalizeConfig({}), P), 'rear');
  assertSvgLike(Core.carTop(Core.normalizeConfig({}), P), 'top');
  const cfg = Core.normalizeConfig({ body: 'suv', caption: 'ABC' });
  assert.ok(Core.carFront(cfg, P).includes('ABC'), 'plaque porte la légende');
  assert.ok(Core.carRear(cfg, P).includes('ABC'), 'plaque arrière porte la légende');
});

test('5 styles de jantes', () => {
  const outs = Core.WHEELS.map((w) => Core.wheelSVG(P, Core.normalizeConfig({ wheels: w.id }), 100, 100, 82));
  assert.equal(new Set(outs).size, 5);
  outs.forEach((s) => assert.ok(!s.includes('NaN'), 'jante sans NaN'));
});

test('4 formes de badge + 3 matières', () => {
  const shapes = new Set();
  for (const l of Core.LOGOS) {
    const b = Core.badgeSVG(P, Core.normalizeConfig({ logo: l.id }), 50, 50, 1);
    assert.ok(!b.includes('NaN'), 'badge ' + l.id);
    shapes.add(l.shape);
  }
  assert.ok(shapes.size >= 4, 'formes de badge variées');
  const noir = Core.badgeSVG(P, Core.normalizeConfig({ badge: 'noir' }), 50, 50, 1);
  const car = Core.badgeSVG(P, Core.normalizeConfig({ badge: 'car', color: '#16A34A' }), 50, 50, 1);
  assert.ok(noir.includes('#17191D'), 'badge noir');
  assert.ok(car.includes('#16A34A'), 'badge couleur carrosserie');
});

test('carViewSVG / isolatedViewSVG : SVG complets et valides', () => {
  for (const v of Core.VIEWS) {
    const full = Core.carViewSVG(Core.normalizeConfig({}), P + v.id + '-', v.id);
    assert.ok(full.startsWith('<svg'), v.id + ' : débute par <svg');
    assert.ok(full.endsWith('</svg>'), v.id + ' : se termine par </svg>');
    assert.ok(!full.includes('NaN'), v.id);
    const iso = Core.isolatedViewSVG(Core.normalizeConfig({}), P + 'iso' + v.id + '-', v.id);
    assert.ok(iso.includes('</svg>'), 'isolé ' + v.id);
    assert.ok(!iso.includes('NaN'), 'isolé ' + v.id);
  }
});

/* ---------------- décors ---------------- */

test('5 décors, déterministes et sans NaN', () => {
  for (const s of Core.SCENES) {
    const a = Core.sceneSVG(P + s.id + '-', s.id);
    const b = Core.sceneSVG(P + s.id + '-', s.id);
    assert.equal(a.group, b.group, s.id + ' : décor déterministe');
    assert.ok(a.group.length > 400, s.id + ' : décor non trivial');
    assert.ok(!a.group.includes('NaN'), s.id + ' : pas de NaN');
    assert.ok(!a.defs.includes('NaN'), s.id + ' : pas de NaN dans defs');
  }
});

/* ---------------- wallpaper final ---------------- */

test('wallpaperSVG : viewBox 16:9 + voiture + décor + légende', () => {
  const cfg = Core.normalizeConfig({ caption: 'Ma voiture', body: 'coupe', scene: 'neon', color: '#7048E8' });
  const svg = Core.wallpaperSVG(cfg, 'wp-', 1920, 1080);
  assert.ok(svg.startsWith('<svg'), 'début svg');
  assert.ok(svg.includes('viewBox="0 0 1920 1080"'), 'viewBox 16:9');
  assert.ok(svg.includes('width="1920"') && svg.includes('height="1080"'), 'attributs 1920x1080');
  assert.ok(svg.includes('MA VOITURE'), 'légende en majuscules');
  assert.ok(svg.includes('Coupé') || svg.includes('COUPÉ'), 'nom de carrosserie');
  assert.ok(svg.includes('AUTO·WALL STUDIO'), 'filigrane');
  assert.ok(!svg.includes('NaN'), 'pas de NaN');
  assert.ok(!svg.includes('undefined'), 'pas d\'undefined');
});

test('wallpaperSVG : résolutions 1080p / 1440p / 4K', () => {
  const cfg = Core.normalizeConfig({});
  for (const r of Core.RESOLUTIONS) {
    const svg = Core.wallpaperSVG(cfg, 'wp' + r.id + '-', r.w, r.h);
    assert.ok(svg.includes('width="' + r.w + '" height="' + r.h + '"'), r.id);
    assert.ok(!svg.includes('NaN'), r.id);
  }
});

test('wallpaperSVG : tous les corps x tous les décors', () => {
  for (const b of Core.BODIES) {
    for (const s of Core.SCENES) {
      const svg = Core.wallpaperSVG(Core.normalizeConfig({ body: b.id, scene: s.id }), 'all-', 1920, 1080);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), b.id + ' / ' + s.id);
    }
  }
});

test('échappement HTML dans la légende', () => {
  const svg = Core.wallpaperSVG(Core.normalizeConfig({ caption: '<b>&"</b>' }), 'esc-', 1920, 1080);
  assert.ok(!svg.includes('<b>'), 'pas de balise injectée');
  assert.ok(svg.includes('&lt;B&gt;'), 'entités HTML (la légende est en capitales)');
});

/* Le navigateur parse le SVG comme XML strict : on valide tous les
   documents générés avec un vrai parseur XML (saxes via jsdom). */
test('SVG strictement valide (parseur XML) : wallpapers + vues', () => {
  const { JSDOM } = require('jsdom');
  const win = new JSDOM('').window;
  const parser = new win.DOMParser();
  function assertValid(svg, label) {
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const err = doc.querySelector('parsererror');
    assert.equal(err, null, label + (err ? ' : ' + err.textContent.slice(0, 200) : ''));
  }
  for (const b of Core.BODIES) {
    for (const s of Core.SCENES) {
      assertValid(Core.wallpaperSVG(Core.normalizeConfig({ body: b.id, scene: s.id }), 'v-', 1920, 1080), 'wallpaper ' + b.id + '/' + s.id);
    }
  }
  for (const v of Core.VIEWS) {
    assertValid(Core.carViewSVG(Core.normalizeConfig({ body: 'suv', wheels: 'offroad', logo: 'custom', logoLetter: 'A' }), 'vv-' + v.id + '-', v.id), 'vue ' + v.id);
    assertValid(Core.isolatedViewSVG(Core.normalizeConfig({}), 'vi-' + v.id + '-', v.id), 'vue isolée ' + v.id);
  }
});
