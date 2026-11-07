// =====================================================================
//  Desenho dos bonecos (SVG). FH_AVATAR(look, tamanho) devolve o <svg>.
//  look = { base, skin, shirt, hat, glasses, extra, photo, usePhoto }
// =====================================================================
(function () {
  let uid = 0;
  const SKINS = ['#f6d3b3', '#eab68c', '#c98d5e', '#a26a3f', '#6e4426', '#ffe0bd', '#9ad0ff', '#b8f2a0', '#f7a8d0', '#c9b6ff'];
  const SHIRTS = ['#2d7fe0', '#e8474c', '#2fae5b', '#f5c21b', '#8e44ad', '#ff7f2a', '#1abc9c', '#34495e', '#ecf0f1', '#ff5fa2'];
  const shade = (hex, p) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (p < 0 ? v * p : (255 - v) * p))));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  };
  const DEFAULT = { base: 'human', skin: SKINS[0], shirt: SHIRTS[0], hat: null, glasses: null, extra: null, photo: null, usePhoto: false };

  // ---------------- cabeças (centro 50,46 raio ~24) ----------------
  const eyes = (c = '#1b1b1b') => `<ellipse cx="41" cy="45" rx="3" ry="3.8" fill="${c}"/><ellipse cx="59" cy="45" rx="3" ry="3.8" fill="${c}"/>
    <circle cx="42" cy="43.6" r="1" fill="#fff"/><circle cx="60" cy="43.6" r="1" fill="#fff"/>`;
  const smile = `<path d="M42 55 Q50 62 58 55" stroke="#1b1b1b" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const cheeks = `<circle cx="36" cy="53" r="3.2" fill="#ff8a8a" opacity=".45"/><circle cx="64" cy="53" r="3.2" fill="#ff8a8a" opacity=".45"/>`;
  const HEADS = {
    human: (L, face) => `<circle cx="50" cy="46" r="24" fill="${L.skin}"/>
      <path d="M27 42 Q30 20 50 20 Q72 20 73 42 Q66 30 50 30 Q34 30 27 42Z" fill="${shade(L.skin, -0.55)}"/>${face ? eyes() + smile + cheeks : ''}`,
    robot: (L, face) => `<line x1="50" y1="22" x2="50" y2="12" stroke="#7f8c8d" stroke-width="3"/><circle cx="50" cy="11" r="4" fill="#e8474c"/>
      <rect x="27" y="22" width="46" height="46" rx="10" fill="#b5c0c8" stroke="#7f8c8d" stroke-width="2"/>
      <rect x="23" y="38" width="5" height="14" rx="2" fill="#7f8c8d"/><rect x="72" y="38" width="5" height="14" rx="2" fill="#7f8c8d"/>
      ${face ? `<rect x="35" y="38" width="10" height="9" rx="2" fill="#18e0ff"/><rect x="55" y="38" width="10" height="9" rx="2" fill="#18e0ff"/>
      <rect x="38" y="54" width="24" height="7" rx="2" fill="#4a5560"/><path d="M42 54v7M46 54v7M50 54v7M54 54v7M58 54v7" stroke="#b5c0c8" stroke-width="1.2"/>` : ''}`,
    alien: (L, face) => `<path d="M38 26 L30 10" stroke="#5aa86a" stroke-width="2.5"/><circle cx="30" cy="10" r="3.5" fill="#d6ff6b"/>
      <path d="M62 26 L70 10" stroke="#5aa86a" stroke-width="2.5"/><circle cx="70" cy="10" r="3.5" fill="#d6ff6b"/>
      <ellipse cx="50" cy="44" rx="25" ry="27" fill="#7bd389"/>
      ${face ? `<ellipse cx="40" cy="45" rx="7" ry="9" fill="#111" transform="rotate(-20 40 45)"/><ellipse cx="60" cy="45" rx="7" ry="9" fill="#111" transform="rotate(20 60 45)"/>
      <circle cx="38" cy="42" r="2" fill="#fff"/><circle cx="58" cy="42" r="2" fill="#fff"/><path d="M45 60 Q50 63 55 60" stroke="#1b1b1b" stroke-width="2" fill="none"/>` : ''}`,
    cat: (L, face) => `<path d="M28 34 L30 12 L46 24Z" fill="${L.skin}"/><path d="M72 34 L70 12 L54 24Z" fill="${L.skin}"/>
      <path d="M31 30 L32 18 L41 25Z" fill="#ff9fb3"/><path d="M69 30 L68 18 L59 25Z" fill="#ff9fb3"/>
      <circle cx="50" cy="46" r="24" fill="${L.skin}"/>
      ${face ? `<ellipse cx="41" cy="44" rx="3.5" ry="5" fill="#1b1b1b"/><ellipse cx="59" cy="44" rx="3.5" ry="5" fill="#1b1b1b"/>
      <path d="M47 52 L53 52 L50 55Z" fill="#ff7a93"/><path d="M50 55 Q46 60 42 57 M50 55 Q54 60 58 57" stroke="#1b1b1b" stroke-width="1.8" fill="none"/>
      <path d="M22 50 L36 52 M22 56 L36 55 M78 50 L64 52 M78 56 L64 55" stroke="#1b1b1b" stroke-width="1.2"/>` : ''}`,
    bear: (L, face) => `<circle cx="31" cy="27" r="9" fill="${shade(L.skin, -0.25)}"/><circle cx="69" cy="27" r="9" fill="${shade(L.skin, -0.25)}"/>
      <circle cx="31" cy="27" r="4.5" fill="#ffb3a1"/><circle cx="69" cy="27" r="4.5" fill="#ffb3a1"/>
      <circle cx="50" cy="46" r="24" fill="${shade(L.skin, -0.25)}"/><ellipse cx="50" cy="55" rx="11" ry="8.5" fill="${shade(L.skin, 0.35)}"/>
      ${face ? eyes() + `<ellipse cx="50" cy="51.5" rx="4" ry="3" fill="#1b1b1b"/><path d="M45 57 Q50 61 55 57" stroke="#1b1b1b" stroke-width="2" fill="none"/>` : ''}`,
    zombie: (L, face) => `<circle cx="50" cy="46" r="24" fill="#8fae7c"/><path d="M28 36 Q40 22 60 23 Q72 26 73 40 L66 33 L60 38 L54 30 L46 37 L40 30 L33 38Z" fill="#3d4a33"/>
      ${face ? `<circle cx="41" cy="46" r="5" fill="#fff"/><circle cx="41" cy="46" r="2" fill="#c0392b"/><circle cx="60" cy="46" r="3" fill="#fff"/><circle cx="60" cy="46" r="1.4" fill="#111"/>
      <path d="M40 58 L45 55 L50 59 L55 55 L60 58" stroke="#2c3e2a" stroke-width="2" fill="none"/><path d="M63 52 L69 58 M65 51 L63 56 M68 54 L66 59" stroke="#5a3d3d" stroke-width="1.2"/>` : ''}`,
    ninja: (L, face) => `<circle cx="50" cy="46" r="24" fill="#222"/><rect x="28" y="38" width="44" height="13" rx="6" fill="${L.skin}"/>
      <path d="M73 38 L86 30 L84 40Z" fill="#c0392b"/><rect x="26" y="33" width="48" height="5" fill="#c0392b"/>
      ${face ? `<path d="M37 45 Q41 41 45 45" stroke="#111" stroke-width="3" fill="none"/><path d="M55 45 Q59 41 63 45" stroke="#111" stroke-width="3" fill="none"/>` : ''}`,
    skeleton: (L, face) => `<circle cx="50" cy="44" r="24" fill="#f4f1e8"/><rect x="38" y="58" width="24" height="12" rx="4" fill="#f4f1e8"/>
      ${face ? `<ellipse cx="41" cy="44" rx="6" ry="7" fill="#1b1b1b"/><ellipse cx="59" cy="44" rx="6" ry="7" fill="#1b1b1b"/>
      <path d="M50 51 L47 56 L53 56Z" fill="#1b1b1b"/><path d="M41 61 H59 M44 59 V65 M48 59 V65 M52 59 V65 M56 59 V65" stroke="#1b1b1b" stroke-width="1.4"/>` : ''}`
  };

  // ---------------- chapéus ----------------
  const HATS = {
    cap: (L) => `<path d="M26 34 Q26 16 50 15 Q74 16 74 34Z" fill="${L.shirt}"/><path d="M50 32 Q70 30 88 36 Q72 38 52 36Z" fill="${shade(L.shirt, -0.3)}"/><circle cx="50" cy="16" r="2.5" fill="${shade(L.shirt, -0.3)}"/>`,
    beanie: () => `<path d="M25 36 Q24 12 50 12 Q76 12 75 36Z" fill="#e67e22"/><rect x="24" y="30" width="52" height="8" rx="3" fill="#d35400"/><circle cx="50" cy="9" r="5" fill="#f5c21b"/>`,
    party: () => `<path d="M38 26 L50 -4 L62 26Z" fill="#ff5fa2"/><path d="M42 18 L58 18 M45 10 L55 10" stroke="#f5c21b" stroke-width="3"/><circle cx="50" cy="-4" r="4" fill="#f5c21b"/>`,
    chef: () => `<rect x="33" y="14" width="34" height="14" fill="#fff" stroke="#ddd"/><circle cx="38" cy="10" r="9" fill="#fff"/><circle cx="50" cy="6" r="10" fill="#fff"/><circle cx="62" cy="10" r="9" fill="#fff"/>`,
    headphones: () => `<path d="M24 46 Q24 16 50 16 Q76 16 76 46" stroke="#222" stroke-width="5" fill="none"/><rect x="18" y="38" width="11" height="18" rx="5" fill="#e8474c"/><rect x="71" y="38" width="11" height="18" rx="5" fill="#e8474c"/><path d="M24 54 Q26 66 38 64" stroke="#222" stroke-width="2" fill="none"/><circle cx="39" cy="64" r="2.5" fill="#222"/>`,
    cowboy: () => `<ellipse cx="50" cy="27" rx="38" ry="7" fill="#8b5a2b"/><path d="M33 27 Q33 6 50 8 Q67 6 67 27Z" fill="#a0522d"/><rect x="33" y="21" width="34" height="4" fill="#5c3a1a"/>`,
    tophat: () => `<ellipse cx="50" cy="25" rx="30" ry="5" fill="#111"/><rect x="36" y="-4" width="28" height="29" rx="2" fill="#1b1b1b"/><rect x="36" y="16" width="28" height="5" fill="#e8474c"/>`,
    wizard: () => `<ellipse cx="50" cy="26" rx="32" ry="6" fill="#4b2c91"/><path d="M33 26 Q46 4 64 -10 Q60 10 67 26Z" fill="#6a3fc4"/><text x="47" y="20" font-size="9" fill="#f5c21b">★</text><text x="56" y="10" font-size="6" fill="#f5c21b">★</text>`,
    viking: () => `<path d="M26 34 Q26 14 50 14 Q74 14 74 34Z" fill="#95a5a6"/><rect x="26" y="30" width="48" height="6" fill="#7f8c8d"/><path d="M27 28 Q14 22 16 6 Q22 20 30 22Z" fill="#fdf2d0"/><path d="M73 28 Q86 22 84 6 Q78 20 70 22Z" fill="#fdf2d0"/>`,
    halo: () => `<ellipse cx="50" cy="12" rx="18" ry="5" fill="none" stroke="#ffd84f" stroke-width="4"/><ellipse cx="50" cy="12" rx="18" ry="5" fill="none" stroke="#fff6c4" stroke-width="1.2"/>`,
    crown: () => `<path d="M30 30 L30 10 L40 20 L50 6 L60 20 L70 10 L70 30Z" fill="#f5c21b" stroke="#c99a00" stroke-width="1.5"/><circle cx="50" cy="22" r="3" fill="#e8474c"/><circle cx="38" cy="25" r="2" fill="#2d7fe0"/><circle cx="62" cy="25" r="2" fill="#2fae5b"/>`
  };
  // ---------------- óculos ----------------
  const GLASSES = {
    round: () => `<g fill="none" stroke="#222" stroke-width="2"><circle cx="41" cy="45" r="7"/><circle cx="59" cy="45" r="7"/><path d="M48 45 H52 M34 44 L26 41 M66 44 L74 41"/></g>`,
    shades: () => `<path d="M31 40 H48 L46 50 Q40 53 34 50Z M52 40 H69 L66 50 Q60 53 54 50Z" fill="#111"/><path d="M48 42 H52 M31 41 L25 39 M69 41 L75 39" stroke="#111" stroke-width="2"/><path d="M35 43 L39 43" stroke="#fff" stroke-width="1.5" opacity=".6"/>`,
    heart: () => `<g fill="#ff3b6b"><path d="M41 52 L32 43 Q30 36 36 36 Q40 36 41 40 Q42 36 46 36 Q52 36 50 43Z"/><path d="M59 52 L50 43 Q48 36 54 36 Q58 36 59 40 Q60 36 64 36 Q70 36 68 43Z"/></g><path d="M30 41 L25 39 M70 41 L75 39" stroke="#ff3b6b" stroke-width="2"/>`,
    star: () => `<g fill="#f5c21b" stroke="#c99a00" stroke-width="1"><path d="M41 36 L43.5 42 L50 42.5 L45 46.5 L46.5 53 L41 49.5 L35.5 53 L37 46.5 L32 42.5 L38.5 42Z"/><path d="M59 36 L61.5 42 L68 42.5 L63 46.5 L64.5 53 L59 49.5 L53.5 53 L55 46.5 L50 42.5 L56.5 42Z"/></g>`,
    visor: () => `<rect x="27" y="39" width="46" height="11" rx="5" fill="#18e0ff" opacity=".85"/><rect x="27" y="39" width="46" height="4" rx="2" fill="#fff" opacity=".5"/>`,
    monocle: () => `<circle cx="59" cy="45" r="7" fill="#d6f3ff55" stroke="#c99a00" stroke-width="2"/><path d="M64 50 Q70 62 66 74" stroke="#c99a00" stroke-width="1" fill="none"/>`
  };
  // ---------------- acessórios ----------------
  const EXTRAS = {
    mustache: { front: () => `<path d="M50 54 Q42 49 35 55 Q40 58 50 56 Q60 58 65 55 Q58 49 50 54Z" fill="#3b2412"/>` },
    flower: { front: () => `<g transform="translate(70 26)"><circle r="4" cx="0" cy="-5" fill="#ff5fa2"/><circle r="4" cx="5" cy="0" fill="#ff5fa2"/><circle r="4" cx="0" cy="5" fill="#ff5fa2"/><circle r="4" cx="-5" cy="0" fill="#ff5fa2"/><circle r="3" fill="#f5c21b"/></g>` },
    bowtie: { front: () => `<path d="M50 74 L38 68 L38 80Z M50 74 L62 68 L62 80Z" fill="#e8474c"/><circle cx="50" cy="74" r="3" fill="#b71c1c"/>` },
    scarf: { front: () => `<path d="M30 70 Q50 78 70 70 L70 77 Q50 85 30 77Z" fill="#e8474c"/><rect x="56" y="74" width="8" height="20" rx="2" fill="#c0392b"/>` },
    beard: { front: () => `<path d="M28 48 Q30 74 50 76 Q70 74 72 48 Q66 60 58 58 Q50 62 42 58 Q34 60 28 48Z" fill="#4a2c17"/><path d="M43 57 Q50 62 57 57" stroke="#2a180b" stroke-width="2" fill="none"/>` },
    cape: { back: () => `<path d="M22 76 Q10 100 8 110 L92 110 Q90 100 78 76Z" fill="#c0392b"/>` },
    chain: { front: () => `<path d="M34 72 Q50 94 66 72" stroke="#f5c21b" stroke-width="3" fill="none" stroke-dasharray="3 1.5"/><circle cx="50" cy="88" r="5" fill="#f5c21b" stroke="#c99a00"/><text x="47.5" y="91" font-size="7" font-weight="900" fill="#8a6a00">$</text>` }
  };

  // ---------------- humor (carinhas) ----------------
  // mood: happy | party | sad | angry | furious | frozen | nervous
  function moodFace(m, L, photo) {
    const ec = L.base === 'robot' ? '#18e0ff' : (L.base === 'ninja' ? '#111' : '#1b1b1b');
    const st = (d, w = 2.6, c = ec) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    const eyesO = (r = 3.2) => `<ellipse cx="41" cy="45" rx="${r}" ry="${r + 0.8}" fill="${ec}"/><ellipse cx="59" cy="45" rx="${r}" ry="${r + 0.8}" fill="${ec}"/>`;
    const tint = (c, o) => `<circle cx="50" cy="46" r="24" fill="${c}" opacity="${o}"/>`;
    const cheeks = (c = '#ff6b6b', o = .5) => `<circle cx="35" cy="53" r="3.5" fill="${c}" opacity="${o}"/><circle cx="65" cy="53" r="3.5" fill="${c}" opacity="${o}"/>`;
    const eyes = photo ? '' : null;
    switch (m) {
      case 'happy': case 'party':
        return (photo ? '' : st('M36 46 Q41 40 46 46') + st('M54 46 Q59 40 64 46') + cheeks('#ff8a8a', .45)) +
          `<path d="M40 53 Q50 67 60 53 Z" fill="#7a1f1f" stroke="${photo ? '#fff' : 'none'}"/><path d="M44 59 Q50 63 56 59" fill="#ff7a8a"/>`;
      case 'sad':
        return (photo ? '' : eyesO(2.8)) + st('M35 39 L46 35', 2.4) + st('M54 35 L65 39', 2.4) +
          st('M42 60 Q50 53 58 60', 2.6, photo ? '#fff' : ec) + `<path d="M39 49 Q36.5 55 39 57.5 Q41.5 55 39 49Z" fill="#6ec6ff"/>`;
      case 'angry':
        return (photo ? '' : eyesO(2.8) + cheeks('#ff3b3b', .55)) + st('M34 35 L46 40', 3.2, '#3a1a0a') + st('M54 40 L66 35', 3.2, '#3a1a0a') +
          st('M42 59 Q50 54 58 59', 2.8, photo ? '#fff' : ec);
      case 'furious':
        return tint('#ff2a2a', photo ? .3 : .38) + (photo ? '' : eyesO(2.6)) + st('M33 34 L46 41', 3.6, '#2a0a00') + st('M54 41 L67 34', 3.6, '#2a0a00') +
          `<rect x="41" y="54" width="18" height="7" rx="2" fill="#fff" stroke="#2a0a00" stroke-width="1.5"/><path d="M47 54v7M53 54v7M41 57.5h18" stroke="#2a0a00" stroke-width="1"/>` +
          `<path d="M64 24 l4 3 -1 -5 4 1 -3 -4" stroke="#ff1a1a" stroke-width="2.4" fill="none"/>`;
      case 'frozen':
        return tint('#9fe3ff', photo ? .45 : .5) + (photo ? '' : `<circle cx="41" cy="45" r="4.5" fill="#fff" stroke="${ec}" stroke-width="1.5"/><circle cx="59" cy="45" r="4.5" fill="#fff" stroke="${ec}" stroke-width="1.5"/><circle cx="41" cy="45" r="1.6" fill="${ec}"/><circle cx="59" cy="45" r="1.6" fill="${ec}"/>`) +
          st('M40 58 q2.5 -3 5 0 t5 0 t5 0 t5 0', 2.2, photo ? '#fff' : '#1b4a6b') +
          `<path d="M30 63 l2 6 2 -6 M40 68 l1.5 5 1.5 -5 M58 68 l1.5 5 1.5 -5 M66 63 l2 6 2 -6" fill="#dff6ff" stroke="#bfefff"/>` +
          `<path d="M26 34 l4 2 M28 30 l1 5 M70 34 l4 -2 M72 30 l-1 5" stroke="#e6faff" stroke-width="1.6"/>`;
      case 'nervous':
        return (photo ? '' : `<circle cx="41" cy="45" r="4.2" fill="#fff" stroke="${ec}" stroke-width="1.4"/><circle cx="59" cy="45" r="4.2" fill="#fff" stroke="${ec}" stroke-width="1.4"/><circle cx="41" cy="46" r="1.5" fill="${ec}"/><circle cx="59" cy="46" r="1.5" fill="${ec}"/>`) +
          `<ellipse cx="50" cy="58" rx="3" ry="2.6" fill="${photo ? '#fff' : '#7a1f1f'}"/><path d="M67 33 Q64 39 67 41 Q70 39 67 33Z" fill="#6ec6ff"/>`;
    }
    return '';
  }

  function svg(lookIn, size = 64, opts = {}) {
    const L = Object.assign({}, DEFAULT, lookIn || {});
    if (!HEADS[L.base]) L.base = 'human';
    const id = 'av' + (++uid);
    const photo = L.usePhoto && L.photo;
    const ex = L.extra && EXTRAS[L.extra];
    const body = `<path d="M18 110 Q18 76 50 72 Q82 76 82 110Z" fill="${L.shirt}"/><path d="M42 72 Q50 80 58 72" fill="${shade(L.shirt, -0.25)}"/>
      <rect x="44" y="64" width="12" height="10" fill="${L.base === 'robot' ? '#7f8c8d' : (L.base === 'skeleton' ? '#e8e3d3' : (photo ? '#ddd' : (['alien', 'zombie'].includes(L.base) ? (L.base === 'alien' ? '#6bc07a' : '#7e9b6b') : L.skin)))}"/>`;
    const mood = opts.mood && opts.mood !== 'neutral' ? opts.mood : null;
    let head = HEADS[L.base](L, !photo && !mood);
    if (photo) {
      head += `<clipPath id="${id}c"><circle cx="50" cy="46" r="22"/></clipPath>
        <image href="${photo}" x="28" y="24" width="44" height="44" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}c)"/>
        <circle cx="50" cy="46" r="22" fill="none" stroke="#fff" stroke-width="2.5"/>`;
    }
    if (mood) head += moodFace(mood, L, !!photo);
    const parts = [
      ex && ex.back ? ex.back(L) : '',
      body,
      head,
      L.glasses && GLASSES[L.glasses] && !photo ? GLASSES[L.glasses](L) : '',
      ex && ex.front ? ex.front(L) : '',
      L.hat && HATS[L.hat] ? HATS[L.hat](L) : ''
    ];
    const vb = opts.bust ? '8 -12 84 100' : '0 -14 100 124';
    return `<svg class="boneco" viewBox="${vb}" width="${size}" height="${size * (opts.bust ? 100 / 84 : 1.24)}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
  }
  window.FH_AVATAR = { svg, SKINS, SHIRTS, DEFAULT };
})();
