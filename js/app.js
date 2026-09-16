/*
 * AutoWall Studio — application (navigateur)
 * État, rendu live, personnalisation, export PNG (canvas), partage via URL.
 */
(function () {
  'use strict';

  var Core = window.AWCore;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  /* ----------------------------- état ----------------------------- */

  function hashConfig() {
    var h = location.hash.replace(/^#/, '');
    var m = h.match(/c=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    return Core.decodeConfig(m[1]);
  }

  var state = {
    cfg: Core.normalizeConfig(hashConfig() || Core.DEFAULT_CONFIG),
    tab: 'wallpaper' // wallpaper | side | front | rear | top
  };

  var heroIndex = 0;
  var heroTimer = null;
  var hashTimer = null;

  /* ----------------------------- icônes ----------------------------- */

  function wheelIcon(id) {
    var cfg = Core.normalizeConfig({ wheels: id, body: 'sedan' });
    var p = 'iconw' + id + '-';
    return '<svg viewBox="18 18 68 68" aria-hidden="true">' +
      '<defs>' + Core.commonDefs(p, '#D7263D') + '</defs>' +
      Core.wheelSVG(p, cfg, 52, 52, 30) +
      '</svg>';
  }

  function bodyIcon(body) {
    var cfg = Core.normalizeConfig({ body: body, color: '#9AA4B2', wheels: 'sport', logo: 'volta' });
    var p = 'iconb' + body + '-';
    var vb = '40 90 1120 370';
    return '<svg viewBox="' + vb + '" aria-hidden="true">' +
      '<defs>' + Core.commonDefs(p, '#9AA4B2') + '</defs>' +
      '<g transform="scale(1)">' + Core.carSide(cfg, p) + '</g>' +
      '</svg>';
  }

  function sceneThumb(scene) {
    var p = 'icons' + scene + '-';
    var parts = Core.sceneSVG(p, scene);
    return '<svg viewBox="0 0 1920 1080" aria-hidden="true">' +
      '<defs>' + Core.commonDefs(p, '#D7263D') + parts.defs + '</defs>' +
      '<g>' + parts.group + '</g>' +
      '</svg>';
  }

  /* ----------------------------- rendu ----------------------------- */

  function previewSVG() {
    var p = 'prev-';
    if (state.tab === 'wallpaper') return Core.wallpaperSVG(state.cfg, p, 1920, 1080);
    return Core.isolatedViewSVG(state.cfg, p, state.tab);
  }

  function renderPreview() {
    var el = $('#preview');
    if (!el) return;
    el.innerHTML = previewSVG();
    var res = Core.resolution(state.cfg);
    var info = $('#previewInfo');
    if (info) {
      if (state.tab === 'wallpaper') {
        info.textContent = 'Aperçu du fond d\u2019écran · ' + res.w + '\u00d7' + res.h + ' px · ratio 16:9 · prêt pour Windows 10/11';
      } else {
        var vn = Core.VIEWS.filter(function (v) { return v.id === state.tab; })[0].name;
        info.textContent = 'Aperçu isolé · ' + vn + ' · la voiture est rendue à partir de ta configuration';
      }
    }
  }

  function renderHeroView() {
    var view = Core.VIEWS[heroIndex % Core.VIEWS.length].id;
    var p = 'hero-';
    var stage = $('#heroStage');
    if (stage) {
      stage.innerHTML = Core.carViewSVG(state.cfg, p, view);
      restartStageFade();
    }
    var chip = $('#heroViewChip');
    if (chip) chip.textContent = Core.VIEWS[heroIndex % Core.VIEWS.length].name;
    $$('.hero-thumbs .thumb').forEach(function (b, i) {
      b.classList.toggle('active', i === heroIndex % Core.VIEWS.length);
      b.setAttribute('aria-pressed', i === heroIndex % Core.VIEWS.length ? 'true' : 'false');
    });
  }

  function restartStageFade() {
    var stage = $('#heroStage');
    if (!stage) return;
    stage.classList.remove('fade');
    // force reflow pour relancer l'animation
    void stage.offsetWidth;
    stage.classList.add('fade');
  }

  function heroTick() {
    heroIndex = (heroIndex + 1) % Core.VIEWS.length;
    renderHeroView();
  }

  function startHeroCycle() {
    stopHeroCycle();
    heroTimer = setInterval(function () {
      if (!document.hidden) heroTick();
    }, 3600);
  }

  function stopHeroCycle() {
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
  }

  function renderAll() {
    renderPreview();
    renderHeroView();
    renderMeta();
    var root = document.documentElement;
    if (root && root.style) root.style.setProperty('--car-color', state.cfg.color);
  }

  function renderMeta() {
    var res = Core.resolution(state.cfg);
    var el = $('#resMeta');
    if (el) el.textContent = res.w + '\u00d7' + res.h + ' px · ' + res.name;
    // rétroviseur du résumé de config (carte récap)
    var recap = $('#recap');
    if (recap) {
      var bodyName = Core.BODIES.filter(function (b) { return b.id === state.cfg.body; })[0].name;
      var wheelName = Core.WHEELS.filter(function (w) { return w.id === state.cfg.wheels; })[0].name;
      var logoName = Core.LOGOS.filter(function (l) { return l.id === state.cfg.logo; })[0].name;
      var sceneName = Core.SCENES.filter(function (s) { return s.id === state.cfg.scene; })[0].name;
      recap.textContent = bodyName + ' · ' + wheelName + ' · Logo ' + (state.cfg.logo === 'custom' ? state.cfg.logoLetter : logoName) + ' · Décor ' + sceneName;
    }
  }

  /* ----------------------------- URL ----------------------------- */

  function syncHash() {
    if (hashTimer) clearTimeout(hashTimer);
    hashTimer = setTimeout(function () {
      var next = '#c=' + Core.encodeConfig(state.cfg);
      if (location.hash !== next) {
        try {
          history.replaceState(null, '', next);
        } catch (e) {
          try { location.hash = next; } catch (e2) { /* environnement sans history */ }
        }
      }
    }, 250);
  }

  /* ----------------------------- toast ----------------------------- */

  var toastTimer = null;
  function toast(msg, kind) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show ' + (kind || 'ok');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 3400);
  }

  /* ----------------------------- export PNG ----------------------------- */

  function downloadName() {
    var res = Core.resolution(state.cfg);
    var color = state.cfg.color.replace('#', '').toLowerCase();
    return 'autowall-' + state.cfg.body + '-' + color + '-' + res.w + 'x' + res.h + '.png';
  }

  function exportPng(onDone) {
    var res = Core.resolution(state.cfg);
    var svg = Core.wallpaperSVG(state.cfg, 'dl', res.w, res.h);
    if (typeof Blob === 'undefined') { onDone(false); return; }
    var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = res.w;
        canvas.height = res.h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, res.w, res.h);
        URL.revokeObjectURL(url);
        if (typeof canvas.toBlob !== 'function') { onDone(false); return; }
        canvas.toBlob(function (png) {
          if (!png) { onDone(false); return; }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(png);
          a.download = downloadName();
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
          onDone(true, png.size);
        }, 'image/png');
      } catch (e) {
        URL.revokeObjectURL(url);
        onDone(false);
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      onDone(false);
    };
    img.src = url;
  }

  function wireDownload(btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Génération en cours\u2026';
      // laisser le bouton se redessiner avant la tâche lourde (4K)
      setTimeout(function () {
        exportPng(function (ok, size) {
          btn.disabled = false;
          btn.innerHTML = old;
          if (ok) {
            var ko = size ? Math.round(size / 1024) + ' Ko' : '';
            var res = Core.resolution(state.cfg);
            toast('Fond d\u2019écran ' + res.w + '\u00d7' + res.h + ' téléchargé ✓ ' + (ko ? '(' + ko + ')' : ''), 'ok');
          } else {
            toast('Échec de la génération PNG. Réessaie avec une résolution plus faible.', 'err');
          }
        });
      }, 40);
    });
  }

  /* ----------------------------- contrôles ----------------------------- */

  function setCfg(patch) {
    state.cfg = Core.normalizeConfig(Object.assign({}, state.cfg, patch));
    renderAll();
    syncHash();
    refreshSelectionUI();
  }

  function refreshSelectionUI() {
    $$('.opt[data-body]').forEach(function (b) { b.classList.toggle('active', b.dataset.body === state.cfg.body); });
    $$('.opt[data-wheels]').forEach(function (b) { b.classList.toggle('active', b.dataset.wheels === state.cfg.wheels); });
    $$('.opt[data-logo]').forEach(function (b) { b.classList.toggle('active', b.dataset.logo === state.cfg.logo); });
    $$('.opt[data-badge]').forEach(function (b) { b.classList.toggle('active', b.dataset.badge === state.cfg.badge); });
    $$('.opt[data-scene]').forEach(function (b) { b.classList.toggle('active', b.dataset.scene === state.cfg.scene); });
    $$('.swatch[data-color]').forEach(function (b) { b.classList.toggle('active', b.dataset.color.toUpperCase() === state.cfg.color); });
    $$('.res-btn[data-res]').forEach(function (b) { b.classList.toggle('active', b.dataset.res === state.cfg.res); });
    // champs libres
    var ci = $('#colorInput');
    if (ci && ci.value.toLowerCase() !== state.cfg.color.toLowerCase()) ci.value = state.cfg.color;
    var cl = $('#captionInput');
    if (cl && cl.value !== state.cfg.caption) cl.value = state.cfg.caption;
    var ll = $('#logoLetterInput');
    if (ll) {
      ll.closest('.custom-logo-row').style.display = state.cfg.logo === 'custom' ? '' : 'none';
      if (ll.value !== state.cfg.logoLetter) ll.value = state.cfg.logoLetter;
    }
  }

  function wireControls() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.opt, .swatch, .res-btn') : null;
      if (!t) return;
      if (t.dataset.body) setCfg({ body: t.dataset.body });
      else if (t.dataset.wheels) setCfg({ wheels: t.dataset.wheels });
      else if (t.dataset.logo) setCfg({ logo: t.dataset.logo, logoLetter: t.dataset.logo === 'custom' ? (state.cfg.logoLetter || 'M') : '' });
      else if (t.dataset.badge) setCfg({ badge: t.dataset.badge });
      else if (t.dataset.scene) setCfg({ scene: t.dataset.scene });
      else if (t.dataset.color) setCfg({ color: t.dataset.color });
      else if (t.dataset.res) setCfg({ res: t.dataset.res });
    });

    var ci = $('#colorInput');
    if (ci) ci.addEventListener('input', function () { setCfg({ color: ci.value.toUpperCase() }); });

    var cl = $('#captionInput');
    if (cl) cl.addEventListener('input', function () {
      setCfg({ caption: cl.value.replace(/[<>]/g, '').slice(0, 28) });
    });

    var ll = $('#logoLetterInput');
    if (ll) ll.addEventListener('input', function () {
      setCfg({ logoLetter: ll.value });
    });

    // tabs de vue du studio
    $$('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.dataset.tab;
        $$('.tab-btn').forEach(function (x) {
          x.classList.toggle('active', x === b);
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        renderPreview();
      });
    });

    // vignettes du hero
    $$('.hero-thumbs .thumb').forEach(function (b, i) {
      b.addEventListener('click', function () {
        heroIndex = i;
        renderHeroView();
        startHeroCycle(); // relance le cycle après interaction
      });
    });

    var stage = $('#heroStage');
    if (stage) {
      stage.addEventListener('mouseenter', stopHeroCycle);
      stage.addEventListener('mouseleave', startHeroCycle);
    }

    // surprise / reset
    var rnd = $('#btnRandom');
    if (rnd) rnd.addEventListener('click', function () {
      function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
      var logo = pick(Core.LOGOS);
      setCfg({
        body: pick(Core.BODIES).id,
        color: pick(Core.COLORS).hex,
        wheels: pick(Core.WHEELS).id,
        logo: logo.id,
        logoLetter: logo.id === 'custom' ? pick(['A', 'K', 'M', 'R', 'S', 'X', 'Z']) : '',
        badge: pick(Core.BADGES).id,
        scene: pick(Core.SCENES).id
      });
      toast('Voici ta surprise ! 🎲', 'ok');
    });

    var rst = $('#btnReset');
    if (rst) rst.addEventListener('click', function () {
      setCfg(Core.DEFAULT_CONFIG);
      toast('Configuration réinitialisée', 'ok');
    });

    // partage (copie l'URL avec la config)
    var share = $('#btnShare');
    if (share) share.addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#c=' + Core.encodeConfig(state.cfg);
      function done() { toast('Lien copié — ta voiture est dans l\u2019URL !', 'ok'); }
      function fb() {
        try {
          var w = window.open(url, '_blank');
          if (w) return done();
        } catch (e) { /* noop */ }
        window.prompt('Copie ce lien pour partager ta config :', url);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, fb);
      } else { fb(); }
    });

    // CTA du hero
    var quick = $('#btnQuickDownload');
    if (quick) quick.addEventListener('click', function () {
      var old = quick.innerHTML;
      quick.disabled = true;
      quick.innerHTML = 'Génération\u2026';
      setTimeout(function () {
        exportPng(function (ok) {
          quick.disabled = false;
          quick.innerHTML = old;
          if (ok) toast('Aperçu 1920×1080 téléchargé ✓', 'ok');
          else toast('Échec du téléchargement, essaie via le studio.', 'err');
        });
      }, 40);
    });

    // nav fluide
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var el = document.getElementById(id);
        if (el && typeof el.scrollIntoView === 'function') {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    wireDownload($('#btnDownload'));
    wireDownload($('#btnDownloadMobile'));
  }

  /* ----------------------------- init ----------------------------- */

  function buildControls() {
    // carrosserie
    var bodies = $('#bodyOptions');
    if (bodies) bodies.innerHTML = Core.BODIES.map(function (b) {
      return '<button type="button" class="opt body-opt" data-body="' + b.id + '" aria-pressed="false">' +
        '<span class="opt-icon">' + bodyIcon(b.id) + '</span>' +
        '<span class="opt-label">' + b.name + '</span></button>';
    }).join('');

    // couleurs
    var colors = $('#colorOptions');
    if (colors) colors.innerHTML = Core.COLORS.map(function (c) {
      return '<button type="button" class="swatch" data-color="' + c.hex + '" title="' + c.name + '" aria-label="' + c.name + '">' +
        '<span class="swatch-dot" style="background:' + c.hex + '"></span></button>';
    }).join('') +
      '<label class="swatch custom" title="Couleur personnalisée" aria-label="Couleur personnalisée">' +
      '<input type="color" id="colorInput" value="' + state.cfg.color + '"/>' +
      '<span class="swatch-dot custom-dot"></span><span class="swatch-plus">+</span></label>';

    // roues
    var wheels = $('#wheelOptions');
    if (wheels) wheels.innerHTML = Core.WHEELS.map(function (w) {
      return '<button type="button" class="opt wheel-opt" data-wheels="' + w.id + '" aria-pressed="false">' +
        '<span class="opt-icon">' + wheelIcon(w.id) + '</span>' +
        '<span class="opt-label">' + w.name + '</span></button>';
    }).join('');

    // logos
    var logos = $('#logoOptions');
    if (logos) logos.innerHTML = Core.LOGOS.map(function (l) {
      var cfg = Core.normalizeConfig({ logo: l.id, logoLetter: l.id === 'custom' ? 'M' : '' });
      var p = 'iconl' + l.id + '-';
      var badge = Core.badgeSVG(p, cfg, 32, 34, 1.5);
      return '<button type="button" class="opt logo-opt" data-logo="' + l.id + '" aria-pressed="false">' +
        '<span class="opt-icon">' +
        '<svg viewBox="0 0 64 64" aria-hidden="true"><defs>' + Core.commonDefs(p, '#D7263D') + '</defs>' +
        '<g fill="#2A2F36">' + badge + '</g></svg>' +
        '</span>' +
        '<span class="opt-label">' + l.name + '</span></button>';
    }).join('');

    // badges (matière du logo)
    var badges = $('#badgeOptions');
    if (badges) badges.innerHTML = Core.BADGES.map(function (b) {
      var dot = b.id === 'chrome'
        ? 'linear-gradient(180deg,#fbfcfd,#9aa1ab)'
        : b.id === 'noir' ? '#17191d' : 'var(--car-color)';
      return '<button type="button" class="opt badge-opt" data-badge="' + b.id + '" aria-pressed="false">' +
        '<span class="badge-dot" style="background:' + dot + '"></span>' +
        '<span class="opt-label">' + b.name + '</span></button>';
    }).join('');

    // décors
    var scenes = $('#sceneOptions');
    if (scenes) scenes.innerHTML = Core.SCENES.map(function (s) {
      return '<button type="button" class="opt scene-opt" data-scene="' + s.id + '" aria-pressed="false">' +
        '<span class="opt-icon scene-thumb">' + sceneThumb(s.id) + '</span>' +
        '<span class="opt-label">' + s.name + '</span></button>';
    }).join('');

    // résolutions
    var res = $('#resOptions');
    if (res) res.innerHTML = Core.RESOLUTIONS.map(function (r) {
      return '<button type="button" class="res-btn" data-res="' + r.id + '" aria-pressed="false">' +
        '<span class="res-name">' + r.name + '</span>' +
        '<span class="res-detail">' + r.detail + '</span></button>';
    }).join('');

    // vignettes hero
    var thumbs = $('#heroThumbs');
    if (thumbs) thumbs.innerHTML = Core.VIEWS.map(function (v, i) {
      return '<button type="button" class="thumb" data-view="' + v.id + '" aria-pressed="' + (i === 0) + '">' + v.name.replace('Vue ', '') + '</button>';
    }).join('');
  }

  function init() {
    buildControls();
    wireControls();
    refreshSelectionUI();
    renderAll();
    startHeroCycle();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopHeroCycle();
      else startHeroCycle();
    });

    // expose pour tests / console
    window.AutoWall = {
      state: state,
      setCfg: setCfg,
      exportPng: exportPng,
      downloadName: downloadName,
      previewSVG: previewSVG
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
