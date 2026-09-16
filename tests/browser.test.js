'use strict';
/*
 * Test DOM (jsdom) : charge index.html, exécute les scripts du site et
 * simule l'utilisateur — clics sur les contrôles, état, URL, export PNG
 * (canvas et Image stubbés).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const Core = require('../js/car-core.js');

const INDEX = path.join(__dirname, '..', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------- stubs injectés AVANT l'exécution des scripts du site ------- */
function stubsBeforeParse(window) {
  window.__blobs = [];
  window.URL.createObjectURL = function (blob) {
    window.__blobs.push(blob);
    return 'blob:mock-' + window.__blobs.length;
  };
  window.URL.revokeObjectURL = function () {};
  window.HTMLCanvasElement.prototype.getContext = function () {
    return {
      _drawn: false,
      drawImage: function () { this._drawn = true; }
    };
  };
  window.HTMLCanvasElement.prototype.toBlob = function (cb, type) {
    setTimeout(function () {
      cb(new window.Blob(['PNGFAKE'], { type: type || 'image/png' }));
    }, 0);
  };
  const proto = window.HTMLImageElement.prototype;
  Object.defineProperty(proto, 'src', {
    get: function () { return this.getAttribute('src'); },
    set: function (v) {
      this.setAttribute('src', v);
      const self = this;
      setTimeout(function () { if (self.onload) self.onload(); }, 0);
    },
    configurable: true
  });
  window.__downloads = [];
  window.HTMLAnchorElement.prototype.click = function () {
    window.__downloads.push({ name: this.download, href: this.href });
  };
}

async function loadPage(urlOverride) {
  const pageErrors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    if (String(e.message || e).includes('Uncaught')) pageErrors.push(e);
  });
  const opts = {
    resources: 'usable',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse: stubsBeforeParse,
    virtualConsole: vc
  };
  if (urlOverride) opts.url = urlOverride;
  const dom = await JSDOM.fromFile(INDEX, opts);
  const t0 = Date.now();
  while (!dom.window.AutoWall && Date.now() - t0 < 10000) {
    await sleep(50);
  }
  return { dom, pageErrors };
}

/* Exécute fn dans une page, garantit window.close() (sinon les timers
   du site (cycle hero) maintiennent le processus en vie). */
async function withPage(fn, urlOverride) {
  const { dom, pageErrors } = await loadPage(urlOverride);
  try {
    assert.ok(dom.window.AutoWall, 'app initialisée');
    await fn(dom.window, pageErrors);
  } finally {
    try { dom.window.close(); } catch (e) { /* noop */ }
  }
}

function click(el) {
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function input(el, value) {
  el.value = value;
  el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
}
/* comparaison d'objets entre realms jsdom/node : via JSON */
function eqCfg(actual, expected, msg) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), msg);
}

test('page : chargement, init, rendu initial', async () => {
  await withPage((window, pageErrors) => {
    const d = window.document;
    assert.ok(window.AWCore, 'moteur chargé');
    assert.equal(pageErrors.length, 0, 'pas d\'erreur JS : ' + pageErrors.map((e) => e.message).join(' | '));

    assert.ok(d.getElementById('preview').innerHTML.includes('<svg'), 'aperçu SVG');
    assert.ok(d.getElementById('heroStage').innerHTML.includes('<svg'), 'hero SVG');

    assert.equal(d.querySelectorAll('#bodyOptions .opt').length, 4, '4 carrosseries');
    assert.equal(d.querySelectorAll('#wheelOptions .opt').length, 5, '5 jantes');
    assert.equal(d.querySelectorAll('#logoOptions .opt').length, 5, '5 logos');
    assert.equal(d.querySelectorAll('#sceneOptions .opt').length, 5, '5 décors');
    assert.equal(d.querySelectorAll('#resOptions .res-btn').length, 3, '3 résolutions');
    assert.ok(d.querySelectorAll('#colorOptions .swatch').length >= 10, '10+ couleurs');

    eqCfg(window.AutoWall.state.cfg, Core.DEFAULT_CONFIG, 'état initial = défauts');
  });
});

test('page : clics sur les contrôles mettent à jour état + rendu', async () => {
  await withPage(async (window, pageErrors) => {
    const d = window.document;

    // 1. carrosserie SUV
    click(d.querySelector('.opt[data-body="suv"]'));
    assert.equal(window.AutoWall.state.cfg.body, 'suv');
    assert.ok(window.AutoWall.previewSVG().includes('M 104 386'), 'hull SUV dans l\'aperçu');
    assert.ok(d.querySelector('.opt[data-body="suv"]').classList.contains('active'), 'UI sélectionnée');

    // 2. jantes turbo
    click(d.querySelector('.opt[data-wheels="turbo"]'));
    assert.equal(window.AutoWall.state.cfg.wheels, 'turbo');
    assert.ok(window.AutoWall.previewSVG().includes('301 348'), 'rayons turbo dans l\'aperçu');

    // 3. logo custom + lettre
    click(d.querySelector('.opt[data-logo="custom"]'));
    assert.equal(window.AutoWall.state.cfg.logo, 'custom');
    const letter = d.getElementById('logoLetterInput');
    assert.notEqual(letter.closest('.custom-logo-row').style.display, 'none', 'champ lettre visible');
    input(letter, 'q');
    assert.equal(window.AutoWall.state.cfg.logoLetter, 'Q', 'lettre normalisée en majuscule');
    assert.ok(window.AutoWall.previewSVG().includes('>Q<'), 'lettre Q rendue');

    // 4. couleur via pastille
    click(d.querySelector('.swatch[data-color="#2563EB"]'));
    assert.equal(window.AutoWall.state.cfg.color, '#2563EB');
    assert.ok(window.AutoWall.previewSVG().includes('#2563EB'), 'couleur dans les defs');

    // 5. légende
    input(d.getElementById('captionInput'), 'Mon auto <x>');
    assert.equal(window.AutoWall.state.cfg.caption, 'Mon auto x', 'caractères <> filtrés');
    assert.ok(window.AutoWall.previewSVG().includes('MON AUTO X'), 'légende en capitales');

    // 6. décor néon
    click(d.querySelector('.opt[data-scene="neon"]'));
    assert.equal(window.AutoWall.state.cfg.scene, 'neon');
    assert.ok(window.AutoWall.previewSVG().includes('#FF4FA0'), 'décor néon dans l\'aperçu');

    // 7. résolution 4K (l'aperçu reste en 1920x1080, la meta suit la résolution)
    click(d.querySelector('.res-btn[data-res="3840x2160"]'));
    assert.equal(window.AutoWall.state.cfg.res, '3840x2160');
    assert.ok(d.getElementById('resMeta').textContent.includes('3840'), 'meta 4K affichée');
    assert.ok(d.querySelector('.res-btn[data-res="3840x2160"]').classList.contains('active'), 'UI résolution');

    // 8. onglet vue face
    click(d.querySelector('.tab-btn[data-tab="front"]'));
    assert.ok(window.AutoWall.previewSVG().includes('viewBox="0 0 1200 560"'), 'vue isolée');

    // 9. URL synchronisée
    await sleep(400);
    assert.ok(window.location.hash.startsWith('#c='), 'hash mis à jour : ' + window.location.hash);
    const decoded = Core.decodeConfig(window.location.hash.slice(3));
    eqCfg(decoded, window.AutoWall.state.cfg, 'hash = config courante');

    assert.equal(pageErrors.length, 0, 'pas d\'erreur JS : ' + pageErrors.map((e) => e.message).join(' | '));
  });
});

test('page : export PNG génère un fichier nommé correctement', async () => {
  await withPage(async (window, pageErrors) => {
    const d = window.document;

    click(d.querySelector('.opt[data-body="coupe"]'));
    click(d.querySelector('.res-btn[data-res="2560x1440"]'));

    const blobsBefore = window.__blobs.length;
    click(d.getElementById('btnDownload'));
    let waited = 0;
    while (window.__downloads.length === 0 && waited < 3000) { await sleep(20); waited += 20; }
    assert.ok(waited < 3000, 'export terminé dans le délai');

    // premier blob créé pendant l'export = le SVG
    const svgBlob = window.__blobs[blobsBefore];
    assert.ok(svgBlob, 'blob SVG');
    const text = await svgBlob.text();
    assert.ok(text.startsWith('<svg'), 'blob = SVG');
    assert.ok(text.includes('width="2560" height="1440"'), 'SVG en 2560x1440');

    // ancre de téléchargement
    assert.equal(window.__downloads.length, 1, 'un téléchargement déclenché');
    const dl = window.__downloads[0];
    assert.match(dl.name, /^autowall-coupe-[0-9a-f]{6}-2560x1440\.png$/i, 'nom du fichier : ' + dl.name);
    assert.ok(dl.href.startsWith('blob:'), 'href blob');

    // toast de succès
    assert.ok(d.getElementById('toast').classList.contains('show'), 'toast affiché');

    assert.equal(pageErrors.length, 0, 'pas d\'erreur JS');
  });
});

test('page : surprise + reset', async () => {
  await withPage(async (window, pageErrors) => {
    const d = window.document;
    const before = JSON.stringify(window.AutoWall.state.cfg);
    for (let i = 0; i < 6; i++) click(d.getElementById('btnRandom'));
    const after = JSON.stringify(window.AutoWall.state.cfg);
    assert.notEqual(before, after, 'la surprise a changé la config');
    eqCfg(window.AutoWall.state.cfg, Core.normalizeConfig(window.AutoWall.state.cfg), 'config valide');

    click(d.getElementById('btnReset'));
    eqCfg(window.AutoWall.state.cfg, Core.DEFAULT_CONFIG, 'reset → défauts');

    assert.equal(pageErrors.length, 0, 'pas d\'erreur JS');
  });
});

test('page : config restaurée depuis l\'URL (#c=…)', async () => {
  const cfg = {
    body: 'hatch', color: '#F26430', wheels: 'offroad', logo: 'custom', logoLetter: 'ZZ',
    badge: 'noir', scene: 'aurora', caption: 'AURORA', res: '2560x1440'
  };
  const encoded = Core.encodeConfig(cfg);
  await withPage((window, pageErrors) => {
    eqCfg(window.AutoWall.state.cfg, Core.normalizeConfig(cfg), 'config de l\'URL restaurée');
    assert.equal(pageErrors.length, 0, 'pas d\'erreur JS');
  }, 'file://' + INDEX + '#c=' + encoded);
});
