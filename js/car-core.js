/*
 * AutoWall Studio — moteur de rendu paramétrique (UMD : navigateur + Node)
 * Génère toute l'imagerie du studio : voiture (4 vues), jantes, logos,
 * décors de fond et composition finale du fond d'écran (viewBox 1920x1080).
 * Aucune dépendance, aucune ressource externe : tout est SVG inline.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AWCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ============================ COULEURS ============================ */

  function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) n = 0x888888;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    function h(v) { return ('0' + clamp255(v).toString(16)).slice(-2); }
    return ('#' + h(r) + h(g) + h(b)).toUpperCase();
  }

  function mix(a, b, t) {
    var A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
  }

  /** amt > 0 : plus clair (vers blanc) — amt < 0 : plus sombre (vers noir) */
  function shade(hex, amt) {
    return amt >= 0 ? mix(hex, '#FFFFFF', amt) : mix(hex, '#000000', -amt);
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function isLight(hex) {
    var c = hexToRgb(hex);
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000 > 165;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  /* PRNG déterministe (mêmes décors à chaque rendu) */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================ MÉTADONNÉES ============================ */

  var BODIES = [
    { id: 'sedan', name: 'Berline' },
    { id: 'coupe', name: 'Coupé' },
    { id: 'suv', name: 'SUV' },
    { id: 'hatch', name: 'Break' }
  ];

  var WHEELS = [
    { id: 'sport', name: 'Sport' },
    { id: 'turbo', name: 'Turbo' },
    { id: 'classic', name: 'Classique' },
    { id: 'aero', name: 'Aéro' },
    { id: 'offroad', name: 'Off-road' }
  ];

  var LOGOS = [
    { id: 'volta', name: 'Volta', letter: 'V', shape: 'shield' },
    { id: 'aura', name: 'Aura', letter: 'A', shape: 'circle' },
    { id: 'nova', name: 'Nova', letter: 'N', shape: 'hex' },
    { id: 'kairos', name: 'Kairos', letter: 'K', shape: 'pill' },
    { id: 'custom', name: 'Personnalisé', letter: '', shape: 'circle' }
  ];

  var BADGES = [
    { id: 'chrome', name: 'Chrome' },
    { id: 'noir', name: 'Noir' },
    { id: 'car', name: 'Couleur carrosserie' }
  ];

  var COLORS = [
    { hex: '#D7263D', name: 'Rouge Passion' },
    { hex: '#F26430', name: 'Orange Ardent' },
    { hex: '#F6BD3B', name: 'Jaune Soleil' },
    { hex: '#16A34A', name: 'Vert Racing' },
    { hex: '#0EA5A4', name: 'Lagon' },
    { hex: '#2563EB', name: 'Bleu Électrique' },
    { hex: '#1B2A5B', name: 'Bleu Nuit' },
    { hex: '#7048E8', name: 'Violet Cosmos' },
    { hex: '#EEF1F4', name: 'Blanc Nacré' },
    { hex: '#23262B', name: 'Noir Graphite' }
  ];

  var SCENES = [
    { id: 'city', name: 'Aube urbaine' },
    { id: 'neon', name: 'Nuit néon' },
    { id: 'desert', name: 'Désert' },
    { id: 'studio', name: 'Studio' },
    { id: 'aurora', name: 'Aurores boréales' }
  ];

  var VIEWS = [
    { id: 'side', name: 'Vue Côté' },
    { id: 'front', name: 'Vue Face' },
    { id: 'rear', name: 'Vue Arrière' },
    { id: 'top', name: 'Vue Dessus' }
  ];

  var RESOLUTIONS = [
    { id: '1920x1080', w: 1920, h: 1080, name: 'Full HD', detail: '1920×1080' },
    { id: '2560x1440', w: 2560, h: 1440, name: 'QHD', detail: '2560×1440' },
    { id: '3840x2160', w: 3840, h: 2160, name: '4K Ultra HD', detail: '3840×2160' }
  ];

  var DEFAULT_CONFIG = {
    body: 'sedan',
    color: '#D7263D',
    wheels: 'sport',
    logo: 'volta',
    logoLetter: '',
    badge: 'chrome',
    scene: 'city',
    caption: '',
    res: '1920x1080'
  };

  function has(list, id) { return list.some(function (x) { return x.id === id; }); }

  function normalizeConfig(obj) {
    obj = obj || {};
    var c = {
      body: has(BODIES, obj.body) ? obj.body : DEFAULT_CONFIG.body,
      color: /^#[0-9A-Fa-f]{6}$/.test(obj.color || '') ? obj.color.toUpperCase() : DEFAULT_CONFIG.color,
      wheels: has(WHEELS, obj.wheels) ? obj.wheels : DEFAULT_CONFIG.wheels,
      logo: has(LOGOS, obj.logo) ? obj.logo : DEFAULT_CONFIG.logo,
      logoLetter: String(obj.logoLetter || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
      badge: has(BADGES, obj.badge) ? obj.badge : DEFAULT_CONFIG.badge,
      scene: has(SCENES, obj.scene) ? obj.scene : DEFAULT_CONFIG.scene,
      caption: String(obj.caption || '').slice(0, 28),
      res: has(RESOLUTIONS, obj.res) ? obj.res : DEFAULT_CONFIG.res
    };
    if (c.logo === 'custom' && !c.logoLetter) c.logoLetter = 'M';
    return c;
  }

  function base64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64urlDecode(str) {
    try {
      var b = String(str).replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return decodeURIComponent(escape(atob(b)));
    } catch (e) { return null; }
  }

  function encodeConfig(cfg) { return base64urlEncode(JSON.stringify(normalizeConfig(cfg))); }
  function decodeConfig(str) {
    if (!str) return null;
    var json = base64urlDecode(str);
    if (!json) return null;
    try {
      var obj = JSON.parse(json);
      return (obj && typeof obj === 'object') ? normalizeConfig(obj) : null;
    } catch (e) { return null; }
  }

  function find(list, id) {
    return list.filter(function (x) { return x.id === id; })[0] || list[0];
  }

  function resolution(cfg) { return find(RESOLUTIONS, cfg.res); }

  /* ============================ DÉFS COMMUNS ============================ */

  function commonDefs(p, color) {
    return [
      '<linearGradient id="' + p + 'body" x1="0" y1="0" x2="0" y2="1">',
      '  <stop offset="0%" stop-color="' + shade(color, 0.30) + '"/>',
      '  <stop offset="45%" stop-color="' + color + '"/>',
      '  <stop offset="100%" stop-color="' + shade(color, -0.22) + '"/>',
      '</linearGradient>',
      '<linearGradient id="' + p + 'glass" x1="0" y1="0" x2="0" y2="1">',
      '  <stop offset="0%" stop-color="#BFE0FF"/>',
      '  <stop offset="100%" stop-color="#3D5E8C"/>',
      '</linearGradient>',
      '<radialGradient id="' + p + 'rim" cx="0.38" cy="0.34" r="0.75">',
      '  <stop offset="0%" stop-color="#F4F6F9"/>',
      '  <stop offset="55%" stop-color="#A8AFB9"/>',
      '  <stop offset="100%" stop-color="#666D77"/>',
      '</radialGradient>',
      '<linearGradient id="' + p + 'chrome" x1="0" y1="0" x2="0" y2="1">',
      '  <stop offset="0%" stop-color="#FBFCFD"/>',
      '  <stop offset="48%" stop-color="#B9C0CA"/>',
      '  <stop offset="52%" stop-color="#8F97A2"/>',
      '  <stop offset="100%" stop-color="#E8EBF0"/>',
      '</linearGradient>',
      '<radialGradient id="' + p + 'head" cx="0.4" cy="0.4" r="0.8">',
      '  <stop offset="0%" stop-color="#FFFFF2"/>',
      '  <stop offset="100%" stop-color="#FFE08A"/>',
      '</radialGradient>',
      '<linearGradient id="' + p + 'tail" x1="0" y1="0" x2="1" y2="0">',
      '  <stop offset="0%" stop-color="#FF8A80"/>',
      '  <stop offset="50%" stop-color="#E23B3B"/>',
      '  <stop offset="100%" stop-color="#FF8A80"/>',
      '</linearGradient>',
      '<radialGradient id="' + p + 'shadow" cx="0.5" cy="0.5" r="0.5">',
      '  <stop offset="0%" stop-color="rgba(0,0,0,0.42)"/>',
      '  <stop offset="70%" stop-color="rgba(0,0,0,0.20)"/>',
      '  <stop offset="100%" stop-color="rgba(0,0,0,0)"/>',
      '</radialGradient>',
      '<radialGradient id="' + p + 'spot" cx="0.5" cy="0.5" r="0.5">',
      '  <stop offset="0%" stop-color="rgba(255,255,255,0.10)"/>',
      '  <stop offset="100%" stop-color="rgba(255,255,255,0)"/>',
      '</radialGradient>',
      '<radialGradient id="' + p + 'vig" cx="0.5" cy="0.46" r="0.72">',
      '  <stop offset="0%" stop-color="rgba(0,0,0,0)"/>',
      '  <stop offset="72%" stop-color="rgba(0,0,0,0)"/>',
      '  <stop offset="100%" stop-color="rgba(0,0,0,0.34)"/>',
      '</radialGradient>'
    ].join('');
  }

  /* ============================ BADGE / LOGO ============================ */

  var BADGE_SHAPES = {
    shield: '<path d="M 0 -15 L 13 -9 L 13 3 C 13 11 7 16 0 19 C -7 16 -13 11 -13 3 L -13 -9 Z"/>',
    circle: '<circle r="15"/>',
    hex: '<path d="M 0 -16 L 14 -8 L 14 8 L 0 16 L -14 8 L -14 -8 Z"/>',
    pill: '<rect x="-17" y="-11" width="34" height="22" rx="11"/>'
  };

  function logoMeta(cfg) {
    var meta = find(LOGOS, cfg.logo);
    var letter = meta.id === 'custom' ? (cfg.logoLetter || 'M') : meta.letter;
    return { meta: meta, letter: letter };
  }

  function badgeSVG(p, cfg, x, y, s) {
    var lm = logoMeta(cfg);
    var fill = cfg.badge === 'chrome' ? 'url(#' + p + 'chrome)'
      : cfg.badge === 'noir' ? '#17191D'
      : cfg.color;
    var stroke = cfg.badge === 'chrome' ? '#7E858F' : 'rgba(0,0,0,0.35)';
    var textFill = (cfg.badge === 'car' && isLight(cfg.color)) ? '#1A1D22' : '#F5F7FA';
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<g fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4">' + BADGE_SHAPES[lm.meta.shape] + '</g>' +
      '<text x="0" y="5.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ' +
      'font-size="15" font-weight="bold" fill="' + textFill + '">' + esc(lm.letter) + '</text>' +
      '</g>';
  }

  /* ============================ ROUES ============================ */

  function spokes(p, cfg, cx, cy) {
    var out = [];
    var i, a;
    if (cfg.wheels === 'sport') {
      for (i = 0; i < 5; i++) {
        a = i * 72;
        out.push('<rect x="' + (cx - 3.2) + '" y="' + (cy - 46) + '" width="6.4" height="36" rx="2.4" fill="#D6DBE2" transform="rotate(' + (a + 6) + ' ' + cx + ' ' + cy + ')"/>');
        out.push('<rect x="' + (cx - 3.2) + '" y="' + (cy - 46) + '" width="6.4" height="36" rx="2.4" fill="#C3C9D2" transform="rotate(' + (a - 6) + ' ' + cx + ' ' + cy + ')"/>');
      }
    } else if (cfg.wheels === 'turbo') {
      for (i = 0; i < 5; i++) {
        a = i * 72;
        out.push('<path d="M ' + (cx - 9) + ' ' + cy + ' L ' + (cx + 9) + ' ' + cy +
          ' L ' + (cx + 5) + ' ' + (cy - 44) + ' L ' + (cx - 5) + ' ' + (cy - 44) + ' Z" fill="#23272E" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>');
      }
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="48" fill="none" stroke="#C9CED6" stroke-width="3"/>');
    } else if (cfg.wheels === 'classic') {
      for (i = 0; i < 8; i++) {
        a = i * 45;
        out.push('<rect x="' + (cx - 2.4) + '" y="' + (cy - 46) + '" width="4.8" height="38" rx="2" fill="#C9CED6" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>');
      }
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="46" fill="none" stroke="#B7BDC6" stroke-width="3"/>');
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="37" fill="none" stroke="#B7BDC6" stroke-width="2"/>');
    } else if (cfg.wheels === 'aero') {
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="46" fill="#262B33"/>');
      for (i = 0; i < 3; i++) {
        a = i * 120;
        out.push('<circle cx="' + cx + '" cy="' + (cy - 25) + '" r="7" fill="#0E1116" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>');
      }
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="48" fill="none" stroke="#D0D5DC" stroke-width="3"/>');
    } else if (cfg.wheels === 'offroad') {
      for (i = 0; i < 6; i++) {
        a = i * 60;
        out.push('<rect x="' + (cx - 8) + '" y="' + (cy - 46) + '" width="16" height="36" rx="3" fill="#B7BDC6" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>');
      }
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="48" fill="none" stroke="#8F969F" stroke-width="6"/>');
    }
    return out.join('');
  }

  function wheelSVG(p, cfg, cx, cy, r) {
    var tire = cfg.wheels === 'offroad' ? r + 4 : r;
    var out = [];
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + tire + '" fill="#15181D"/>');
    if (cfg.wheels === 'offroad') {
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (tire - 3) + '" fill="none" stroke="#0B0D10" stroke-width="7" stroke-dasharray="12 9"/>');
    }
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="52" fill="url(#' + p + 'rim)"/>');
    out.push(spokes(p, cfg, cx, cy));
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#2A2F36"/>');
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="url(#' + p + 'chrome)"/>');
    return out.join('');
  }

  /* ============================ VOITURE — VUE CÔTÉ ============================ */

  var SIDE_GEOM = {
    sedan: {
      hull: 'M 100 372 L 64 356 L 54 316 C 51 292 56 278 74 272 L 208 264 L 1046 260 C 1102 258 1124 274 1128 300 L 1130 336 C 1130 356 1122 366 1104 370 L 993 372 A 98 98 0 0 0 797 372 L 408 372 A 98 98 0 0 0 212 372 Z',
      cabin: 'M 305 264 C 322 196 362 160 436 152 C 560 142 660 144 748 152 C 826 160 872 204 892 264 Z',
      winRear: 'M 342 258 C 356 202 388 174 446 166 L 576 162 L 576 258 Z',
      winFront: 'M 618 162 L 740 164 C 806 172 846 208 862 258 L 618 258 Z',
      seam: 'M 592 268 L 590 364',
      mirrorX: 884,
      head: 'M 1076 266 L 1118 272 L 1114 294 L 1082 288 Z',
      tail: 'M 64 282 L 98 276 L 100 296 L 68 300 Z',
      beltY: 264, bottomY: 372, archR: 98
    },
    coupe: {
      hull: 'M 100 372 L 64 356 L 54 312 C 51 288 58 270 84 264 L 210 256 L 1046 254 C 1102 252 1124 270 1128 296 L 1130 334 C 1130 356 1122 366 1104 370 L 993 372 A 98 98 0 0 0 797 372 L 408 372 A 98 98 0 0 0 212 372 Z',
      cabin: 'M 330 258 C 348 196 392 162 462 154 C 600 142 716 150 788 170 C 846 188 880 224 894 258 Z',
      winRear: 'M 366 252 C 382 202 418 174 476 166 L 586 162 L 586 252 Z',
      winFront: 'M 626 162 L 764 166 C 824 184 856 218 870 252 L 626 252 Z',
      seam: 'M 588 264 L 586 364',
      mirrorX: 886,
      head: 'M 1076 262 L 1116 268 L 1112 290 L 1082 284 Z',
      tail: 'M 66 284 L 98 278 L 100 296 L 70 300 Z',
      beltY: 258, bottomY: 372, archR: 98
    },
    suv: {
      hull: 'M 104 386 L 62 368 L 52 320 C 49 294 55 276 78 270 L 202 262 L 1040 256 C 1098 254 1122 272 1126 300 L 1128 342 C 1128 364 1120 376 1102 382 L 999 386 A 104 104 0 0 0 791 386 L 414 386 A 104 104 0 0 0 206 386 Z',
      cabin: 'M 288 260 C 300 186 336 148 420 140 C 560 130 700 132 790 142 C 852 150 884 194 900 260 Z',
      winRear: 'M 322 254 C 334 194 366 162 436 154 L 566 150 L 566 254 Z',
      winFront: 'M 606 150 L 776 156 C 834 168 862 204 876 254 L 606 254 Z',
      seam: 'M 580 262 L 578 378',
      mirrorX: 892,
      head: 'M 1072 260 L 1114 266 L 1110 292 L 1078 284 Z',
      tail: 'M 64 280 L 98 274 L 100 294 L 68 298 Z',
      beltY: 260, bottomY: 386, archR: 104
    },
    hatch: {
      hull: 'M 148 372 L 116 358 L 104 318 C 101 294 107 278 126 272 L 212 262 L 1046 258 C 1102 256 1124 272 1128 298 L 1130 336 C 1130 356 1122 366 1104 370 L 993 372 A 98 98 0 0 0 797 372 L 408 372 A 98 98 0 0 0 212 372 Z',
      cabin: 'M 258 260 C 268 190 302 156 382 148 C 540 138 680 142 762 152 C 832 162 872 204 890 260 Z',
      winRear: 'M 292 254 C 300 198 330 168 394 160 L 558 156 L 558 254 Z',
      winFront: 'M 598 156 L 750 160 C 810 170 846 206 860 254 L 598 254 Z',
      seam: 'M 258 266 L 256 364',
      mirrorX: 882,
      head: 'M 1076 264 L 1118 270 L 1114 292 L 1082 286 Z',
      tail: 'M 118 284 L 152 278 L 154 298 L 122 302 Z',
      beltY: 260, bottomY: 372, archR: 98
    }
  };

  var WHEEL_CX = { rear: 310, front: 895 };
  var SIDE_WHEEL_CY = 348;
  var SIDE_WHEEL_R = 82;

  function carSide(cfg, p) {
    var g = SIDE_GEOM[cfg.body];
    var b = g.bottomY;
    var out = [];
    out.push('<ellipse cx="600" cy="434" rx="545" ry="24" fill="url(#' + p + 'shadow)"/>');
    // passages de roue (fond sombre)
    out.push('<path d="M ' + (WHEEL_CX.rear - g.archR) + ' ' + b + ' A ' + g.archR + ' ' + g.archR + ' 0 0 1 ' + (WHEEL_CX.rear + g.archR) + ' ' + b + ' Z" fill="#0E1116"/>');
    out.push('<path d="M ' + (WHEEL_CX.front - g.archR) + ' ' + b + ' A ' + g.archR + ' ' + g.archR + ' 0 0 1 ' + (WHEEL_CX.front + g.archR) + ' ' + b + ' Z" fill="#0E1116"/>');
    // carrosserie
    out.push('<path d="' + g.hull + '" fill="url(#' + p + 'body)"/>');
    // bas de caisse
    out.push('<rect x="' + (WHEEL_CX.rear + g.archR) + '" y="' + (b - 18) + '" width="' + (WHEEL_CX.front - WHEEL_CX.rear - 2 * g.archR) + '" height="18" rx="6" fill="' + shade(cfg.color, -0.42) + '"/>');
    if (cfg.body === 'suv') {
      out.push('<path d="M ' + (WHEEL_CX.rear - g.archR) + ' ' + b + ' A ' + g.archR + ' ' + g.archR + ' 0 0 1 ' + (WHEEL_CX.rear + g.archR) + ' ' + b + '" fill="none" stroke="#262B33" stroke-width="12"/>');
      out.push('<path d="M ' + (WHEEL_CX.front - g.archR) + ' ' + b + ' A ' + g.archR + ' ' + g.archR + ' 0 0 1 ' + (WHEEL_CX.front + g.archR) + ' ' + b + '" fill="none" stroke="#262B33" stroke-width="12"/>');
    }
    // cabine + vitres
    out.push('<path d="' + g.cabin + '" fill="url(#' + p + 'body)"/>');
    out.push('<path d="' + g.winRear + '" fill="url(#' + p + 'glass)" stroke="rgba(10,14,20,0.35)" stroke-width="2"/>');
    out.push('<path d="' + g.winFront + '" fill="url(#' + p + 'glass)" stroke="rgba(10,14,20,0.35)" stroke-width="2"/>');
    // reflet vitre avant
    var reflX = cfg.body === 'hatch' ? 610 : 648;
    out.push('<path d="M ' + reflX + ' 166 L ' + (reflX + 44) + ' 166 L ' + (reflX + 12) + ' 254 L ' + (reflX - 26) + ' 254 Z" fill="#FFFFFF" opacity="0.14"/>');
    if (cfg.body === 'suv') {
      out.push('<rect x="430" y="126" width="330" height="10" rx="5" fill="#262B33"/>');
      out.push('<rect x="444" y="136" width="16" height="10" rx="3" fill="#262B33"/>');
      out.push('<rect x="730" y="136" width="16" height="10" rx="3" fill="#262B33"/>');
    }
    // joint + poignées
    out.push('<path d="' + g.seam + '" stroke="' + shade(cfg.color, -0.40) + '" stroke-width="3" fill="none" opacity="0.65" stroke-linecap="round"/>');
    out.push('<rect x="450" y="' + (g.beltY + 28) + '" width="46" height="10" rx="5" fill="' + shade(cfg.color, -0.42) + '"/>');
    out.push('<rect x="620" y="' + (g.beltY + 26) + '" width="46" height="10" rx="5" fill="' + shade(cfg.color, -0.42) + '"/>');
    // rétroviseur (tige + coque)
    var mx = g.mirrorX, my = g.beltY;
    out.push('<path d="M ' + (mx - 2) + ' ' + my + ' L ' + (mx + 8) + ' ' + (my - 26) + ' L ' + (mx + 20) + ' ' + (my - 18) + ' L ' + (mx + 14) + ' ' + my + ' Z" fill="' + shade(cfg.color, -0.30) + '"/>');
    out.push('<rect x="' + (mx + 2) + '" y="' + (my - 40) + '" width="40" height="20" rx="9" fill="' + shade(cfg.color, -0.15) + '" transform="rotate(-10 ' + (mx + 22) + ' ' + (my - 30) + ')"/>');
    out.push('<rect x="' + (mx + 8) + '" y="' + (my - 37) + '" width="26" height="9" rx="4.5" fill="url(#' + p + 'glass)" opacity="0.85" transform="rotate(-10 ' + (mx + 22) + ' ' + (my - 30) + ')"/>');
    // phares / feux
    out.push('<path d="' + g.head + '" fill="url(#' + p + 'head)"/>');
    out.push('<path d="' + g.tail + '" fill="url(#' + p + 'tail)"/>');
    // badge
    out.push(badgeSVG(p, cfg, 1035, 306, 0.8));
    // roues
    out.push(wheelSVG(p, cfg, WHEEL_CX.rear, SIDE_WHEEL_CY, SIDE_WHEEL_R));
    out.push(wheelSVG(p, cfg, WHEEL_CX.front, SIDE_WHEEL_CY, SIDE_WHEEL_R));
    return out.join('');
  }

  /* ============================ VOITURE — VUE FACE ============================ */

  var FRONT_GEOM = {
    sedan: {
      hull: 'M 44 440 L 90 352 C 88 296 112 268 170 258 L 730 258 C 788 268 812 296 810 352 L 856 440 A 106 106 0 0 0 644 440 L 256 440 A 106 106 0 0 0 44 440 Z',
      gh: 'M 250 258 L 298 170 C 350 148 550 148 602 170 L 650 258 Z',
      ghGlass: 'M 282 250 L 320 180 C 362 162 538 162 580 180 L 618 250 Z',
      archR: 106
    },
    coupe: {
      hull: 'M 44 440 L 90 352 C 88 296 112 268 170 258 L 730 258 C 788 268 812 296 810 352 L 856 440 A 106 106 0 0 0 644 440 L 256 440 A 106 106 0 0 0 44 440 Z',
      gh: 'M 254 258 L 306 182 C 356 162 544 162 594 182 L 646 258 Z',
      ghGlass: 'M 286 250 L 324 190 C 368 172 532 172 576 190 L 614 250 Z',
      archR: 106
    },
    suv: {
      hull: 'M 40 444 L 88 344 C 86 286 112 258 172 248 L 728 248 C 788 258 814 286 812 344 L 860 444 A 110 110 0 0 0 650 444 L 250 444 A 110 110 0 0 0 40 444 Z',
      gh: 'M 236 248 L 292 152 C 348 130 552 130 608 152 L 664 248 Z',
      ghGlass: 'M 270 240 L 314 162 C 360 144 540 144 586 162 L 630 240 Z',
      archR: 110
    },
    hatch: {
      hull: 'M 44 440 L 90 352 C 88 296 112 268 170 258 L 730 258 C 788 268 812 296 810 352 L 856 440 A 106 106 0 0 0 644 440 L 256 440 A 106 106 0 0 0 44 440 Z',
      gh: 'M 250 258 L 298 170 C 350 148 550 148 602 170 L 650 258 Z',
      ghGlass: 'M 282 250 L 320 180 C 362 162 538 162 580 180 L 618 250 Z',
      archR: 106
    }
  };

  var FRONT_WHEEL = { cxL: 150, cxR: 750, cy: 418, r: 82 };

  function frontBase(cfg, p) {
    var g = FRONT_GEOM[cfg.body];
    var bY = cfg.body === 'suv' ? 444 : 440;
    var out = [];
    out.push('<ellipse cx="450" cy="502" rx="405" ry="22" fill="url(#' + p + 'shadow)"/>');
    out.push('<path d="M ' + (FRONT_WHEEL.cxL - g.archR) + ' ' + bY + ' A ' + g.archR + ' ' + g.archR + ' 0 0 1 ' + (FRONT_WHEEL.cxL + g.archR) + ' ' + bY + ' Z" fill="#0E1116"/>');
    out.push('<path d="M ' + (FRONT_WHEEL.cxR - g.archR) + ' ' + bY + ' A ' + g.archR + ' ' + g.archR + ' 0 0 1 ' + (FRONT_WHEEL.cxR + g.archR) + ' ' + bY + ' Z" fill="#0E1116"/>');
    out.push('<path d="' + g.hull + '" fill="url(#' + p + 'body)"/>');
    return out;
  }

  function carFront(cfg, p) {
    var g = FRONT_GEOM[cfg.body];
    var out = frontBase(cfg, p);
    // capot
    out.push('<path d="M 200 292 C 400 282 500 282 700 292" stroke="' + shade(cfg.color, -0.15) + '" stroke-width="3" fill="none" opacity="0.55" stroke-linecap="round"/>');
    // cabine (vue de face)
    out.push('<path d="' + g.gh + '" fill="url(#' + p + 'body)"/>');
    out.push('<path d="' + g.ghGlass + '" fill="url(#' + p + 'glass)" stroke="rgba(10,14,20,0.4)" stroke-width="2"/>');
    // rétroviseurs
    out.push('<path d="M 216 240 C 194 232 178 240 182 254 L 214 262 Z" fill="' + shade(cfg.color, -0.15) + '"/>');
    out.push('<path d="M 684 240 C 706 232 722 240 718 254 L 686 262 Z" fill="' + shade(cfg.color, -0.15) + '"/>');
    // calandre + logo
    out.push('<rect x="330" y="300" width="240" height="64" rx="16" fill="#10131A"/>');
    out.push('<rect x="342" y="316" width="216" height="6" rx="3" fill="#1E232C"/>');
    out.push('<rect x="342" y="334" width="216" height="6" rx="3" fill="#1E232C"/>');
    out.push(badgeSVG(p, cfg, 450, 332, 1.15));
    // phares
    out.push('<path d="M 158 292 L 312 284 L 318 318 L 166 328 Z" fill="url(#' + p + 'head)"/>');
    out.push('<path d="M 168 296 L 306 290" stroke="#EAF6FF" stroke-width="3" opacity="0.9" stroke-linecap="round"/>');
    out.push('<path d="M 742 292 L 588 284 L 582 318 L 734 328 Z" fill="url(#' + p + 'head)"/>');
    out.push('<path d="M 732 296 L 594 290" stroke="#EAF6FF" stroke-width="3" opacity="0.9" stroke-linecap="round"/>');
    // prises d'air + plaque
    out.push('<path d="M 190 392 L 340 388 L 330 436 L 200 436 Z" fill="#10131A"/>');
    out.push('<path d="M 710 392 L 560 388 L 570 436 L 700 436 Z" fill="#10131A"/>');
    out.push('<circle cx="228" cy="412" r="11" fill="#0B0E13"/>');
    out.push('<circle cx="672" cy="412" r="11" fill="#0B0E13"/>');
    out.push(plateSVG(p, cfg, 450, 412));
    // roues
    out.push(wheelSVG(p, cfg, FRONT_WHEEL.cxL, FRONT_WHEEL.cy, FRONT_WHEEL.r));
    out.push(wheelSVG(p, cfg, FRONT_WHEEL.cxR, FRONT_WHEEL.cy, FRONT_WHEEL.r));
    return out.join('');
  }

  function plateText(cfg) {
    var t = cfg.caption ? cfg.caption.slice(0, 9).toUpperCase() : 'A·2026';
    return esc(t);
  }

  function plateSVG(p, cfg, cx, cy) {
    return '<g>' +
      '<rect x="' + (cx - 52) + '" y="' + (cy - 20) + '" width="104" height="40" rx="5" fill="#EDF0F3" stroke="#8A9099" stroke-width="2"/>' +
      '<text x="' + cx + '" y="' + (cy + 7) + '" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="bold" fill="#3A3F46">' + plateText(cfg) + '</text>' +
      '</g>';
  }

  /* ============================ VOITURE — VUE ARRIÈRE ============================ */

  var REAR_GEOM = {
    sedan: {
      gh: 'M 262 258 L 306 178 C 356 158 544 158 594 178 L 638 258 Z',
      ghGlass: 'M 294 250 L 330 188 C 372 170 528 170 570 188 L 606 250 Z'
    },
    coupe: {
      gh: 'M 258 258 L 300 172 C 352 150 548 150 600 172 L 642 258 Z',
      ghGlass: 'M 290 250 L 328 182 C 370 164 530 164 572 182 L 610 250 Z'
    },
    suv: {
      gh: 'M 244 252 L 296 150 C 352 128 548 128 604 150 L 656 252 Z',
      ghGlass: 'M 276 244 L 320 160 C 364 142 536 142 580 160 L 624 244 Z'
    },
    hatch: {
      gh: 'M 254 258 L 298 170 C 350 148 550 148 602 170 L 646 258 Z',
      ghGlass: 'M 286 250 L 324 180 C 366 162 534 162 576 180 L 614 250 Z'
    }
  };

  function carRear(cfg, p) {
    var g = REAR_GEOM[cfg.body];
    var out = frontBase(cfg, p);
    // toit + vitre arrière
    out.push('<path d="' + g.gh + '" fill="url(#' + p + 'body)"/>');
    out.push('<path d="' + g.ghGlass + '" fill="url(#' + p + 'glass)" stroke="rgba(10,14,20,0.4)" stroke-width="2"/>');
    if (cfg.body === 'coupe') {
      out.push('<rect x="330" y="252" width="16" height="12" rx="3" fill="' + shade(cfg.color, -0.35) + '"/>');
      out.push('<rect x="554" y="252" width="16" height="12" rx="3" fill="' + shade(cfg.color, -0.35) + '"/>');
      out.push('<path d="M 250 240 L 650 240 L 662 254 L 238 254 Z" fill="' + shade(cfg.color, -0.25) + '"/>');
    }
    if (cfg.body === 'suv') {
      out.push('<rect x="300" y="132" width="34" height="14" rx="6" fill="#262B33"/>');
      out.push('<rect x="566" y="132" width="34" height="14" rx="6" fill="#262B33"/>');
    }
    // logo
    out.push(badgeSVG(p, cfg, 450, 272, 1.0));
    // barre lumineuse
    out.push('<rect x="186" y="296" width="528" height="40" rx="20" fill="#14181F"/>');
    out.push('<rect x="198" y="304" width="504" height="24" rx="12" fill="url(#' + p + 'tail)"/>');
    out.push('<rect x="330" y="300" width="5" height="32" fill="#14181F"/>');
    out.push('<rect x="448" y="300" width="5" height="32" fill="#14181F"/>');
    out.push('<rect x="566" y="300" width="5" height="32" fill="#14181F"/>');
    // diffuseur + plaque
    out.push('<path d="M 190 392 L 340 388 L 330 436 L 200 436 Z" fill="#10131A"/>');
    out.push('<path d="M 710 392 L 560 388 L 570 436 L 700 436 Z" fill="#10131A"/>');
    out.push('<rect x="340" y="390" width="220" height="44" rx="8" fill="#10131A"/>');
    out.push('<rect x="400" y="390" width="6" height="44" fill="#1E232C"/>');
    out.push('<rect x="460" y="390" width="6" height="44" fill="#1E232C"/>');
    out.push('<rect x="520" y="390" width="6" height="44" fill="#1E232C"/>');
    out.push(plateSVG(p, cfg, 450, 412));
    // échappements
    out.push('<rect x="296" y="404" width="46" height="18" rx="9" fill="url(#' + p + 'chrome)"/>');
    out.push('<rect x="558" y="404" width="46" height="18" rx="9" fill="url(#' + p + 'chrome)"/>');
    // roues
    out.push(wheelSVG(p, cfg, FRONT_WHEEL.cxL, FRONT_WHEEL.cy, FRONT_WHEEL.r));
    out.push(wheelSVG(p, cfg, FRONT_WHEEL.cxR, FRONT_WHEEL.cy, FRONT_WHEEL.r));
    return out.join('');
  }

  /* ============================ VOITURE — VUE DESSUS ============================ */

  var TOP_GEOM = {
    sedan: {
      hull: 'M 220 118 L 820 114 Q 1058 114 1062 240 Q 1058 366 820 366 L 220 362 Q 118 358 118 240 Q 118 122 220 118 Z',
      windshield: 'M 828 134 C 844 240 844 240 828 346 L 716 318 C 744 240 744 240 716 162 Z',
      roof: { x: 470, y: 148, w: 246, h: 184, r: 46 },
      rearWin: 'M 470 164 L 380 190 C 366 240 366 240 380 290 L 470 316 Z',
      frontX: 1062, rearX: 118, wheelF: 842, wheelR: 248, wheelTopY: 86
    },
    coupe: {
      hull: 'M 240 122 L 810 116 Q 1054 116 1058 240 Q 1054 364 810 364 L 240 360 Q 160 352 166 240 Q 170 130 240 122 Z',
      windshield: 'M 824 136 C 840 240 840 240 824 344 L 712 316 C 740 240 740 240 712 164 Z',
      roof: { x: 430, y: 152, w: 282, h: 176, r: 46 },
      rearWin: 'M 430 168 L 300 206 C 288 240 288 240 300 274 L 430 312 Z',
      frontX: 1058, rearX: 166, wheelF: 838, wheelR: 252, wheelTopY: 88
    },
    suv: {
      hull: 'M 210 102 L 830 98 Q 1080 98 1084 240 Q 1080 382 830 382 L 210 378 Q 104 374 104 240 Q 104 106 210 102 Z',
      windshield: 'M 838 124 C 856 240 856 240 838 356 L 706 326 C 738 240 738 240 706 154 Z',
      roof: { x: 440, y: 136, w: 266, h: 208, r: 50 },
      rearWin: 'M 440 158 L 348 186 C 334 240 334 240 348 294 L 440 322 Z',
      frontX: 1084, rearX: 104, wheelF: 852, wheelR: 238, wheelTopY: 76
    },
    hatch: {
      hull: 'M 250 120 L 820 116 Q 1056 116 1060 240 Q 1056 364 820 364 L 250 360 Q 162 356 162 240 Q 162 124 250 120 Z',
      windshield: 'M 848 136 C 864 240 864 240 848 344 L 728 316 C 756 240 756 240 728 164 Z',
      roof: { x: 450, y: 150, w: 278, h: 180, r: 46 },
      rearWin: 'M 450 158 L 240 190 C 222 240 222 240 240 290 L 450 322 Z',
      frontX: 1060, rearX: 162, wheelF: 842, wheelR: 252, wheelTopY: 86
    }
  };

  function carTop(cfg, p) {
    var g = TOP_GEOM[cfg.body];
    var out = [];
    // roues (vue de dessus) — dépassent nettement de la carrosserie
    var wy = g.wheelTopY;
    var wyB = 480 - wy - 34;
    out.push('<rect x="' + g.wheelR + '" y="' + wy + '" width="112" height="34" rx="13" fill="#14171C"/>');
    out.push('<rect x="' + g.wheelR + '" y="' + wyB + '" width="112" height="34" rx="13" fill="#14171C"/>');
    out.push('<rect x="' + g.wheelF + '" y="' + wy + '" width="112" height="34" rx="13" fill="#14171C"/>');
    out.push('<rect x="' + g.wheelF + '" y="' + wyB + '" width="112" height="34" rx="13" fill="#14171C"/>');
    out.push('<rect x="' + (g.wheelR + 8) + '" y="' + (wy + 9) + '" width="96" height="16" rx="8" fill="#232830"/>');
    out.push('<rect x="' + (g.wheelF + 8) + '" y="' + (wy + 9) + '" width="96" height="16" rx="8" fill="#232830"/>');
    out.push('<rect x="' + (g.wheelR + 8) + '" y="' + (wyB + 9) + '" width="96" height="16" rx="8" fill="#232830"/>');
    out.push('<rect x="' + (g.wheelF + 8) + '" y="' + (wyB + 9) + '" width="96" height="16" rx="8" fill="#232830"/>');
    // carrosserie
    out.push('<path d="' + g.hull + '" fill="url(#' + p + 'body)"/>');
    // lignes du capot
    out.push('<path d="M 850 140 C 950 152 1010 190 1028 240" stroke="' + shade(cfg.color, -0.14) + '" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>');
    out.push('<path d="M 850 340 C 950 328 1010 290 1028 240" stroke="' + shade(cfg.color, -0.14) + '" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>');
    // lunette + toit + pare-brise
    out.push('<path d="' + g.rearWin + '" fill="url(#' + p + 'glass)" stroke="rgba(10,14,20,0.4)" stroke-width="2"/>');
    out.push('<rect x="' + g.roof.x + '" y="' + g.roof.y + '" width="' + g.roof.w + '" height="' + g.roof.h + '" rx="' + g.roof.r + '" fill="' + shade(cfg.color, 0.06) + '"/>');
    out.push('<rect x="' + (g.roof.x + 18) + '" y="' + (g.roof.y + 16) + '" width="' + (g.roof.w - 36) + '" height="' + (g.roof.h - 32) + '" rx="' + (g.roof.r - 14) + '" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>');
    out.push('<path d="' + g.windshield + '" fill="url(#' + p + 'glass)" stroke="rgba(10,14,20,0.4)" stroke-width="2"/>');
    if (cfg.body === 'coupe') {
      out.push('<rect x="500" y="172" width="150" height="136" rx="30" fill="url(#' + p + 'glass)" opacity="0.92"/>');
    }
    if (cfg.body === 'suv') {
      out.push('<rect x="460" y="142" width="226" height="10" rx="5" fill="#262B33"/>');
      out.push('<rect x="460" y="328" width="226" height="10" rx="5" fill="#262B33"/>');
    }
    // rétroviseurs
    out.push('<rect x="694" y="94" width="20" height="38" rx="9" fill="' + shade(cfg.color, -0.18) + '" transform="rotate(-18 704 113)"/>');
    out.push('<rect x="694" y="348" width="20" height="38" rx="9" fill="' + shade(cfg.color, -0.18) + '" transform="rotate(18 704 367)"/>');
    // phares / feux
    out.push('<rect x="' + (g.frontX - 18) + '" y="140" width="16" height="44" rx="6" fill="#F5F0D8"/>');
    out.push('<rect x="' + (g.frontX - 18) + '" y="296" width="16" height="44" rx="6" fill="#F5F0D8"/>');
    out.push('<rect x="' + (g.rearX + 2) + '" y="140" width="12" height="44" rx="5" fill="#E23B3B"/>');
    out.push('<rect x="' + (g.rearX + 2) + '" y="296" width="12" height="44" rx="5" fill="#E23B3B"/>');
    // badge sur le capot
    out.push(badgeSVG(p, cfg, 930, 240, 0.8));
    return out.join('');
  }

  /* ============================ VUES ============================ */

  var VIEW_VB = {
    side: '0 0 1200 500',
    front: '0 0 900 560',
    rear: '0 0 900 560',
    top: '0 0 1200 480'
  };

  function carView(cfg, p, view) {
    if (view === 'front') return carFront(cfg, p);
    if (view === 'rear') return carRear(cfg, p);
    if (view === 'top') return carTop(cfg, p);
    return carSide(cfg, p);
  }

  function carViewSVG(cfg, p, view) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + VIEW_VB[view] + '" role="img" aria-label="Vue ' +
      esc(view) + ' de la voiture">' +
      '<defs>' + commonDefs(p, cfg.color) + '</defs>' +
      carView(cfg, p, view) + '</svg>';
  }

  function isolatedViewSVG(cfg, p, view) {
    var bg = [];
    bg.push('<rect x="0" y="0" width="1200" height="560" fill="#14161D"/>');
    bg.push('<ellipse cx="600" cy="' + (view === 'top' ? '240' : '300') + '" rx="560" ry="220" fill="url(#' + p + 'spot)"/>');
    var inner;
    if (view === 'top') {
      inner = '<g transform="translate(0 40)">' + carTop(cfg, p) + '</g>';
    } else if (view === 'side') {
      inner = '<g transform="translate(0 30)">' + carSide(cfg, p) + '</g>';
    } else {
      inner = '<g transform="translate(150 0)">' + carView(cfg, p, view) + '</g>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 560" role="img" aria-label="Vue ' +
      esc(view) + ' de la voiture">' +
      '<defs>' + commonDefs(p, cfg.color) + '</defs>' +
      bg.join('') + inner + '</svg>';
  }

  /* ============================ DÉCOR ============================ */

  function starField(rand, n, yMax, rMax, color) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push('<circle cx="' + Math.round(rand() * 1920) + '" cy="' + Math.round(rand() * yMax) +
        '" r="' + (0.8 + rand() * rMax).toFixed(1) + '" fill="' + color + '" opacity="' + (0.25 + rand() * 0.6).toFixed(2) + '"/>');
    }
    return out.join('');
  }

  function skyline(rand, baseY, hMin, hMax, wMin, wMax, fill, windows, winColors, winP) {
    var out = [];
    var x = -30;
    var guard = 0;
    while (x < 1960 && guard < 80) {
      guard++;
      var w = wMin + rand() * (wMax - wMin);
      var h = hMin + rand() * (hMax - hMin);
      out.push('<rect x="' + Math.round(x) + '" y="' + Math.round(baseY - h) + '" width="' + Math.round(w) + '" height="' + Math.round(h) + '" fill="' + fill + '"/>');
      if (windows) {
        var wx = x + 10, wy = baseY - h + 14;
        var cols = Math.floor((w - 20) / 22), rows = Math.floor((h - 26) / 30);
        for (var c = 0; c < cols; c++) {
          for (var r = 0; r < rows; r++) {
            if (rand() < winP) {
              var col = winColors[Math.floor(rand() * winColors.length)];
              out.push('<rect x="' + Math.round(wx + c * 22) + '" y="' + Math.round(wy + r * 30) + '" width="8" height="12" fill="' + col + '" opacity="' + (0.3 + rand() * 0.6).toFixed(2) + '"/>');
            }
          }
        }
      }
      x += w + 6 + rand() * 26;
    }
    return out.join('');
  }

  function sceneCity(p, rand) {
    var defs =
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#1A1E3C"/><stop offset="38%" stop-color="#4B2E6E"/>' +
      '<stop offset="62%" stop-color="#B44A7A"/><stop offset="82%" stop-color="#FF8C5A"/>' +
      '<stop offset="96%" stop-color="#FFC46B"/></linearGradient>' +
      '<radialGradient id="' + p + 'sun" cx="0.5" cy="0.5" r="0.5">' +
      '<stop offset="0%" stop-color="#FFE7B0" stop-opacity="0.95"/>' +
      '<stop offset="45%" stop-color="#FFC46B" stop-opacity="0.55"/>' +
      '<stop offset="100%" stop-color="#FFC46B" stop-opacity="0"/></radialGradient>';
    var g = [];
    g.push('<rect x="0" y="0" width="1920" height="800" fill="url(#' + p + 'sky)"/>');
    g.push('<circle cx="1380" cy="620" r="230" fill="url(#' + p + 'sun)"/>');
    g.push('<circle cx="1380" cy="620" r="58" fill="#FFD9A0" opacity="0.95"/>');
    g.push(skyline(rand, 800, 120, 340, 60, 140, '#4A3363', false, [], 0));
    g.push(skyline(rand, 800, 180, 460, 90, 180, '#2E1F45', true, ['#FFD98A', '#FFE3B0'], 0.22));
    g.push('<rect x="0" y="796" width="1920" height="6" fill="#FF9E5E" opacity="0.5"/>');
    g.push('<rect x="0" y="800" width="1920" height="280" fill="#171225"/>');
    g.push('<polygon points="0,1080 1920,1080 1560,800 360,800" fill="#1E1830"/>');
    g.push('<line x1="360" y1="800" x2="0" y2="1080" stroke="#FF8C5A" stroke-width="3" opacity="0.35"/>');
    g.push('<line x1="1560" y1="800" x2="1920" y2="1080" stroke="#FF8C5A" stroke-width="3" opacity="0.35"/>');
    g.push('<rect x="800" y="814" width="320" height="6" rx="3" fill="#E9D8FF" opacity="0.14"/>');
    g.push('<rect x="700" y="846" width="520" height="8" rx="4" fill="#E9D8FF" opacity="0.12"/>');
    g.push('<rect x="590" y="880" width="740" height="10" rx="5" fill="#E9D8FF" opacity="0.10"/>');
    return { defs: defs, group: g.join('') };
  }

  function sceneNeon(p, rand) {
    var defs =
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#05070F"/><stop offset="55%" stop-color="#141033"/>' +
      '<stop offset="100%" stop-color="#2A1650"/></linearGradient>' +
      '<radialGradient id="' + p + 'moon" cx="0.5" cy="0.5" r="0.5">' +
      '<stop offset="0%" stop-color="#E8ECF4" stop-opacity="0.5"/>' +
      '<stop offset="100%" stop-color="#E8ECF4" stop-opacity="0"/></radialGradient>';
    var g = [];
    g.push('<rect x="0" y="0" width="1920" height="800" fill="url(#' + p + 'sky)"/>');
    g.push(starField(rand, 90, 480, 1.4, '#DDE6FF'));
    g.push('<circle cx="300" cy="170" r="90" fill="url(#' + p + 'moon)"/>');
    g.push('<circle cx="300" cy="170" r="44" fill="#E8ECF4" opacity="0.9"/>');
    g.push(skyline(rand, 800, 140, 380, 70, 150, '#0E0B22', false, [], 0));
    g.push(skyline(rand, 800, 200, 480, 90, 190, '#0A0818', true, ['#FF4FA0', '#3FD9FF', '#B48CFF'], 0.28));
    // enseignes néon
    for (var i = 0; i < 6; i++) {
      var nx = 120 + rand() * 1680;
      var ny = 460 + rand() * 200;
      var nh = 60 + rand() * 130;
      var nc = rand() < 0.5 ? '#FF4FA0' : '#3FD9FF';
      g.push('<rect x="' + Math.round(nx - 3) + '" y="' + Math.round(ny) + '" width="14" height="' + Math.round(nh) + '" fill="' + nc + '" opacity="0.22"/>');
      g.push('<rect x="' + Math.round(nx) + '" y="' + Math.round(ny) + '" width="8" height="' + Math.round(nh) + '" fill="' + nc + '" opacity="0.85"/>');
    }
    g.push('<rect x="0" y="796" width="1920" height="6" fill="#FF4FA0" opacity="0.4"/>');
    g.push('<rect x="0" y="800" width="1920" height="280" fill="#08070F"/>');
    g.push('<polygon points="0,1080 1920,1080 1560,800 360,800" fill="#0D0B1A"/>');
    // reflets sur la route (limités au-dessus de la zone de légende)
    for (var j = 0; j < 14; j++) {
      var rx = 420 + rand() * 1100;
      var rh = 50 + rand() * 110;
      var rc = rand() < 0.5 ? '#FF4FA0' : '#3FD9FF';
      g.push('<rect x="' + Math.round(rx) + '" y="806" width="5" height="' + Math.round(rh) + '" fill="' + rc + '" opacity="' + (0.07 + rand() * 0.1).toFixed(2) + '"/>');
    }
    return { defs: defs, group: g.join('') };
  }

  function sceneDesert(p, rand) {
    var defs =
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2B1A4A"/><stop offset="45%" stop-color="#8A3D5E"/>' +
      '<stop offset="72%" stop-color="#E86A4C"/><stop offset="94%" stop-color="#FFB25E"/></linearGradient>' +
      '<radialGradient id="' + p + 'sun" cx="0.5" cy="0.5" r="0.5">' +
      '<stop offset="0%" stop-color="#FFE3B0" stop-opacity="0.9"/>' +
      '<stop offset="100%" stop-color="#FFB25E" stop-opacity="0"/></radialGradient>';
    var g = [];
    g.push('<rect x="0" y="0" width="1920" height="860" fill="url(#' + p + 'sky)"/>');
    g.push('<circle cx="960" cy="660" r="240" fill="url(#' + p + 'sun)"/>');
    g.push('<circle cx="960" cy="660" r="120" fill="#FFE3B0"/>');
    g.push('<path d="M 540 300 q 14 -12 28 0 q 14 -12 28 0" stroke="#3A1E2A" stroke-width="4" fill="none" opacity="0.7" stroke-linecap="round"/>');
    g.push('<path d="M 660 250 q 10 -9 20 0 q 10 -9 20 0" stroke="#3A1E2A" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round"/>');
    g.push('<path d="M 0 640 C 300 560 620 660 960 600 C 1300 540 1600 640 1920 580 L 1920 860 L 0 860 Z" fill="#7A3B33"/>');
    g.push('<path d="M 0 720 C 400 640 800 760 1200 690 C 1500 640 1750 720 1920 680 L 1920 880 L 0 880 Z" fill="#5E2C28"/>');
    // cactus (entre deux dunes, base masquée par la dune du premier plan)
    g.push('<g fill="#2A1414" opacity="0.92">' +
      '<rect x="128" y="706" width="16" height="118" rx="8"/>' +
      '<rect x="102" y="734" width="14" height="48" rx="7"/>' +
      '<rect x="102" y="764" width="36" height="14" rx="7"/>' +
      '<rect x="150" y="722" width="14" height="54" rx="7"/>' +
      '<rect x="128" y="752" width="38" height="14" rx="7"/>' +
      '</g>');
    g.push('<path d="M 0 820 C 300 760 700 860 1100 800 C 1450 750 1750 840 1920 800 L 1920 1080 L 0 1080 Z" fill="#3E1D1C"/>');
    return { defs: defs, group: g.join('') };
  }

  function sceneStudio(p, rand) {
    var defs =
      '<radialGradient id="' + p + 'bg" cx="0.5" cy="0.36" r="0.85">' +
      '<stop offset="0%" stop-color="#2B303B"/><stop offset="100%" stop-color="#12141A"/></radialGradient>' +
      '<linearGradient id="' + p + 'beam" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.10"/>' +
      '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>';
    var g = [];
    g.push('<rect x="0" y="0" width="1920" height="1080" fill="url(#' + p + 'bg)"/>');
    g.push('<polygon points="830,0 1090,0 1330,780 590,780" fill="url(#' + p + 'beam)"/>');
    g.push('<polygon points="300,0 470,0 400,780 130,780" fill="url(#' + p + 'beam)" opacity="0.6"/>');
    g.push('<rect x="0" y="780" width="1920" height="300" fill="#191C23"/>');
    g.push('<rect x="0" y="778" width="1920" height="3" fill="#3A3F4B" opacity="0.55"/>');
    g.push('<ellipse cx="960" cy="800" rx="640" ry="44" fill="#FFFFFF" opacity="0.05"/>');
    return { defs: defs, group: g.join('') };
  }

  function sceneAurora(p, rand) {
    var defs =
      '<linearGradient id="' + p + 'sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#04070F"/><stop offset="55%" stop-color="#0A1830"/>' +
      '<stop offset="100%" stop-color="#12314E"/></linearGradient>' +
      '<linearGradient id="' + p + 'au1" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#37E6B0" stop-opacity="0.75"/>' +
      '<stop offset="100%" stop-color="#37E6B0" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + p + 'au2" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2EC5D3" stop-opacity="0.6"/>' +
      '<stop offset="100%" stop-color="#2EC5D3" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + p + 'au3" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#8A63D6" stop-opacity="0.5"/>' +
      '<stop offset="100%" stop-color="#8A63D6" stop-opacity="0"/></linearGradient>';
    var g = [];
    g.push('<rect x="0" y="0" width="1920" height="940" fill="url(#' + p + 'sky)"/>');
    g.push(starField(rand, 120, 560, 1.5, '#DDE6FF'));
    g.push('<path d="M -40 130 C 300 50 700 150 1100 70 C 1400 10 1700 95 1960 35 L 1960 250 C 1700 310 1400 230 1100 290 C 700 370 300 290 -40 350 Z" fill="url(#' + p + 'au1)" opacity="0.5"/>');
    g.push('<path d="M -40 220 C 300 140 700 240 1100 160 C 1400 100 1700 185 1960 125 L 1960 340 C 1700 400 1400 320 1100 380 C 700 460 300 380 -40 440 Z" fill="url(#' + p + 'au2)" opacity="0.35"/>');
    g.push('<path d="M -40 310 C 300 230 700 330 1100 250 C 1400 190 1700 275 1960 215 L 1960 430 C 1700 490 1400 410 1100 470 C 700 550 300 470 -40 530 Z" fill="url(#' + p + 'au3)" opacity="0.28"/>');
    g.push('<path d="M 0 700 L 240 560 L 470 690 L 700 540 L 950 680 L 1200 555 L 1450 690 L 1700 570 L 1920 660 L 1920 1080 L 0 1080 Z" fill="#0B1424"/>');
    g.push('<path d="M 0 800 L 300 680 L 600 790 L 900 660 L 1200 780 L 1500 670 L 1780 790 L 1920 740 L 1920 1080 L 0 1080 Z" fill="#070D18"/>');
    g.push('<rect x="0" y="940" width="1920" height="140" fill="#0A1220"/>');
    g.push('<rect x="0" y="940" width="1920" height="3" fill="#3FD9FF" opacity="0.15"/>');
    return { defs: defs, group: g.join('') };
  }

  var SCENE_BUILDERS = {
    city: sceneCity,
    neon: sceneNeon,
    desert: sceneDesert,
    studio: sceneStudio,
    aurora: sceneAurora
  };

  function sceneSVG(p, scene) {
    var rand = mulberry32(scene === 'city' ? 101 : scene === 'neon' ? 202 : scene === 'desert' ? 303 : scene === 'studio' ? 404 : 505);
    var parts = SCENE_BUILDERS[scene](p, rand);
    return {
      defs: parts.defs,
      group: parts.group +
        '<rect x="0" y="0" width="1920" height="1080" fill="url(#' + p + 'vig)"/>'
    };
  }

  /* ============================ WALLPAPER FINAL ============================ */

  function wallpaperSVG(cfg, p, W, H) {
    cfg = normalizeConfig(cfg);
    W = W || 1920;
    H = H || 1080;
    var scene = sceneSVG(p, cfg.scene);
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 1920 1080" role="img" aria-label="Fond d\'écran voiture">');
    out.push('<defs>' + commonDefs(p, cfg.color) + scene.defs + '</defs>');
    out.push('<g>' + scene.group + '</g>');
    // voiture (vue de côté, centrée)
    out.push('<g transform="translate(103 182) scale(1.45)">' + carSide(cfg, p) + '</g>');
    // légende
    if (cfg.caption) {
      out.push('<rect x="860" y="936" width="200" height="4" rx="2" fill="' + cfg.color + '" opacity="0.9"/>');
      out.push('<text x="960" y="996" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ' +
        'font-size="46" font-weight="bold" letter-spacing="10" fill="#FFFFFF" opacity="0.94">' + esc(cfg.caption.toUpperCase()) + '</text>');
    }
    var lm = logoMeta(cfg);
    var bodyName = find(BODIES, cfg.body).name.toUpperCase();
    out.push('<text x="48" y="1040" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="6" fill="#FFFFFF" opacity="0.45">AUTO·WALL STUDIO</text>');
    out.push('<text x="1872" y="1040" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="4" fill="#FFFFFF" opacity="0.45">' +
      esc(lm.meta.name.toUpperCase() + ' ' + bodyName) + '</text>');
    out.push('</svg>');
    return out.join('');
  }

  /* ============================ EXPORTS ============================ */

  return {
    BODIES: BODIES,
    WHEELS: WHEELS,
    LOGOS: LOGOS,
    BADGES: BADGES,
    COLORS: COLORS,
    SCENES: SCENES,
    VIEWS: VIEWS,
    RESOLUTIONS: RESOLUTIONS,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    normalizeConfig: normalizeConfig,
    encodeConfig: encodeConfig,
    decodeConfig: decodeConfig,
    resolution: resolution,
    mix: mix,
    shade: shade,
    rgba: rgba,
    isLight: isLight,
    hexToRgb: hexToRgb,
    esc: esc,
    badgeSVG: badgeSVG,
    wheelSVG: wheelSVG,
    carSide: carSide,
    carFront: carFront,
    carRear: carRear,
    carTop: carTop,
    carView: carView,
    carViewSVG: carViewSVG,
    isolatedViewSVG: isolatedViewSVG,
    sceneSVG: sceneSVG,
    wallpaperSVG: wallpaperSVG,
    commonDefs: commonDefs
  };
});
