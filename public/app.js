// =====================================================================
//  FAST HANDS v0.2 - parte do navegador
//  menu, loja, personalização, configurações, mesa, voz e memes
// =====================================================================
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && e.append(k));
  return e;
};
const SHOP = window.FH_CATALOG;
const AV = window.FH_AVATAR;

// ----------------------------- ARMAZENAMENTO LOCAL -----------------------------
const store = {
  get(k, def) { try { const v = localStorage.getItem('fh_' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('fh_' + k, JSON.stringify(v)); } catch (e) { toast('Não consegui salvar (memória cheia?)', true); } }
};
let PID = store.get('pid', null);
if (!PID) { PID = 'p' + Math.random().toString(36).slice(2, 12); store.set('pid', PID); }
const settings = Object.assign({
  sound: true, music: true, musicVol: 45, sfxVol: 80, memeVol: 90, voiceVol: 100, tts: false, slapSounds: true, memes: true,
  vibrate: true, cardSize: 1, fontScale: 1, table: 'green', anim: true, shortcuts: true
}, store.get('settings', {}));
const saveSettings = () => { store.set('settings', settings); applyUI(); };
let wallet = store.get('wallet', null);
let look = Object.assign({}, AV.DEFAULT, store.get('look', {}));
const saveLook = () => { store.set('look', look); socket.emit('profile', { look }); refreshProfileBits(); };
const myName = () => store.get('name', '') || 'Jogador';

const PHRASE_KINDS = { deboche: '😏 Deboche', msg: '💬 Mensagem', festa: '🎉 Comemoração' };
const DEFAULT_PHRASES = [
  ['Corta essa! ✋', 'deboche'], ['Segura esse +4 😈', 'deboche'], ['Chorou? 😭', 'deboche'], ['Foi fácil demais 😎', 'deboche'],
  ['Alguém tem azul aí?', 'msg'], ['Tava blefando 😅', 'msg'], ['Foi sem querer 🙏', 'msg'], ['Bora, joga logo!', 'msg'],
  ['GG! 🏆', 'festa'], ['Olha o FAST HAND!', 'msg'], ['Que sorte, hein…', 'deboche'], ['Vai devagar aí!', 'msg']];
let phrases = store.get('phrases', null);
if (!phrases) { phrases = DEFAULT_PHRASES.map(([t, k], i) => ({ id: 'f' + i, text: t, kind: k, on: i < 10 })); store.set('phrases', phrases); }
phrases.forEach(p => { if (!p.kind) p.kind = 'msg'; });
const savePhrases = () => store.set('phrases', phrases);
let presets = store.get('presets', []);           // modelos de regras do jogador
const savePresets = () => store.set('presets', presets);
const MAX_EQUIP = 10;

// ----------------------------- CONEXÃO (WebSocket) -----------------------------
const socket = (() => {
  const handlers = {}; let ws = null; let queue = []; let tries = 0;
  const api = {
    connected: false,
    on(e, f) { (handlers[e] = handlers[e] || []).push(f); },
    emit(e, d) { const m = JSON.stringify({ e, d }); if (ws && ws.readyState === 1) ws.send(m); else queue.push(m); }
  };
  const fire = (e, d) => (handlers[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(e, err); } });
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => { tries = 0; api.connected = true; fire('connect'); queue.forEach(m => ws.send(m)); queue = []; };
    ws.onmessage = (m) => { try { const { e, d } = JSON.parse(m.data); fire(e, d); } catch (err) { console.error(err); } };
    ws.onclose = () => { api.connected = false; fire('disconnect'); setTimeout(connect, Math.min(5000, 500 * ++tries)); };
  }
  connect();
  return api;
})();
const hello = () => socket.emit('hello', { pid: PID, name: myName(), wallet, look });

// ----------------------------- SONS (gerados, sem arquivos) -----------------------------
let actx = null;
function audioCtx() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
document.addEventListener('pointerdown', audioCtx, { once: true });
const vol = () => settings.sound ? settings.sfxVol / 100 : 0;
function tone(freqs, dur = 0.12, type = 'sine', v = 0.15, gap = 0) {
  if (!vol()) return;
  const c = audioCtx(); if (!c) return;
  let t = c.currentTime;
  for (const f of [].concat(freqs)) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(v * vol(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    t += gap || dur;
  }
}
function noise(dur = 0.15, v = 0.3, filterFreq = 0, delay = 0) {
  if (!vol()) return;
  const c = audioCtx(); if (!c) return;
  const b = c.createBuffer(1, Math.max(1, c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const s = c.createBufferSource(), g = c.createGain(); g.gain.value = v * vol();
  s.buffer = b;
  if (filterFreq) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = 0.9; s.connect(f).connect(g); }
  else s.connect(g);
  g.connect(c.destination); s.start(c.currentTime + delay);
}
function sweep(f1, f2, dur, type = 'sine', v = 0.3, delay = 0) {
  if (!vol()) return;
  const c = audioCtx(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(v * vol(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
const r = (a, b) => a + Math.random() * (b - a);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];
const pickNote = () => mtof(PENTA[Math.floor(Math.random() * PENTA.length)]);
const SFX = {
  play: () => { noise(0.05, 0.18, r(2500, 3500)); tone(pickNote(), 0.22, 'triangle', 0.09); },
  draw: () => tone([mtof(67), mtof(64)], 0.08, 'triangle', 0.09),
  myturn: () => tone([mtof(72), mtof(76), mtof(79)], 0.09, 'sine', 0.11),
  bad: () => { tone(mtof(47), 0.16, 'square', 0.05); tone(mtof(48), 0.16, 'square', 0.04); },
  freeze: () => { tone([mtof(96), mtof(91), mtof(88), mtof(84)], 0.07, 'triangle', 0.07); noise(0.25, 0.08, 7000); },
  thunder: () => { noise(0.9, 0.35, 120); noise(0.3, 0.2, 400, 0.05); },
  // batida na mesa: cada uma diferente (tom, filtro e peso variam)
  slap: (n = 1, total = 4, mine = false) => {
    if (!settings.slapSounds) return noise(0.12, 0.4);
    const heavy = n === 1 ? 1.4 : 1;
    noise(r(0.12, 0.22), (mine ? 0.75 : 0.55) * heavy, r(900, 2400));
    noise(0.05, 0.35, r(3000, 5000), 0.005);
    sweep(r(110, 150) * heavy, r(45, 60), r(0.18, 0.3), 'sine', 0.55 * heavy);
    if (n >= total - 1) sweep(220, 70, 0.4, 'triangle', 0.2, 0.03);
  },
  slapStart: () => { for (let i = 0; i < 10; i++) noise(0.04, 0.18 + i * 0.02, 600 + i * 90, i * 0.05); tone([880, 1175], 0.09, 'square', 0.06, 0.09); },
  slapLose: () => { sweep(392, 370, 0.28, 'sawtooth', 0.12); sweep(370, 349, 0.28, 'sawtooth', 0.12, 0.3); sweep(349, 260, 0.6, 'sawtooth', 0.12, 0.6); },
  last: () => tone([523, 659, 784, 1046], 0.09, 'sawtooth', 0.08),
  penalty: () => tone([400, 300, 200], 0.14, 'sawtooth', 0.08),
  jump: () => tone([300, 600, 1200], 0.06, 'square', 0.08),
  swap: () => tone([400, 800, 400, 800], 0.07, 'triangle', 0.1),
  silence: () => tone([300, 250], 0.25, 'sine', 0.12),
  win: () => tone([mtof(72), mtof(76), mtof(79), mtof(84), mtof(79), mtof(84)], 0.12, 'triangle', 0.13),
  coins: () => tone([mtof(88), mtof(91), mtof(96)], 0.07, 'square', 0.05),
  msg: () => tone(1200, 0.05, 'sine', 0.05)
};
// ----------------------------- MÚSICA (composta ao vivo, sem arquivos) -----------------------------
// Dó maior: Cmaj7 - Am7 - Fmaj7 - G6. Os sons das cartas usam as mesmas notas, então tudo combina.
const music = (() => {
  const PROG = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 52]];
  const MODES = {
    menu: { bpm: 78, kick: [], clap: [], hat: [6, 14], bass: [0, 10], arp: [0, 6, 12], arpOct: 24, padGain: 0.05 },
    game: { bpm: 100, kick: [0, 8, 10], clap: [4, 12], hat: [2, 6, 10, 14], bass: [0, 3, 8, 11], arp: [0, 3, 6, 8, 11, 14], arpOct: 24, padGain: 0.04 },
    tense: { bpm: 118, kick: [0, 4, 8, 12], clap: [4, 12], hat: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], bass: [0, 2, 4, 6, 8, 10, 12, 14], arp: [0, 2, 4, 6, 8, 10, 12, 14], arpOct: 24, padGain: 0.035 }
  };
  let mode = null, c = null, out = null, delay = null, timer = null, step = 0, nextTime = 0, duckUntil = 0;
  const level = () => (settings.sound && settings.music ? settings.musicVol / 100 : 0) * (Date.now() < duckUntil ? 0.35 : 1);
  function ensure() {
    c = audioCtx(); if (!c || out) return !!c;
    out = c.createGain(); out.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    delay = c.createDelay(); delay.delayTime.value = 0.36;
    const fb = c.createGain(); fb.gain.value = 0.28; const wet = c.createGain(); wet.gain.value = 0.25;
    delay.connect(fb).connect(delay); delay.connect(wet).connect(lp);
    out.connect(lp).connect(c.destination);
    return true;
  }
  const env = (g, t, a, peak, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); };
  function osc(type, f, t, dur, peak, a = 0.01, send = false, filt = 0) {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    let node = o; if (filt) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filt; o.connect(lp); node = lp; }
    node.connect(g); g.connect(out); if (send) g.connect(delay);
    env(g, t, a, peak, dur); o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseHit(t, dur, peak, type, f) {
    const b = c.createBuffer(1, Math.max(1, c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; fl.type = type; fl.frequency.value = f; s.connect(fl).connect(g).connect(out);
    env(g, t, 0.002, peak, dur); s.start(t);
  }
  function kick(t) {
    const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    o.connect(g).connect(out); env(g, t, 0.003, 0.32, 0.22); o.start(t); o.stop(t + 0.3);
  }
  function scheduleStep(st, t) {
    const M = MODES[mode], pos = st % 16, chord = PROG[Math.floor(st / 16) % 4], s16 = 60 / M.bpm / 4;
    if (pos === 0) chord.forEach((n, i) => { osc('triangle', mtof(n + 12), t, s16 * 16, M.padGain, 0.5, false, 1400); if (i % 2) osc('sine', mtof(n + 24) * 1.003, t, s16 * 16, M.padGain * 0.5, 0.8); });
    if (M.bass.includes(pos)) osc('sine', mtof(chord[0] - 12 + (pos === 11 || pos === 14 ? 7 : 0)), t, s16 * 3, 0.16, 0.01, false);
    if (M.kick.includes(pos)) kick(t);
    if (M.clap.includes(pos)) noiseHit(t, 0.1, 0.07, 'bandpass', 1600);
    if (M.hat.includes(pos)) noiseHit(t, 0.035, pos % 4 === 2 ? 0.05 : 0.025, 'highpass', 8000);
    if (M.arp.includes(pos)) {
      const idx = M.arp.indexOf(pos);
      const n = chord[(idx + Math.floor(st / 16)) % chord.length] + M.arpOct + (mode === 'menu' && Math.random() < 0.3 ? 2 : 0);
      osc('triangle', mtof(n), t, s16 * 2.5, mode === 'menu' ? 0.045 : 0.035, 0.005, true);
    }
  }
  function tick() {
    if (!c || !mode) return;
    out.gain.setTargetAtTime(level(), c.currentTime, 0.25);
    if (level() === 0) { nextTime = c.currentTime + 0.05; return; }
    if (nextTime < c.currentTime) nextTime = c.currentTime + 0.05;
    while (nextTime < c.currentTime + 0.15) { scheduleStep(step, nextTime); nextTime += 60 / MODES[mode].bpm / 4; step++; }
  }
  return {
    set(m) {
      if (m === mode) return;
      const firstBar = !mode || m === 'menu' || mode === 'menu';
      mode = m; if (firstBar) step = 0;
      if (ensure() && !timer) timer = setInterval(tick, 30);
    },
    start() { if (ensure() && !timer && mode) timer = setInterval(tick, 30); },
    duck(ms) { duckUntil = Date.now() + ms; }
  };
})();
document.addEventListener('pointerdown', () => music.start());
music.set('menu');

function buzz(ms) { if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

// ----------------------------- REGRAS -----------------------------
const RULES_META = [
  ['g', 'Cartas no baralho'],
  ['wild', 'Coringa (troca cor)', 'bool'], ['wild4', 'Coringa +4', 'bool'], ['draw2', 'Cartas +2', 'bool'],
  ['skip', 'Bloqueio', 'bool'], ['reverse', 'Inverter', 'bool'],
  ['g', 'Cartas especiais'],
  ['nine', '9 = Bater na mesa', 'bool', 'Todo mundo bate; o último (ou quem não bater) compra'],
  ['zero', '0 = Trocar a mão', 'bool', 'Quem joga troca as cartas com alguém'],
  ['zeroRotate', '0 = Todo mundo passa a mão pro lado', 'bool', 'Em vez de escolher com quem trocar'],
  ['seven', '7 = Silêncio', 'bool', 'Até o próximo jogar, só quem está na vez joga. Carta errada, jogar fora da vez ou mandar frase/meme = multa'],
  ['sevenChat', 'Silêncio do 7 bloqueia o chat também', 'bool'],
  ['g', 'Jogadas'],
  ['jumpIn', 'Cortar a vez', 'bool', 'Carta IDÊNTICA (cor e número) entra fora da vez'],
  ['stacking', 'Acumular +2 / +4', 'bool'], ['w4OnD2', 'Pode jogar +4 em cima de +2', 'bool'],
  ['d2OnW4', '+2 da cor escolhida em cima do +4', 'bool', 'Jogaram +4 e escolheram azul? Um +2 AZUL acumula e o próximo compra 6'],
  ['noWildFinish', 'Não pode bater com coringa', 'bool', 'A última carta não pode ser Coringa nem +4'],
  ['penaltyPlay', 'Comprou o +2/+4 e ainda joga', 'bool', 'Se tiver carta que serve, joga; se não, passa sozinho'],
  ['drawUntilPlay', 'Comprar até servir', 'bool'],
  ['g', 'Números'],
  ['handSize', 'Cartas iniciais', 'num', 3, 15], ['lastPenalty', 'Multa por não gritar FAST HAND!', 'num', 0, 6],
  ['sevenPenalty', 'Multa por quebrar o silêncio do 7', 'num', 0, 6],
  ['slapPenalty', 'Multa do 9 (último a bater)', 'num', 0, 6], ['turnTime', 'Tempo por jogada (seg, 0 = livre)', 'num', 0, 120],
  ['decks', 'Baralhos (0 = automático)', 'num', 0, 4]
];
let DEFAULT_RULES = { handSize: 7, wild: true, wild4: true, draw2: true, skip: true, reverse: true, nine: true, zero: true, zeroRotate: false,
  seven: true, sevenChat: false, jumpIn: true, stacking: true, w4OnD2: true, d2OnW4: true, noWildFinish: true, penaltyPlay: true, drawUntilPlay: false,
  lastPenalty: 2, sevenPenalty: 2, slapPenalty: 2, turnTime: 30, decks: 0 };
const ruleLabel = (k) => (RULES_META.find(x => x[0] === k) || [])[1] || k;
function renderRules(box, rules, editable, onChange) {
  box.innerHTML = '';
  box.classList.toggle('readonly', !editable);
  for (const [k, label, type, a, b] of RULES_META) {
    if (k === 'g') { box.append(h('div', { class: 'rule-group', text: label })); continue; }
    let inp;
    if (type === 'bool') { inp = h('input', { type: 'checkbox' }); inp.checked = !!rules[k]; }
    else inp = h('input', { type: 'number', min: a, max: b, value: rules[k] });
    if (!editable) inp.disabled = true;
    inp.addEventListener('change', () => {
      rules[k] = type === 'bool' ? inp.checked : Math.max(a, Math.min(b, Number(inp.value) || 0));
      onChange && onChange(rules);
    });
    const desc = type === 'bool' && a;
    box.append(h('label', { class: 'rule' }, h('span', {}, label, desc ? h('small', { text: desc }) : null), inp));
  }
}
function rulesSummary(rules) {
  const out = [];
  RULES_META.forEach(([k, label, type]) => {
    if (type === 'bool' && rules[k]) out.push(label.split(' (')[0]);
  });
  return out;
}
function showRules(rules, title) {
  const box = h('div', { class: 'rules' });
  renderRules(box, Object.assign({}, rules), false);
  modal([h('h3', { text: '📜 ' + (title || 'Regras da sala') }), box, h('button', { class: 'btn primary big', text: 'Fechar', onclick: closeModal })], 'rules');
}
function presetOptions(sel, current) {
  sel.innerHTML = '';
  sel.append(h('option', { value: '__default', text: '📜 Regras padrão' }));
  presets.forEach(p => sel.append(h('option', { value: p.id, text: '⭐ ' + p.name })));
  if (current) sel.value = current;
}
const presetRules = (id) => id === '__default' ? Object.assign({}, DEFAULT_RULES) : Object.assign({}, DEFAULT_RULES, (presets.find(p => p.id === id) || {}).rules);

// ----------------------------- UTILIDADES DE TELA -----------------------------
function applyUI() {
  document.documentElement.style.setProperty('--cardscale', settings.cardSize);
  document.documentElement.style.setProperty('--fontscale', settings.fontScale);
  document.body.dataset.table = settings.table;
  document.body.classList.toggle('noanim', !settings.anim);
  $('#gm-sound').textContent = settings.sound ? '🔊' : '🔈';
  $$('#audios audio').forEach(a => a.volume = settings.voiceVol / 100);
}
let screenStack = [];
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id));
  if (id !== 'scr-tut' && typeof tutClear === 'function') tutClear();
  const fn = { 'scr-tut': () => renderTut(), 'scr-home': renderHome, 'scr-play': renderPlay, 'scr-shop': renderShop, 'scr-custom': renderCustom, 'scr-settings': renderSettings }[id];
  if (fn && currentScreen !== id) fn();
  currentScreen = id;
  if (id !== 'scr-game') music.set('menu');
}
let currentScreen = 'scr-home';
function toast(msg, bad) {
  const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), text: msg });
  $('#toasts').append(t); setTimeout(() => t.remove(), 2600);
}
function shake(reason) {
  const el = $('#scr-game').classList.contains('hidden') ? $('#app') : $('#scr-game');
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  const f = $('#flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60);
  SFX.bad(); buzz(120);
  if (reason) toast(reason, true);
}
const COLORS_HEX = { r: '#e8474c', y: '#f5c21b', g: '#2fae5b', b: '#2d7fe0' };
const COLOR_PT = { r: 'Vermelho', y: 'Amarelo', g: 'Verde', b: 'Azul' };
const SYM = { skip: '⊘', rev: '⇄', d2: '+2', wild: '★', w4: '+4' };
function cardEl(c) {
  const s = SYM[c.value] || c.value;
  const el = h('div', { class: `card c-${c.color}` },
    h('i', { class: 'cn tl', text: s }), h('div', { class: 'gem' }, h('b', { text: s })), h('i', { class: 'cn br', text: s }));
  el.dataset.id = c.id;
  return el;
}
function modal(content, kind) {
  const body = $('#modal-body'); body.innerHTML = ''; body.append(...[].concat(content));
  $('#modal').classList.remove('hidden'); $('#modal').dataset.kind = kind || '';
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').dataset.kind = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !['over', 'name'].includes($('#modal').dataset.kind)) closeModal(); });
function tabs(group, onChange) {
  const box = $(`[data-tabs="${group}"]`);
  $$('[data-tab]', box).forEach(b => b.onclick = () => {
    $$('[data-tab]', box).forEach(x => x.classList.toggle('on', x === b));
    const scope = box.parentElement;
    $$(':scope [data-pane]', scope).forEach(p => { if (p.closest('[data-tabs]') !== box) p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab); });
    onChange && onChange(b.dataset.tab);
  });
}
const activeTab = (group) => $(`[data-tabs="${group}"] .on`).dataset.tab;
function seg(el, value, onPick) {
  $$('button', el).forEach(b => {
    b.classList.toggle('on', b.dataset.v === value);
    b.onclick = () => { $$('button', el).forEach(x => x.classList.toggle('on', x === b)); onPick(b.dataset.v); };
  });
}

// ----------------------------- ESTADO DO JOGO -----------------------------
let S = null;
let specMode = null;   // quem entra com partida rolando: 'watch' (assistir) ou 'wait' (esperar)
let clockOffset = 0;
let prev = { top: null, hand: new Set(), turn: null, chatLen: 0 };
const looks = {};       // aparência dos bonecos de cada jogador da sala
const meMember = () => S && S.members.find(m => m.id === PID);
const isHost = () => S && S.room.hostId === PID;
const nameOf = (id) => (S && (S.members.find(m => m.id === id) || {}).name) || '???';
const avatarOf = (id, size, bust) => { const d = h('div', { class: 'avatar-svg' }); d.innerHTML = AV.svg(id === PID ? look : (looks[id] || {}), size, { bust }); return d; };

// ----------------------------- MENU INICIAL -----------------------------
$$('[data-go]').forEach(b => b.onclick = () => { if (!store.get('name', '')) return askName(() => show(b.dataset.go)); show(b.dataset.go); });
$$('.back').forEach(b => b.onclick = () => show('scr-home'));
$('.profile-card').onclick = () => show('scr-custom');
function refreshProfileBits() {
  $$('.coins-v').forEach(e => e.textContent = wallet ? wallet.coins : 0);
  $('#home-name').textContent = myName();
  $('#home-avatar').innerHTML = AV.svg(look, 64, { bust: true });
  $('#home-stats').textContent = wallet ? `🎮 ${wallet.games} partidas · 🏆 ${wallet.wins} vitórias` : '';
}
function renderHome() { refreshProfileBits(); }
function askName(then) {
  const inp = h('input', { maxlength: 16, placeholder: 'Seu apelido', value: store.get('name', '') });
  const go = () => {
    const n = inp.value.trim(); if (!n) return shake('Digite um apelido');
    store.set('name', n); socket.emit('profile', { name: n }); closeModal(); refreshProfileBits(); then && then();
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  modal([h('h3', { text: '👋 Como quer ser chamado?' }), inp, h('button', { class: 'btn primary big', text: 'Confirmar', onclick: go })], 'name');
  setTimeout(() => inp.focus(), 50);
}

// ----------------------------- JOGAR -----------------------------
let lobbyRooms = [];
const searchReq = store.get('searchReq', {});
let createVis = 'public';
let createRules = Object.assign({}, DEFAULT_RULES);
tabs('play', (t) => { if (t === 'rooms' || t === 'search') socket.emit('lobby:list'); });
function renderPlay() {
  socket.emit('lobby:list');
  // --- buscar ---
  const box = $('#search-reqs'); box.innerHTML = '';
  RULES_META.filter(x => x[2] === 'bool').forEach(([k, label]) => {
    const s = h('div', { class: 'seg' },
      h('button', { 'data-v': 'any', text: 'Tanto faz' }), h('button', { class: 'yes', 'data-v': 'yes', text: 'Sim' }), h('button', { class: 'no', 'data-v': 'no', text: 'Não' }));
    seg(s, searchReq[k] || 'any', (v) => { if (v === 'any') delete searchReq[k]; else searchReq[k] = v; store.set('searchReq', searchReq); });
    box.append(h('div', { class: 'req' }, h('span', { text: label }), s));
  });
  // --- criar ---
  $('#cr-name').value = $('#cr-name').value || `Sala de ${myName()}`;
  presetOptions($('#cr-preset'), store.get('lastPreset', '__default'));
  createRules = presetRules($('#cr-preset').value);
  renderRules($('#cr-rules'), createRules, true);
  seg($('#cr-vis'), createVis, (v) => { createVis = v; visHelp(); });
  visHelp();
}
function visHelp() {
  $('#cr-pass-box').classList.toggle('hidden', createVis !== 'password');
  $('#cr-vis-help').textContent = { public: 'Aparece na lista e qualquer um entra.', password: 'Aparece na lista com 🔒 e só entra quem souber a senha.', hidden: 'Não aparece na lista. Só entra quem tiver o código ou o link de convite.' }[createVis];
}
$('#cr-preset').onchange = () => { store.set('lastPreset', $('#cr-preset').value); createRules = presetRules($('#cr-preset').value); renderRules($('#cr-rules'), createRules, true); };
$('#cr-max').oninput = () => $('#cr-max-v').textContent = $('#cr-max').value;
$('#cr-go').onclick = () => {
  if (createVis === 'password' && !$('#cr-pass').value.trim()) return shake('Digite uma senha');
  socket.emit('room:create', { name: $('#cr-name').value, visibility: createVis, password: $('#cr-pass').value, maxPlayers: Number($('#cr-max').value), rules: createRules });
};
$('#btn-join').onclick = () => { const c = $('#in-code').value.trim().toUpperCase(); if (c.length < 5) return shake('O código tem 5 letras'); socket.emit('room:join', { code: c }); };
$('#in-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-join').click(); });
$('#btn-refresh').onclick = () => socket.emit('lobby:list');
function matches(room) {
  if ($('#search-waiting').checked && room.inGame) return false;
  for (const [k, v] of Object.entries(searchReq)) if (!!room.rules[k] !== (v === 'yes')) return false;
  return true;
}
function roomItem(r) {
  const full = r.count >= r.max;
  const tags = rulesSummary(r.rules).slice(0, 6).map(t => h('span', { class: 'tag', text: t }));
  return h('div', { class: 'room-item' },
    h('div', { style: 'min-width:0' }, h('b', { text: (r.hasPassword ? '🔒 ' : '') + r.name }), h('br'),
      h('small', { text: `${r.count}/${r.max} jogadores · ${r.inGame ? '🎮 jogando' : '⏳ esperando'} · dono: ${r.host}` }), h('div', {}, tags)),
    h('div', { class: 'acts' },
      h('button', { class: 'btn small ghost', text: '📜 Regras', onclick: () => showRules(r.rules, 'Regras: ' + r.name) }),
      h('button', { class: 'btn small primary', disabled: full ? '' : false, text: full ? 'Cheia' : 'Entrar', onclick: () => socket.emit('room:join', { code: r.code }) })));
}
function renderRoomLists() {
  const box = $('#room-list'); box.innerHTML = '';
  if (!lobbyRooms.length) box.append(h('div', { class: 'muted', text: 'Nenhuma sala aberta agora. Crie a primeira!' }));
  lobbyRooms.forEach(r => box.append(roomItem(r)));
}
$('#btn-search').onclick = () => {
  socket.emit('lobby:list');
  setTimeout(() => {
    const box = $('#search-results'); box.innerHTML = '';
    const found = lobbyRooms.filter(r => !r.hasPassword && r.count < r.max && matches(r)).sort((a, b) => (a.inGame - b.inGame) || (b.humans - a.humans));
    if (!found.length) {
      box.append(h('div', { class: 'muted', text: 'Nenhuma sala com essas regras agora. 😕' }),
        h('button', { class: 'btn primary', text: '➕ Criar uma sala com essas regras', onclick: () => {
          Object.entries(searchReq).forEach(([k, v]) => { createRules[k] = v === 'yes'; });
          $('[data-tabs="play"] [data-tab="create"]').click();
          renderRules($('#cr-rules'), createRules, true);
          $('#cr-rules').closest('details').open = true;
          toast('Regras da busca aplicadas ✔');
        } }));
      return;
    }
    box.append(h('div', { class: 'muted tiny', text: `${found.length} sala(s) encontrada(s). A primeira é a melhor opção.` }));
    found.forEach(r => box.append(roomItem(r)));
  }, 350);
};
socket.on('lobby', (list) => { lobbyRooms = list; renderRoomLists(); });
socket.on('needPassword', ({ code, name, wrong }) => {
  const inp = h('input', { maxlength: 20, placeholder: 'Senha' });
  const go = () => { closeModal(); socket.emit('room:join', { code, password: inp.value }); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  modal([h('h3', { text: `🔒 ${name}` }), wrong ? h('div', { class: 'toast bad', text: 'Senha errada, tenta de novo' }) : h('div', { class: 'muted', text: 'Essa sala tem senha.' }),
    inp, h('div', { class: 'row gap' }, h('button', { class: 'btn ghost', text: 'Cancelar', onclick: closeModal }), h('button', { class: 'btn primary big', text: 'Entrar', onclick: go }))], 'pass');
  setTimeout(() => inp.focus(), 50);
});

// ----------------------------- LOJA -----------------------------
tabs('shop', () => renderShop());
function renderShop() {
  refreshProfileBits();
  const cat = activeTab('shop');
  const grid = $('#shop-grid'); grid.innerHTML = '';
  SHOP.CATALOG.filter(i => i.cat === cat).forEach(item => {
    const owned = wallet && wallet.owned.includes(item.id);
    const test = Object.assign({}, look, { usePhoto: cat === 'base' ? false : look.usePhoto });
    test[cat] = item.id;
    const equipped = look[cat] === item.id;
    const pv = h('div', { html: AV.svg(test, 96, { bust: true }) });
    const btn = owned
      ? h('button', { class: 'btn' + (equipped ? ' on' : ''), text: equipped ? '✔ Usando' : 'Usar', onclick: () => { look[cat] = equipped && cat !== 'base' ? null : item.id; if (cat === 'base') look.base = item.id; saveLook(); renderShop(); } })
      : h('button', { class: 'btn primary', text: `Comprar 🪙 ${item.price}`, onclick: () => buy(item) });
    grid.append(h('div', { class: 'shop-item' + (owned ? ' owned' : '') }, pv, h('div', { class: 'nm', text: item.name }),
      h('div', { class: 'price', text: owned ? '✔ Seu' : `🪙 ${item.price}` }), btn));
  });
}
function buy(item) {
  if (!wallet || wallet.coins < item.price) return shake(`Faltam ${item.price - (wallet ? wallet.coins : 0)} moedinhas. Bora jogar! 🎮`);
  modal([h('h3', { text: `Comprar ${item.name}?` }), h('div', { class: 'center', html: AV.svg(Object.assign({}, look, { [item.cat]: item.id }), 120, { bust: true }) }),
    h('div', { class: 'center', text: `Custa 🪙 ${item.price}. Você tem 🪙 ${wallet.coins}.` }),
    h('div', { class: 'row gap' }, h('button', { class: 'btn ghost', text: 'Cancelar', onclick: closeModal }),
      h('button', { class: 'btn primary big', text: 'Comprar', onclick: () => { closeModal(); socket.emit('shop:buy', { id: item.id }); } }))], 'buy');
}
socket.on('wallet', ({ wallet: w, gained, won, bought }) => {
  wallet = w; store.set('wallet', w);
  refreshProfileBits();
  $$('.coins-chip').forEach(c => { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); });
  if (bought) {
    const it = SHOP.byId[bought];
    look[it.cat] = it.id; saveLook();
    SFX.coins(); toast(`🎉 ${it.name} é seu! Já tá no seu boneco.`);
    if (currentScreen === 'scr-shop') renderShop();
  }
  if (gained) { SFX.coins(); lastGain = { gained, won }; const pop = $('#coin-pop'); if (pop) pop.textContent = `+${gained} 🪙 moedinhas${won ? ' (vitória!)' : ''}`; }
});
let lastGain = null;

// ----------------------------- PERSONALIZAR -----------------------------
tabs('custom');
function renderCustom() {
  refreshProfileBits();
  const pv = () => { $('#cu-preview').innerHTML = AV.svg(look, 200); $('#cu-name').textContent = myName(); };
  pv();
  const change = (k, v) => { look[k] = v; saveLook(); renderCustom(); };
  // --- boneco ---
  const L = $('#cu-look'); L.innerHTML = '';
  const optsFor = (cat, title, allowNone) => {
    const row = h('div', { class: 'opts' });
    if (allowNone) row.append(h('div', { class: 'opt none' + (!look[cat] ? ' on' : ''), title: 'Nenhum', text: '🚫', onclick: () => change(cat, null) }));
    SHOP.CATALOG.filter(i => i.cat === cat).forEach(i => {
      const owned = wallet && wallet.owned.includes(i.id);
      const test = Object.assign({}, look, { [cat]: i.id });
      const o = h('div', { class: 'opt' + (look[cat] === i.id ? ' on' : '') + (owned ? '' : ' locked'), title: i.name, html: AV.svg(test, 64, { bust: true }) });
      o.append(h('span', { text: i.name }));
      if (!owned) o.append(h('span', { class: 'lock', text: '🔒' }));
      o.onclick = () => owned ? change(cat, i.id) : (show('scr-shop'), $(`[data-tabs="shop"] [data-tab="${cat}"]`).click());
      row.append(o);
    });
    L.append(h('div', { class: 'opt-title', text: title }), row);
  };
  const swatches = (k, list, title) => {
    const row = h('div', { class: 'swatches' });
    list.forEach(c => row.append(h('span', { class: 'sw' + (look[k] === c ? ' on' : ''), style: `background:${c}`, onclick: () => change(k, c) })));
    const ci = h('input', { type: 'color', value: look[k] || '#ffffff', title: 'Escolher outra cor' });
    ci.onchange = () => change(k, ci.value);
    row.append(ci);
    L.append(h('div', { class: 'opt-title', text: title }), row);
  };
  optsFor('base', '🧍 Boneco');
  swatches('skin', AV.SKINS, '🎨 Cor da pele / pelo');
  swatches('shirt', AV.SHIRTS, '👕 Cor da roupa');
  optsFor('hat', '🎩 Chapéu', true);
  optsFor('glasses', '🕶️ Óculos', true);
  optsFor('extra', '✨ Acessório', true);
  L.append(h('div', { class: 'muted tiny', text: '🔒 = ainda não é seu. Clique pra ver na loja.' }));
  // --- foto ---
  const P = $('#cu-photo'); P.innerHTML = '';
  const prevBox = h('div', { class: 'photo-prev', style: look.photo ? `background-image:url(${look.photo})` : '' });
  const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  const cam = h('input', { type: 'file', accept: 'image/*', capture: 'user', style: 'display:none' });
  const load = (f) => {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 160;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
      look.photo = c.toDataURL('image/jpeg', 0.8); look.usePhoto = true; saveLook(); renderCustom(); toast('Foto colocada no rosto do boneco 📷');
    };
    img.src = URL.createObjectURL(f);
  };
  file.onchange = () => load(file.files[0]); cam.onchange = () => load(cam.files[0]);
  const use = h('input', { type: 'checkbox' }); use.checked = !!look.usePhoto; use.disabled = !look.photo;
  use.onchange = () => { look.usePhoto = use.checked; saveLook(); pv(); };
  P.append(h('div', { class: 'muted', text: 'Coloque uma foto do seu rosto (ou do que quiser 😂) dentro da cabeça do boneco. Ela aparece pra todo mundo na mesa.' }),
    prevBox, h('div', { class: 'row gap wrap', style: 'justify-content:center' },
      h('button', { class: 'btn primary', text: '🖼️ Escolher foto', onclick: () => file.click() }),
      h('button', { class: 'btn', text: '🤳 Tirar foto', onclick: () => cam.click() }),
      look.photo ? h('button', { class: 'btn ghost', text: '🗑 Remover', onclick: () => { look.photo = null; look.usePhoto = false; saveLook(); renderCustom(); } }) : null),
    h('label', { class: 'chk' }, use, 'Usar a foto no rosto do boneco'), file, cam,
    h('div', { class: 'muted tiny', text: 'Dica: use uma foto de rosto bem de frente. Ela é cortada num quadrado no meio.' }));
  renderSounds($('#cu-sounds'));
  renderPhrases($('#cu-phrases'));
}

// ----- sons (memes de áudio) -----
const memeDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const rq = indexedDB.open('fasthands', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('memes', { keyPath: 'id' });
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('memes', mode); const s = t.objectStore('memes'); const out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  return { all: () => tx('readonly', s => s.getAll()).catch(() => []), put: (m) => tx('readwrite', s => s.put(m)), del: (id) => tx('readwrite', s => s.delete(id)) };
})();
let memesCache = [];
memeDB.all().then(l => { memesCache = l || []; });
const audioDuration = (blob) => new Promise(res => {
  const a = new Audio(); a.preload = 'metadata';
  a.onloadedmetadata = () => {
    if (a.duration === Infinity) { a.currentTime = 1e7; a.ontimeupdate = () => { a.ontimeupdate = null; res(a.duration); }; }
    else res(a.duration);
  };
  a.onerror = () => res(0); a.src = URL.createObjectURL(blob);
});
let recorder = null;
async function renderSounds(box) {
  memesCache = await memeDB.all();
  box.innerHTML = '';
  const eq = memesCache.filter(m => m.on).length;
  const lbl = h('input', { maxlength: 30, placeholder: 'Nome do som (ex: "Risada do mal")' });
  const recBtn = h('button', { class: 'btn primary', text: '⏺ Gravar (até 10s)' });
  const file = h('input', { type: 'file', accept: 'audio/*', style: 'display:none' });
  const saveBlob = async (blob) => {
    if (blob.size > 1000000) return shake('Áudio grande demais (máx ~1 MB)');
    const d = await audioDuration(blob);
    if (d > 10.5) return shake(`Esse áudio tem ${Math.round(d)}s. O máximo é 10 segundos ✂️`);
    const label = lbl.value.trim() || `Som ${memesCache.length + 1}`;
    await memeDB.put({ id: 'm' + Date.now(), label, blob, on: eq < MAX_EQUIP });
    toast('Som salvo! 🎉'); renderSounds(box);
  };
  recBtn.onclick = async () => {
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); const rc = recorder; recorder = null; saveBlob(new Blob(chunks, { type: rc.mimeType || 'audio/webm' })); };
      recorder.start();
      recBtn.classList.add('rec'); let left = 10; recBtn.textContent = `⏹ Parar (${left}s)`;
      const iv = setInterval(() => { left--; if (recorder) recBtn.textContent = `⏹ Parar (${left}s)`; else clearInterval(iv); }, 1000);
      setTimeout(() => { clearInterval(iv); if (recorder && recorder.state === 'recording') recorder.stop(); }, 10000);
    } catch (e) { shake('Não consegui usar o microfone (permita no navegador)'); }
  };
  file.onchange = () => { if (file.files[0]) saveBlob(file.files[0]); };
  box.append(h('b', { text: `🔊 Meus sons (${eq}/${MAX_EQUIP} na partida)` }),
    h('div', { class: 'muted tiny', text: 'Grave ou envie quantos quiser (até 10 segundos cada). Marque até 10 pra aparecerem como botões na partida.' }),
    lbl, h('div', { class: 'row gap wrap' }, recBtn, h('button', { class: 'btn', text: '📁 Enviar arquivo de áudio', onclick: () => file.click() }), file));
  if (!memesCache.length) box.append(h('div', { class: 'muted', text: 'Nenhum som ainda. Grave o primeiro!' }));
  box.append(h('div', { class: 'lib-list' }, memesCache.map(m => {
    const c = h('input', { type: 'checkbox' }); c.checked = !!m.on;
    c.onchange = async () => { if (c.checked && memesCache.filter(x => x.on).length >= MAX_EQUIP) { c.checked = false; return shake(`Máximo ${MAX_EQUIP} na partida`); } m.on = c.checked; await memeDB.put(m); renderSounds(box); };
    return h('div', { class: 'lib-item' }, c, h('span', { class: 't', text: m.label }),
      h('button', { class: 'btn small', text: '▶', onclick: () => { const a = new Audio(URL.createObjectURL(m.blob)); a.volume = settings.memeVol / 100; a.play(); } }),
      h('button', { class: 'btn small ghost', text: '🗑', onclick: async () => { await memeDB.del(m.id); renderSounds(box); } }));
  })));
}
function renderPhrases(box) {
  box.innerHTML = '';
  const eq = phrases.filter(p => p.on).length;
  const inp = h('input', { maxlength: 80, placeholder: 'Nova frase… ex: "Hoje não, parceiro!"' });
  const kind = h('select', { class: 'select' }, Object.entries(PHRASE_KINDS).map(([k, v]) => h('option', { value: k, text: v })));
  const add = () => { const t = inp.value.trim(); if (!t) return; phrases.push({ id: 'f' + Date.now(), text: t, kind: kind.value, on: eq < MAX_EQUIP }); savePhrases(); renderPhrases(box); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  box.append(h('b', { text: `💬 Minhas frases (${eq}/${MAX_EQUIP} na partida)` }),
    h('div', { class: 'muted tiny', text: 'Deboches, mensagens e comemorações. Crie quantas quiser e marque até 10 pra usar na partida.' }),
    h('div', { class: 'row gap' }, inp, kind, h('button', { class: 'btn primary', text: 'Adicionar', onclick: add })));
  Object.entries(PHRASE_KINDS).forEach(([k, v]) => {
    const list = phrases.filter(p => p.kind === k); if (!list.length) return;
    box.append(h('div', { class: 'rule-group', text: v }), h('div', { class: 'lib-list' }, list.map(p => {
      const c = h('input', { type: 'checkbox' }); c.checked = p.on;
      c.onchange = () => { if (c.checked && phrases.filter(x => x.on).length >= MAX_EQUIP) { c.checked = false; return shake(`Máximo ${MAX_EQUIP} na partida`); } p.on = c.checked; savePhrases(); renderPhrases(box); };
      return h('div', { class: 'lib-item' }, c, h('span', { class: 't', text: p.text }),
        h('button', { class: 'btn small ghost', text: '🗑', onclick: () => { phrases = phrases.filter(x => x !== p); savePhrases(); renderPhrases(box); } }));
    })));
  });
}

// ----------------------------- CONFIGURAÇÕES -----------------------------
tabs('settings');
function renderSettings() {
  const chk = (key, label, after) => { const i = h('input', { type: 'checkbox' }); i.checked = !!settings[key]; i.onchange = () => { settings[key] = i.checked; saveSettings(); after && after(); }; return h('label', { class: 'chk' }, i, label); };
  const slider = (key, label) => {
    const v = h('b', { text: settings[key] + '%' });
    const i = h('input', { type: 'range', min: 0, max: 100, value: settings[key] });
    i.oninput = () => { settings[key] = Number(i.value); v.textContent = i.value + '%'; };
    i.onchange = () => { saveSettings(); SFX.slap(1, 4); };
    return h('div', { class: 'slider-row' }, h('span', { text: label }), i, v);
  };
  // geral
  const G = $('#st-general'); G.innerHTML = '';
  const nm = h('input', { maxlength: 16, value: myName() });
  nm.onchange = () => { const n = nm.value.trim(); if (!n) return; store.set('name', n); socket.emit('profile', { name: n }); refreshProfileBits(); toast('Nome salvo ✔'); };
  G.append(h('label', { text: 'Seu apelido' }), nm,
    chk('vibrate', '📳 Vibrar o celular (erro, sua vez, bater na mesa)'),
    chk('shortcuts', '⌨️ Atalhos de teclado no PC (C = comprar, F = FAST HAND!, Espaço = bater)'),
    h('div', { class: 'muted', text: wallet ? `🎮 ${wallet.games} partidas · 🏆 ${wallet.wins} vitórias · 🪙 ${wallet.coins} moedinhas` : '' }),
    h('div', { class: 'muted tiny', text: 'Seus itens e moedinhas ficam salvos neste aparelho/navegador.' }));
  // sons
  const So = $('#st-sound'); So.innerHTML = '';
  So.append(chk('sound', '🔊 Som ligado (tudo)'), chk('music', '🎵 Música de fundo'), slider('musicVol', 'Música'), slider('sfxVol', 'Efeitos'), slider('memeVol', 'Sons/memes dos outros'), slider('voiceVol', 'Voz das pessoas'),
    chk('memes', '😂 Tocar os sons/memes dos outros'), chk('slapSounds', '✋ Sons variados de batida na mesa'), chk('tts', '🗣️ Ler as frases em voz alta'));
  // interface
  const U = $('#st-ui'); U.innerHTML = '';
  const size = h('div', { class: 'seg' }, h('button', { 'data-v': '0.85', text: 'Pequenas' }), h('button', { 'data-v': '1', text: 'Médias' }), h('button', { 'data-v': '1.2', text: 'Grandes' }));
  seg(size, String(settings.cardSize), (v) => { settings.cardSize = Number(v); saveSettings(); });
  const tables = { green: '#11392a', blue: '#123457', purple: '#3a1d57', red: '#5a1a20', black: '#262626', wood: '#6b4423' };
  const tb = h('div', { class: 'swatches' }, Object.entries(tables).map(([k, c]) => h('span', { class: 'sw' + (settings.table === k ? ' on' : ''), style: `background:${c};width:44px;height:44px`, title: k, onclick: () => { settings.table = k; saveSettings(); renderSettings(); } })));
  const cardPrev = h('div', { class: 'row gap', style: 'justify-content:center;padding:10px;border-radius:12px;background:radial-gradient(var(--felt),var(--felt2))' }, cardEl({ id: 'x', color: 'r', value: '7' }), cardEl({ id: 'y', color: 'w', value: 'w4' }), cardEl({ id: 'z', color: 'b', value: 'rev' }));
  const fs = h('div', { class: 'seg' }, h('button', { 'data-v': '0.9', text: 'Pequena' }), h('button', { 'data-v': '1', text: 'Normal' }), h('button', { 'data-v': '1.15', text: 'Grande' }), h('button', { 'data-v': '1.3', text: 'Enorme' }));
  seg(fs, String(settings.fontScale), (v) => { settings.fontScale = Number(v); saveSettings(); });
  U.append(h('div', { class: 'opt-title', text: '🔠 Tamanho das letras' }), fs, h('div', { class: 'opt-title', text: '🃏 Tamanho das cartas' }), size, h('div', { class: 'opt-title', text: '🟩 Cor da mesa' }), tb, cardPrev,
    chk('anim', '✨ Animações'));
  // regras
  renderPresetList();
}
function renderPresetList() {
  const R = $('#st-rules'); R.innerHTML = '';
  R.append(h('div', { class: 'muted', text: 'Crie seus próprios conjuntos de regras do jeito que quiser. Eles aparecem na hora de criar uma sala.' }),
    h('button', { class: 'btn primary', text: '➕ Criar novo conjunto de regras', onclick: () => editPreset(null) }),
    h('div', { class: 'preset-item' }, h('span', { class: 't', text: '📜 Regras padrão' }), h('button', { class: 'btn small ghost', text: 'Ver', onclick: () => showRules(DEFAULT_RULES, 'Regras padrão') })));
  presets.forEach(p => R.append(h('div', { class: 'preset-item' }, h('span', { class: 't', text: '⭐ ' + p.name }),
    h('button', { class: 'btn small', text: '✏️ Editar', onclick: () => editPreset(p) }),
    h('button', { class: 'btn small ghost', text: '🗑', onclick: () => { presets = presets.filter(x => x !== p); savePresets(); renderPresetList(); } }))));
}
function editPreset(p) {
  const rules = Object.assign({}, DEFAULT_RULES, p ? p.rules : {});
  const nm = h('input', { maxlength: 30, placeholder: 'Nome (ex: "Caos total", "Família")', value: p ? p.name : '' });
  const box = h('div', { class: 'rules' }); renderRules(box, rules, true);
  modal([h('h3', { text: p ? 'Editar regras' : 'Novo conjunto de regras' }), nm, box,
    h('div', { class: 'row gap' }, h('button', { class: 'btn ghost', text: 'Cancelar', onclick: closeModal }),
      h('button', { class: 'btn primary big', text: 'Salvar', onclick: () => {
        const n = nm.value.trim(); if (!n) return shake('Dê um nome');
        if (p) { p.name = n; p.rules = rules; } else presets.push({ id: 'r' + Date.now(), name: n, rules });
        savePresets(); closeModal(); renderPresetList(); toast('Regras salvas ✔');
      } }))], 'preset');
}

// ----------------------------- SALA DE ESPERA -----------------------------
$('#lb-leave').onclick = leaveRoom;
$('#lb-watch').onclick = () => { specMode = 'watch'; renderGame(); };
$('#lb-addbot').onclick = () => socket.emit('room:addBot');
$('#lb-start').onclick = () => socket.emit('game:start');
$('#lb-copy').onclick = () => {
  const link = `${location.origin}/?sala=${S.room.code}`;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Convite copiado! Mande pros amigos 😉'))
    .catch(() => prompt('Copie o convite:', link));
};
$('#lb-max').oninput = () => { $('#lb-max-v').textContent = $('#lb-max').value; };
$('#lb-max').onchange = () => socket.emit('room:settings', { maxPlayers: Number($('#lb-max').value) });
$('#lb-preset').onchange = () => { const v = $('#lb-preset').value; if (v) socket.emit('room:settings', { rules: presetRules(v) }); };
function leaveRoom() { specMode = null; voice.leave(); voiceSeen.clear(); socket.emit('room:leave'); S = null; closeModal(); show('scr-play'); }

function renderLobby() {
  if (currentScreen !== 'scr-lobby') { $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== 'scr-lobby')); currentScreen = 'scr-lobby'; }
  const rm = S.room;
  $('#lb-name').textContent = rm.name;
  $('#lb-code').textContent = rm.code;
  $('#lb-vis').textContent = { public: '🌎 Pública', password: '🔒 Com senha', hidden: '🙈 Só convite' }[rm.visibility];
  $('#lb-count').textContent = `(${S.members.length}/${rm.maxPlayers})`;
  $$('.host-only').forEach(e => e.classList.toggle('hidden', !isHost()));
  $$('.not-host').forEach(e => e.classList.toggle('hidden', isHost()));
  $('#lb-max').value = rm.maxPlayers; $('#lb-max-v').textContent = rm.maxPlayers;
  seg($('#lb-vis-seg'), rm.visibility, (v) => {
    if (v === 'password') {
      const inp = h('input', { maxlength: 20, placeholder: 'Senha' });
      modal([h('h3', { text: '🔒 Senha da sala' }), inp, h('button', { class: 'btn primary big', text: 'Salvar', onclick: () => { closeModal(); socket.emit('room:settings', { visibility: 'password', password: inp.value }); } })], 'pw');
    } else socket.emit('room:settings', { visibility: v });
  });
  const box = $('#lb-members'); box.innerHTML = '';
  for (const m of S.members) {
    box.append(h('div', { class: 'member' + (m.connected ? '' : ' off') }, avatarOf(m.id, 34, true),
      h('span', { class: 'nm', text: `${m.name}${m.id === PID ? ' (você)' : ''}` }),
      m.id === rm.hostId ? h('span', { title: 'Dono da sala', text: '👑' }) : null,
      m.voiceOn ? h('span', { text: m.muted ? '🔇' : '🎙️' }) : null,
      m.wins ? h('span', { class: 'muted tiny', text: `🏆${m.wins}` }) : null,
      isHost() && m.id !== PID ? h('button', { class: 'btn small ghost', text: '✕', title: 'Remover', onclick: () => socket.emit('room:kick', { id: m.id }) }) : null));
  }
  const key = JSON.stringify(rm.rules) + isHost();
  if ($('#lb-rules').dataset.key !== key) {
    $('#lb-rules').dataset.key = key;
    presetOptions($('#lb-preset'));
    $('#lb-preset').insertBefore(h('option', { value: '', text: '— aplicar um conjunto de regras —' }), $('#lb-preset').firstChild);
    $('#lb-preset').value = '';
    renderRules($('#lb-rules'), Object.assign({}, rm.rules), isHost(), (nr) => socket.emit('room:settings', { rules: nr }));
  }
}

// ----------------------------- CHAT -----------------------------
$$('.chat-form').forEach(f => f.addEventListener('submit', (e) => {
  e.preventDefault(); const i = $('input', f); const t = i.value.trim();
  if (t) socket.emit('chat', { text: t }); i.value = '';
}));
function renderChat() {
  const items = S.chat.map(c => ({ t: c.t || 0, el: c.sys ? h('div', { class: 'sys', text: c.text }) : h('div', {}, h('b', { text: c.name + ': ' }), c.text) }));
  if (S.game) S.game.log.forEach(l => items.push({ t: l.t, el: h('div', { class: 'log', text: '• ' + l.text }) }));
  items.sort((a, b) => a.t - b.t);
  for (const box of $$('.chat-box')) {
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = ''; items.forEach(i => box.append(i.el.cloneNode(true)));
    if (atBottom) box.scrollTop = box.scrollHeight;
  }
  const n = S.chat.filter(c => !c.sys).length;
  if (n > prev.chatLen && prev.chatLen && S.chat[S.chat.length - 1].from !== PID) {
    if ($('#side').classList.contains('hidden')) $('#chat-dot').classList.remove('hidden');
    SFX.msg();
  }
  prev.chatLen = n;
}
$('#gm-chat').onclick = () => { $('#side').classList.toggle('hidden'); $('#chat-dot').classList.add('hidden'); const b = $('.game-chat'); b.scrollTop = b.scrollHeight; };
$('#side-close').onclick = () => $('#side').classList.add('hidden');

// ----------------------------- PARTIDA -----------------------------
function localCanPlay(g, c, rules) {
  if (rules.noWildFinish && g.hand && g.hand.length === 1 && c.color === 'w') return false;
  if (g.pending > 0) {
    if (g.pendingType === 'd2') return c.value === 'd2' || (c.value === 'w4' && rules.w4OnD2);
    if (g.pendingType === 'w4') return c.value === 'w4' || (c.value === 'd2' && rules.d2OnW4 && c.color === g.color);
    return false;
  }
  if (c.color === 'w') return true;
  return c.color === g.color || c.value === g.top.value;
}
let seatLooksKey = '';
function renderGame() {
  if (currentScreen !== 'scr-game') { $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== 'scr-game')); currentScreen = 'scr-game'; }
  const g = S.game, rm = S.room;
  const me = meMember();
  $('#gm-room').textContent = `${rm.name} · ${rm.code}`;

  // --- assentos com bonecos ---
  const inGame = g.order.includes(PID);
  let others = g.order.slice();
  if (inGame) { const i = others.indexOf(PID); others = others.slice(i + 1).concat(others.slice(0, i)); }
  const seats = $('#seats');
  const keep = {};
  $$('.seat', seats).forEach(s => keep[s.dataset.id] = s);
  const k = others.length;
  const narrow = $('#table').clientWidth < 700;
  const lk = JSON.stringify(Object.keys(looks).map(id => [id, (S.members.find(m => m.id === id) || {}).lv]));
  const ti = g.order.indexOf(g.turn), nn = g.order.length;
  const nextId = g.phase === 'play' && ti >= 0 ? g.order[(((ti + g.dir) % nn) + nn) % nn] : null;
  others.forEach((id, i) => {
    const m = S.members.find(x => x.id === id) || { id, name: '?' };
    const a = Math.PI + ((i + 1) / (k + 1)) * Math.PI;
    let rx = 44, ry = 40;
    if (k > 7 && narrow && i % 2) { rx *= 0.7; ry *= 0.62; }
    const x = 50 + rx * Math.cos(a), y = 55 + (ry - 4) * Math.sin(a);
    let s = keep[id]; delete keep[id];
    if (!s) { s = h('div', { class: 'seat' }); s.dataset.id = id; seats.append(s); }
    s.style.left = x + '%'; s.style.top = y + '%';
    s.className = 'seat' + (g.turn === id && g.phase === 'play' ? ' turn' : '') + (nextId === id ? ' next' : '') + (m.connected ? '' : ' off') + (speaking[id] ? ' speaking' : '');
    const bubble = $('.bubble', s);
    let av = $('.av', s);
    if (!av || av.dataset.lv !== String(m.lv) + lk) {
      av = h('div', { class: 'av' }, avatarOf(id, 52, true)); av.dataset.lv = String(m.lv) + lk;
    }
    $$('.badge,.vc', av).forEach(e => e.remove());
    if (m.count === 1) av.append(h('span', { class: 'badge' + (m.called ? ' ok' : ''), text: m.called ? 'FAST!' : '1' }));
    if (m.voiceOn) av.append(h('span', { class: 'vc', text: m.muted ? '🔇' : '🎙️' }));
    s.innerHTML = '';
    if (g.turn === id && g.phase === 'play') s.append(h('div', { class: 'turn-tag', text: '▶ VEZ DELE' }));
    else if (nextId === id) s.append(h('div', { class: 'next-tag', text: 'próximo' }));
    s.append(av, h('div', { class: 'nm', text: m.name + (rm.hostId === id ? ' 👑' : '') }),
      h('div', { class: 'cnt' }, h('span', { class: 'mini' }), String(m.count)));
    if (bubble) s.append(bubble);
  });
  Object.values(keep).forEach(s => s.remove());
  // meu boneco perto das cartas
  const meAv = $('#me-av');
  if (inGame) { meAv.classList.remove('hidden'); if (!$('.avatar-svg', meAv)) meAv.append(h('div', { class: 'avatar-svg' })); }
  else meAv.classList.add('hidden');
  allMoods(true);
  // música acompanha o clima da partida
  const tense = g.phase === 'slap' || g.pending >= 4 || S.members.some(m => m.inGame && m.count === 1);
  music.set(g.phase === 'over' ? 'menu' : (tense ? 'tense' : 'game'));

  // --- mesa ---
  const d = $('#discard');
  if (prev.top !== g.top.id) {
    const c = cardEl(g.top); c.classList.add('new');
    c.style.transform = `rotate(${(Math.random() * 16 - 8).toFixed(1)}deg)`;
    d.append(c); while (d.children.length > 4) d.firstChild.remove();
    prev.top = g.top.id;
  }
  $('#draw-count').textContent = g.drawCount;
  $('#color-dot').style.background = COLORS_HEX[g.color] || '#fff';
  $('#dir').className = 'dir' + (g.dir < 0 ? ' ccw' : '');
  $('#pending').classList.toggle('hidden', !g.pending);
  $('#pending').textContent = `+${g.pending}`;
  $('#silence').classList.toggle('hidden', !(g.silence && g.phase === 'play'));

  const myTurn = g.turn === PID && g.phase === 'play';
  const st = $('#status');
  if (g.phase === 'over') st.textContent = `🏆 ${nameOf(g.winner)} venceu!`;
  else if (g.phase === 'slap') st.textContent = '✋ BATE NA MESA!';
  else if (myTurn) st.textContent = g.pending ? `SUA VEZ! Acumule ou compre +${g.pending}` : (g.penaltyDrawn ? 'Comprou! Ainda pode jogar ou passar' : (g.hasDrawn ? 'Jogue a carta comprada ou passe' : 'SUA VEZ!'));
  else { st.textContent = ''; st.append(avatarOf(g.turn, 26, true), h('span', { text: `Vez de ${nameOf(g.turn)}` })); }
  st.classList.toggle('me', myTurn);
  st.classList.toggle('other', !myTurn && g.phase === 'play');
  // seta no meio da mesa apontando pra quem joga
  const arrow = $('#turn-arrow');
  if (g.phase === 'play') {
    const t = $('#table').getBoundingClientRect(), mid = $('.piles').getBoundingClientRect();
    const cx = mid.left - t.left + mid.width / 2, cy = mid.top - t.top + mid.height / 2;
    let tx = t.width / 2, ty = t.height + 60;
    const seatEl = $(`.seat[data-id="${g.turn}"]`);
    if (!myTurn && seatEl) { const b = seatEl.getBoundingClientRect(); tx = b.left - t.left + b.width / 2; ty = b.top - t.top + b.height / 2; }
    const ang = Math.atan2(ty - cy, tx - cx) * 180 / Math.PI;
    arrow.style.left = cx + 'px'; arrow.style.top = cy + 'px';
    arrow.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;
    arrow.classList.remove('hidden'); arrow.classList.toggle('mine', myTurn);
  } else arrow.classList.add('hidden');
  $('.bottom').classList.toggle('myturn', myTurn);

  if (myTurn && prev.turn !== PID) { SFX.myturn(); buzz(60); }
  prev.turn = g.phase === 'play' ? g.turn : prev.turn;

  // --- minha mão (SEM destacar as cartas que podem ser jogadas!) ---
  const hand = $('#hand');
  const cards = g.hand || [];
  const newSet = new Set(cards.map(c => c.id));
  hand.innerHTML = '';
  hand.classList.toggle('many', cards.length > 10);
  if (!inGame) hand.append(h('div', { class: 'row gap' }, h('span', { class: 'muted', text: '👀 Você está assistindo. Entra na próxima rodada!' }),
    g.phase !== 'over' ? h('button', { class: 'btn small', text: '⏳ Esperar no chat', onclick: () => { specMode = 'wait'; renderLobby(); } }) : null));
  for (const c of cards) {
    const el = cardEl(c);
    if (!prev.hand.has(c.id)) el.classList.add('fresh');
    if (myTurn && g.hasDrawn && c.id === g.drawnCardId) el.classList.add('drawn');
    el.onclick = () => tryPlay(c);
    hand.append(el);
  }
  prev.hand = newSet;

  $('#btn-pass').classList.toggle('hidden', !(myTurn && g.hasDrawn));
  $('#btn-last').disabled = !(inGame && cards.length === 1 && me && !me.called && g.phase !== 'over');

  // --- 9: bater na mesa ---
  const slap = $('#slap');
  if (g.phase === 'slap' && inGame) {
    slap.classList.remove('hidden');
    const done = g.slap.pressed.includes(PID);
    $('#btn-slap').classList.toggle('done', done);
    $('#btn-slap').textContent = done ? '✔' : '✋';
    $('#slap-info').textContent = `${g.slap.pressed.length}/${g.order.length} já bateram`;
  } else slap.classList.add('hidden');

  // --- fim da rodada ---
  if (g.phase === 'over') {
    if ($('#modal').dataset.kind !== 'over') {
      const ranking = S.members.slice().sort((a, b) => b.wins - a.wins);
      modal([
        h('div', { class: 'center', html: AV.svg(g.winner === PID ? look : (looks[g.winner] || {}), 110) }),
        h('div', { class: 'win-title', text: `🏆 ${nameOf(g.winner)} venceu!` }),
        h('div', { id: 'coin-pop', class: 'coin-pop', text: lastGain ? `+${lastGain.gained} 🪙 moedinhas${lastGain.won ? ' (vitória!)' : ''}` : '' }),
        h('div', { class: 'members' }, ranking.map(m => h('div', { class: 'member' }, avatarOf(m.id, 34, true), h('span', { class: 'nm', text: m.name }), h('b', { text: `🏆 ${m.wins}` })))),
        isHost() ? h('div', { class: 'row gap' },
          h('button', { class: 'btn ghost', text: 'Voltar pra sala', onclick: () => { closeModal(); socket.emit('game:stop'); } }),
          h('button', { class: 'btn primary big', text: '▶ Nova rodada', onclick: () => { closeModal(); socket.emit('game:start'); } }))
          : h('div', { class: 'muted center', text: 'Esperando o dono da sala começar outra…' })
      ], 'over');
      lastGain = null;
    }
  } else if ($('#modal').dataset.kind === 'over') closeModal();
  if (g.phase !== 'play' && ['color', 'target'].includes($('#modal').dataset.kind)) closeModal();
  renderQuickbar();
}

function tryPlay(c) {
  const g = S.game; if (!g) return;
  if (g.phase !== 'play') return shake();
  const rules = S.room.rules;
  const myTurn = g.turn === PID;
  // Silêncio do 7: carta errada ou jogar fora da vez = "falou" → o servidor aplica a multa
  const silent = g.silence && rules.seven && (rules.sevenPenalty || 0) > 0;
  const tellServer = () => { if (silent) socket.emit('play', { cardId: c.id }); };
  if (!myTurn) {
    const t = g.top;
    const jump = rules.jumpIn && !g.silence && !g.pending && t.color !== 'w' && c.color === t.color && c.value === t.value;
    if (!jump) { if (silent) return tellServer(); return shake(g.silence ? '🤫 Silêncio do 7!' : null); }
  } else {
    if (g.hasDrawn && !g.penaltyDrawn && !rules.drawUntilPlay && c.id !== g.drawnCardId) { if (silent) return tellServer(); return shake('Só a carta que você comprou'); }
    if (rules.noWildFinish && g.hand.length === 1 && c.color === 'w') { if (silent) return tellServer(); return shake('Não pode bater com coringa! Compre uma carta 🃏'); }
    if (!localCanPlay(g, c, rules)) { if (silent) return tellServer(); return shake(); }
  }
  const send = (extra = {}) => socket.emit('play', Object.assign({ cardId: c.id }, extra));
  const needTarget = c.value === '0' && rules.zero && !rules.zeroRotate && g.order.length > 1;
  const pickTarget = (extra) => {
    if (!needTarget) return send(extra);
    const others = g.order.filter(id => id !== PID);
    modal([h('h3', { text: '🔀 Trocar a mão com quem?' }),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', text: '🙅 Não trocar com ninguém', onclick: () => { closeModal(); send(Object.assign({ target: 'none' }, extra)); } }),
        h('button', { class: 'btn', text: '🔄 Todos passam a mão (no sentido do jogo)', onclick: () => { closeModal(); send(Object.assign({ target: 'all' }, extra)); } })),
      h('div', { class: 'muted tiny', text: 'Ou escolha uma pessoa pra trocar só com ela:' }),
      h('div', { class: 'targets' }, others.map(id => {
        const m = S.members.find(x => x.id === id) || { id, name: '?', count: 0 };
        return h('button', { class: 'btn row gap', onclick: () => { closeModal(); send(Object.assign({ target: id }, extra)); } },
          avatarOf(id, 28, true), `${m.name} — ${m.count} carta${m.count === 1 ? '' : 's'}`);
      }))], 'target');
  };
  if (c.color === 'w') {
    modal([h('h3', { text: 'Escolha a cor' }),
      h('div', { class: 'colors' }, ['r', 'y', 'g', 'b'].map(k => h('button', { style: `background:${COLORS_HEX[k]}`, text: COLOR_PT[k], onclick: () => { closeModal(); pickTarget({ color: k }); } })))], 'color');
  } else pickTarget();
}
$('#draw-pile').onclick = () => {
  const g = S && S.game; if (!g) return;
  if (g.turn !== PID || g.phase !== 'play') return shake('Não é sua vez');
  if (g.hasDrawn && !g.pending) return shake('Você já comprou — jogue ou passe');
  socket.emit('draw');
};
$('#btn-pass').onclick = () => socket.emit('pass');
$('#btn-last').onclick = () => socket.emit('last');
$('#btn-slap').onclick = () => socket.emit('slap');
document.addEventListener('keydown', (e) => {
  if (!settings.shortcuts || !S || !S.game || /input|textarea|select/i.test(document.activeElement.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); if (S.game.phase === 'slap') socket.emit('slap'); }
  if (e.key === 'f' || e.key === 'F' || e.key === 'l' || e.key === 'L') socket.emit('last');
  if (e.key === 'c' || e.key === 'C') $('#draw-pile').click();
});

// ----- animação das mãos batendo na mesa -----
const HANDS = ['✋', '🖐️', '🤚', '✋🏻', '✋🏽', '✋🏿', '🖐🏼', '🤚🏾'];
function seatPoint(id) {
  const t = $('#table').getBoundingClientRect();
  if (id === PID) return { x: t.width / 2 + r(-60, 60), y: t.height + 40 };
  const s = $(`.seat[data-id="${id}"]`);
  if (!s) return { x: r(0, t.width), y: -40 };
  const b = s.getBoundingClientRect();
  return { x: b.left - t.left + b.width / 2, y: b.top - t.top + b.height / 2 };
}
function flyHand(id, n, total) {
  const layer = $('#slap-layer'), t = $('#table').getBoundingClientRect();
  const from = seatPoint(id);
  const cx = t.width / 2 + r(-55, 55), cy = t.height * 0.58 + r(-35, 35);
  const el = h('div', { class: 'flyhand' }, HANDS[Math.floor(Math.random() * HANDS.length)], h('span', { class: 'who', text: id === PID ? 'Você' : nameOf(id) }));
  el.dataset.id = id; el.style.zIndex = n;
  layer.append(el);
  const rot = r(-35, 35);
  const anim = el.animate([
    { transform: `translate(${from.x - 32}px,${from.y - 32}px) scale(1.6) rotate(${rot - 40}deg)`, opacity: 0.6 },
    { transform: `translate(${cx - 32}px,${cy - 32}px) scale(1.25) rotate(${rot}deg)`, opacity: 1, offset: 0.8 },
    { transform: `translate(${cx - 32}px,${cy - 32}px) scale(1) rotate(${rot}deg)`, opacity: 1 }
  ], { duration: settings.anim ? 260 : 1, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' });
  anim.onfinish = () => {
    SFX.slap(n, total, id === PID);
    const imp = h('div', { class: 'impact', style: `left:${cx}px;top:${cy}px` }); layer.append(imp); setTimeout(() => imp.remove(), 500);
    const tb = $('#table'); tb.classList.remove('thump'); void tb.offsetWidth; tb.classList.add('thump');
    if (id === PID) buzz(80);
  };
}
function clearHands(losers) {
  $$('#slap-layer .flyhand').forEach(el => { if (losers.includes(el.dataset.id)) el.classList.add('loser'); });
  if (losers.length) { SFX.slapLose(); losers.forEach(id => { const el = $(`#slap-layer .flyhand[data-id="${id}"] .who`); if (el) el.textContent += ' 😂 +' + S.room.rules.slapPenalty; }); }
  setTimeout(() => $$('#slap-layer .flyhand').forEach(el => el.animate([{ opacity: 1 }, { opacity: 0, transform: el.style.transform }], { duration: 400, fill: 'forwards' }).onfinish = () => el.remove()), 1300);
}

// ----- HUMOR DOS BONECOS (feliz, triste, bravo, tempestade, congelado...) -----
const moodState = {};
const ms = (id) => moodState[id] || (moodState[id] = { anger: 0, sadUntil: 0, freezeUntil: 0, happyUntil: 0, partyUntil: 0 });
function moodOf(id) {
  const m = moodState[id], t = Date.now();
  const mem = S && S.members.find(x => x.id === id);
  if (m) {
    if (m.freezeUntil > t) return 'frozen';
    if (m.partyUntil > t) return 'party';
    if (m.anger >= 6) return 'furious';
    if (m.sadUntil > t) return 'sad';
    if (m.anger >= 2.5) return 'angry';
    if (m.happyUntil > t) return 'happy';
  }
  if (mem && S.game && S.game.phase === 'play' && mem.inGame) {
    if (mem.count === 1) return 'nervous';
    if (mem.count === 2) return 'happy';
  }
  return 'neutral';
}
const MOOD_FX = {
  furious: '<div class="storm"><span class="cloud">☁️</span><span class="cloud c2">☁️</span><span class="bolt">⚡</span><span class="bolt b2">⚡</span><i class="rain"></i></div>',
  angry: '<span class="puff">💢</span>',
  frozen: '<span class="ice">❄️</span><span class="ice i2">❄️</span><span class="ice i3">❄️</span><div class="iceblock"></div>',
  party: '<span class="conf">🎉</span><span class="conf c2">🎊</span>',
  sad: '<span class="drop">💧</span>',
  happy: '<span class="spark">✨</span>'
};
const lastMood = {};
function applyMood(id, force) {
  const el = id === PID ? $('#me-av') : $(`.seat[data-id="${id}"]`);
  if (!el) return;
  const mood = moodOf(id);
  const holder = $('.avatar-svg', el);
  if (!force && el.dataset.mood === mood) return;
  if (lastMood[id] !== mood) {
    if (mood === 'frozen') SFX.freeze();
    if (mood === 'furious') SFX.thunder();
    lastMood[id] = mood;
  }
  el.dataset.mood = mood;
  if (holder) holder.innerHTML = AV.svg(id === PID ? look : (looks[id] || {}), id === PID ? 46 : 52, { bust: true, mood });
  let fxl = $('.mood-fx', el);
  if (!fxl) { fxl = h('div', { class: 'mood-fx' }); ($('.av', el) || el).append(fxl); }
  fxl.className = 'mood-fx m-' + mood; fxl.innerHTML = MOOD_FX[mood] || '';
  el.classList.toggle('is-frozen', mood === 'frozen');
  el.classList.toggle('is-furious', mood === 'furious');
}
function allMoods(force) {
  if (!S || !S.game) return;
  S.game.order.forEach(id => applyMood(id, force));
}
setInterval(() => {
  for (const m of Object.values(moodState)) m.anger = Math.max(0, m.anger - 0.12);
  allMoods(false);
}, 1000);
function moodEvent(f) {
  const t = Date.now();
  const add = (id, k, ms2) => { ms(id)[k] = Math.max(ms(id)[k], t + ms2); };
  switch (f.type) {
    case 'cut': case 'skip': add(f.who, 'freezeUntil', 1800); add(f.who, 'sadUntil', 5000); if (f.by) add(f.by, 'happyUntil', 3000); break;
    case 'draw':
      if (['d2', 'w4', 'timeout'].includes(f.reason)) { ms(f.who).anger += f.n; if (f.by) add(f.by, 'happyUntil', 3000); }
      else ms(f.who).anger += 0.4 * (f.n || 1);
      break;
    case 'penalty': ms(f.who).anger += f.n || 2; break;
    case 'slapEnd': (f.losers || []).forEach(id => { ms(id).anger += f.n || 2; }); if (S && S.game) S.game.order.filter(id => !f.losers.includes(id)).forEach(id => add(id, 'happyUntil', 2000)); break;
    case 'play': ms(f.who).anger = Math.max(0, ms(f.who).anger - 0.6); break;
    case 'jump': add(f.who, 'happyUntil', 3000); break;
    case 'swap': add(f.who, 'happyUntil', 2500); if (f.target && f.target !== 'all') add(f.target, 'sadUntil', 3500); break;
    case 'win': add(f.who, 'partyUntil', 8000); if (S && S.game) S.game.order.filter(id => id !== f.who).forEach(id => add(id, 'sadUntil', 5000)); break;
    case 'start': for (const k of Object.keys(moodState)) delete moodState[k]; break;
  }
  setTimeout(() => allMoods(false), 50);
}

// ----- avisos pra todo mundo -----
let bannerQ = [], bannerBusy = false;
function banner(icon, line1, line2, kind, who) {
  if (!S || !S.game) return;
  bannerQ.push({ icon, line1, line2, kind, who });
  if (bannerQ.length > 4) bannerQ.splice(0, bannerQ.length - 4);
  if (!bannerBusy) nextBanner();
}
function nextBanner() {
  // avisos ficam numa faixa na parte de baixo da mesa (não atrapalham o centro)
  const b = bannerQ.shift(); if (!b) { bannerBusy = false; return; }
  const feed = $('#feed');
  const av = b.who ? avatarOf(b.who, 34, true) : null;
  const el = h('div', { class: 'feed-item ' + (b.kind || '') }, av, h('span', { class: 'fi-ic', text: b.icon }),
    h('span', { class: 'fi-t' }, h('span', { class: 'l1', text: b.line1 + ' ' }), h('b', { class: 'l2', text: b.line2 })));
  feed.prepend(el);
  while (feed.children.length > 2) feed.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2300);
  setTimeout(nextBanner, 350);
}
function floatAt(id, n) {
  const t = $('#table').getBoundingClientRect();
  let x, y;
  if (id === PID) { x = t.width / 2; y = t.height - 30; }
  else { const s = $(`.seat[data-id="${id}"]`); if (!s) return; const b = s.getBoundingClientRect(); x = b.left - t.left + b.width / 2; y = b.top - t.top; }
  const el = h('div', { class: 'float-n', text: `+${n} 🃏`, style: `left:${x}px;top:${y}px` });
  $('#slap-layer').append(el); setTimeout(() => el.remove(), 1600);
}

// ----------------------------- MENU DA PARTIDA -----------------------------
$('#gm-sound').onclick = () => { settings.sound = !settings.sound; saveSettings(); };
$('#gm-menu').onclick = () => {
  const chk = (key, label) => { const i = h('input', { type: 'checkbox' }); i.checked = settings[key]; i.onchange = () => { settings[key] = i.checked; saveSettings(); }; return h('label', { class: 'chk' }, i, label); };
  modal([h('h3', { text: '⚙️ Opções' }),
    chk('sound', '🔊 Som ligado'), chk('music', '🎵 Música'), chk('memes', '😂 Tocar sons/memes dos outros'), chk('tts', '🗣️ Ler frases em voz alta'), chk('vibrate', '📳 Vibrar'),
    h('button', { class: 'btn', text: '📜 Ver regras da sala', onclick: () => showRules(S.room.rules) }),
    h('div', { class: 'muted tiny', text: 'Atalhos no PC: C = comprar · F = FAST HAND! · Espaço = bater na mesa' }),
    isHost() ? h('button', { class: 'btn', text: '⏹ Encerrar partida (voltar pra sala)', onclick: () => { closeModal(); socket.emit('game:stop'); } }) : null,
    h('div', { class: 'row gap' }, h('button', { class: 'btn danger', text: 'Sair da sala', onclick: () => { closeModal(); leaveRoom(); } }),
      h('button', { class: 'btn primary big', text: 'Fechar', onclick: closeModal }))
  ], 'menu');
};

// ----------------------------- FRASES & SONS NA PARTIDA -----------------------------
function renderQuickbar() {
  const bar = $('#quickbar'); bar.innerHTML = '';
  phrases.filter(p => p.on).forEach(p => bar.append(h('button', { class: 'btn', text: p.text, onclick: () => socket.emit('phrase', { text: p.text }) })));
  memesCache.filter(m => m.on).forEach(m => bar.append(h('button', { class: 'btn meme', text: '🔊 ' + m.label, onclick: () => sendMeme(m) })));
  bar.append(h('button', { class: 'btn ghost', text: '✏️', title: 'Editar frases e sons', onclick: openQuickEditor }));
}
function openQuickEditor() {
  const a = h('div', {}), b = h('div', {});
  renderPhrases(a); renderSounds(b);
  modal([h('h3', { text: '💬 Frases & 🔊 Sons' }), a, b, h('button', { class: 'btn primary big', text: 'Pronto', onclick: () => { closeModal(); renderQuickbar(); } })], 'lib');
}
function blobToDataURL(bl) { return new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(bl); }); }
async function sendMeme(m) { socket.emit('meme', { label: m.label, audio: await blobToDataURL(m.blob) }); }
function showBubble(from, text, isMeme) {
  const seat = $(`.seat[data-id="${from}"]`);
  if (!seat) { toast(`${nameOf(from)}: ${text}`); return; }
  $$('.bubble', seat).forEach(b => b.remove());
  const b = h('div', { class: 'bubble' + (isMeme ? ' meme' : ''), text });
  seat.append(b); setTimeout(() => b.remove(), 3500);
}
socket.on('phrase', ({ from, text }) => {
  if (from === PID) toast(`Você: ${text}`); else showBubble(from, text);
  SFX.msg();
  if (settings.tts && 'speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; speechSynthesis.speak(u); }
});
socket.on('meme', ({ from, label, audio }) => {
  if (from === PID) toast(`🔊 ${label}`); else showBubble(from, '🔊 ' + label, true);
  if (settings.memes) { music.duck(4000); const a = new Audio(audio); a.volume = settings.memeVol / 100; a.play().catch(() => { }); }
});

// ----------------------------- VOZ (WebRTC) -----------------------------
let ICE_CFG = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
let HAS_TURN = false;
const speaking = {};   // quem está falando agora (pra acender o boneco)
const voice = (() => {
  let on = false, muted = false, stream = null, myLevel = 0;
  const peers = {};    // id -> { pc, state, ice: [], initiator, tries }
  const meters = {};   // id -> analyser
  const ST = { connecting: '🟡 conectando…', connected: '🟢 conectado', failed: '🔴 não conectou', closed: '⚪ saiu' };
  function updateButtons() {
    $$('.voice-btn').forEach(b => { b.classList.toggle('on', on); b.textContent = b.closest('.topbar') ? '🎧' : (on ? '🎧 Na voz' : '🎧 Entrar na voz'); b.title = on ? 'Opções de voz' : 'Entrar na voz'; });
    $('#gm-mic').classList.toggle('hidden', !on || !stream);
    $('#gm-mic').textContent = muted ? '🔇' : '🎤';
    if ($('#modal').dataset.kind === 'voice') panel();
  }
  function meter(id, ms) {
    const c = audioCtx(); if (!c) return;
    try { const src = c.createMediaStreamSource(ms); const an = c.createAnalyser(); an.fftSize = 512; src.connect(an); meters[id] = an; } catch (e) { }
  }
  function attach(id, ms) {
    let a = $(`#aud-${id}`);
    if (!a) { a = h('audio', { id: 'aud-' + id, autoplay: '', playsinline: '' }); $('#audios').append(a); }
    a.srcObject = ms; a.volume = settings.voiceVol / 100;
    a.play().catch(() => showTap());
    meter(id, ms);
  }
  function showTap() {   // celular às vezes bloqueia o som até a pessoa tocar na tela
    if ($('#tap-audio')) return;
    const b = h('button', { id: 'tap-audio', class: 'btn primary tap-audio', text: '🔈 Toque aqui pra ouvir a voz', onclick: () => { $$('#audios audio').forEach(a => a.play().catch(() => { })); audioCtx(); b.remove(); } });
    document.body.append(b);
  }
  function setState(id, st) { if (peers[id]) peers[id].state = st; if ($('#modal').dataset.kind === 'voice') panel(); }
  function create(id, initiator, tries = 0) {
    const pc = new RTCPeerConnection(ICE_CFG);
    const P = { pc, state: 'connecting', ice: [], initiator, tries };
    peers[id] = P;
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = (e) => { if (e.candidate) socket.emit('rtc', { to: id, data: { ice: e.candidate } }); };
    pc.ontrack = (e) => attach(id, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === 'connected') setState(id, 'connected');
      else if (cs === 'failed') {
        setState(id, 'failed');
        // tenta de novo (até 2 vezes)
        if (P.tries < 2) setTimeout(() => { if (!on || peers[id] !== P) return; if (P.initiator) { drop(id); create(id, true, P.tries + 1); } else socket.emit('rtc', { to: id, data: { retry: true } }); }, 1500);
      }
    };
    if (initiator) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => socket.emit('rtc', { to: id, data: { sdp: pc.localDescription } })).catch(e => console.warn('voz', e));
    return P;
  }
  function drop(id) {
    const P = peers[id]; if (P) { try { P.pc.close(); } catch (e) { } delete peers[id]; }
    const a = $(`#aud-${id}`); if (a) a.remove();
    delete meters[id]; delete speaking[id];
  }
  socket.on('rtc', async ({ from, data }) => {
    if (!on) return;
    if (data.retry) { const P = peers[from]; if (P && P.initiator && P.tries < 3) { const t = P.tries; drop(from); create(from, true, t + 1); } return; }
    let P = peers[from];
    if (data.sdp && data.sdp.type === 'offer') { const t = P ? P.tries : 0; if (P) drop(from); P = create(from, false, t); }
    if (!P) { if (data.ice) return; P = create(from, false); }
    const pc = P.pc;
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        for (const c of P.ice.splice(0)) await pc.addIceCandidate(c).catch(() => { });   // candidatos que chegaram cedo
        if (data.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); socket.emit('rtc', { to: from, data: { sdp: pc.localDescription } }); }
      } else if (data.ice) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.ice); else P.ice.push(data.ice);
      }
    } catch (e) { console.warn('voz', e); }
  });
  // medidor de volume (quem está falando)
  setInterval(() => {
    const lvl = (an) => { const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); return m; };
    for (const [id, an] of Object.entries(meters)) {
      const talk = lvl(an) > 10;
      if (talk !== !!speaking[id]) { speaking[id] = talk; const s = $(`.seat[data-id="${id}"]`); if (s) s.classList.toggle('speaking', talk); }
    }
    if (meters.__me) { myLevel = muted ? 0 : lvl(meters.__me); const bar = $('#mic-meter div'); if (bar) bar.style.width = Math.min(100, myLevel * 2.2) + '%'; }
  }, 120);
  function panel() {
    const list = S ? S.members.filter(m => m.voiceOn && m.id !== PID && !m.isBot) : [];
    modal([h('h3', { text: '🎧 Voz' }),
      stream ? h('div', {}, h('div', { class: 'muted tiny', text: 'Seu microfone (fale pra ver a barrinha mexer):' }), h('div', { id: 'mic-meter', class: 'mic-meter' }, h('div'))) : h('div', { class: 'toast bad', text: 'Sem microfone: você só escuta.' }),
      h('div', { class: 'opt-title', text: 'Quem está na voz' }),
      list.length ? h('div', { class: 'members' }, list.map(m => h('div', { class: 'member' }, avatarOf(m.id, 30, true), h('span', { class: 'nm', text: m.name + (m.muted ? ' 🔇' : '') }),
        h('span', { class: 'tiny', text: peers[m.id] ? ST[peers[m.id].state] : '🟡 conectando…' })))) : h('div', { class: 'muted', text: 'Ninguém mais entrou na voz ainda. Os outros também precisam clicar em 🎧!' }),
      !HAS_TURN ? h('div', { class: 'muted tiny', text: '⚠️ Se aparecer "🔴 não conectou" entre celular no 4G e PC no Wi-Fi, a rede está bloqueando a conexão direta. Aí é preciso ligar o servidor TURN (veja o LEIA-ME).' }) : null,
      h('div', { class: 'row gap' },
        stream ? h('button', { class: 'btn', text: muted ? '🎤 Ligar microfone' : '🔇 Mutar', onclick: () => voice.mute() }) : null,
        h('button', { class: 'btn danger', text: 'Sair da voz', onclick: () => { closeModal(); voice.leave(); } }),
        h('button', { class: 'btn primary big', text: 'Fechar', onclick: closeModal }))], 'voice');
  }
  return {
    get on() { return on; },
    async click() { if (on) panel(); else this.join(); },
    async join() {
      audioCtx();
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); meter('__me', stream); }
      catch (e) { stream = null; toast(location.protocol === 'https:' || location.hostname === 'localhost' ? 'Sem permissão de microfone: você vai só ouvir 🎧' : 'Microfone só funciona em link https', true); }
      on = true; muted = false;
      socket.emit('voice', { on: true, muted: !stream });
      updateButtons(); toast('Você entrou na voz 🎙️');
      this.sync();
    },
    leave() {
      if (!on) return;
      on = false; Object.keys(peers).forEach(drop); delete meters.__me;
      if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
      socket.emit('voice', { on: false }); updateButtons();
    },
    mute() { if (!stream) return; muted = !muted; stream.getAudioTracks().forEach(t => t.enabled = !muted); socket.emit('voice', { muted }); updateButtons(); },
    sync() {
      if (!S) return;
      const want = S.members.filter(m => m.voiceOn && !m.isBot && m.connected && m.id !== PID).map(m => m.id);
      // avisa quem não está na voz que alguém entrou
      want.forEach(id => { if (!voiceSeen.has(id)) { voiceSeen.add(id); if (!on) toast(`🎙️ ${nameOf(id)} entrou na voz. Clique em 🎧 pra conversar!`); } });
      [...voiceSeen].forEach(id => { if (!want.includes(id)) voiceSeen.delete(id); });
      if (!on) return;
      want.forEach(id => { if (!peers[id] && PID < id) create(id, true); });
      Object.keys(peers).forEach(id => { if (!want.includes(id)) drop(id); });
    }
  };
})();
const voiceSeen = new Set();
$$('.voice-btn').forEach(b => b.onclick = () => voice.click());
$('#gm-mic').onclick = () => voice.mute();

// ----------------------------- EVENTOS DO SERVIDOR -----------------------------
const params = new URLSearchParams(location.search);
socket.on('connect', hello);
socket.on('disconnect', () => toast('Conexão caiu… tentando voltar 🔌', true));
socket.on('welcome', ({ roomCode, wallet: w, defaultRules, ice, hasTurn }) => {
  if (ice) { ICE_CFG = { iceServers: ice }; HAS_TURN = !!hasTurn; }
  if (w) { wallet = w; store.set('wallet', w); }
  if (defaultRules) DEFAULT_RULES = defaultRules;
  refreshProfileBits();
  if (!roomCode) {
    S = null;
    if (['scr-lobby', 'scr-game'].includes(currentScreen)) show('scr-play');
    const code = params.get('sala');
    if (code) {
      params.delete('sala'); history.replaceState(null, '', location.pathname);
      const go = () => { show('scr-play'); socket.emit('room:join', { code }); };
      store.get('name', '') ? go() : askName(go);
    }
  }
});
socket.on('looks', (map) => { Object.assign(looks, map); if (S) { S.game ? renderGame() : renderLobby(); } });
socket.on('state', (st) => {
  const fresh = st.game && (!S || !S.game || (S.game.phase === 'over' && st.game.phase !== 'over'));
  if (fresh) { prev.top = null; prev.hand = new Set(); $('#discard').innerHTML = ''; $('#slap-layer').innerHTML = ''; }
  S = st;
  clockOffset = st.now - Date.now();
  const running = S.game && S.game.phase !== 'over';
  const outside = running && !S.game.order.includes(PID);
  if (!outside) specMode = null;
  if (outside && !specMode) {
    specMode = 'ask';
    modal([h('h3', { text: '🎮 Essa sala já está jogando!' }),
      h('div', { class: 'muted', text: 'Você entra automaticamente na próxima rodada. Enquanto isso:' }),
      h('button', { class: 'btn primary big', text: '👀 Assistir o jogo', onclick: () => { specMode = 'watch'; closeModal(); renderGame(); } }),
      h('button', { class: 'btn big', text: '⏳ Esperar na sala (chat)', onclick: () => { specMode = 'wait'; closeModal(); renderLobby(); } })], 'spec');
  }
  $('#lb-wait').classList.toggle('hidden', !outside);
  if (outside && specMode !== 'watch') renderLobby();
  else if (S.game && !(S.game.phase === 'over' && specMode === 'wait')) renderGame();
  else { if ($('#modal').dataset.kind === 'over') closeModal(); renderLobby(); }
  renderChat();
  voice.sync();
});
socket.on('invalid', ({ reason }) => shake(reason));
socket.on('left', () => { S = null; });
socket.on('kicked', () => { voice.leave(); S = null; show('scr-play'); toast('Você foi removido da sala', true); });
socket.on('fx', (f) => {
  moodEvent(f);
  if (f.type === 'cut') banner('🧊', `${f.who === PID ? 'Você' : nameOf(f.who)} foi`, 'CORTADO!', 'jump', f.who);
  const simple = { play: SFX.play, draw: SFX.draw, last: SFX.last, penalty: SFX.penalty, jump: SFX.jump, swap: SFX.swap, silence: SFX.silence, win: SFX.win }[f.type];
  if (simple) simple();
  if (f.type === 'slapStart') { $('#slap-layer').innerHTML = ''; SFX.slapStart(); buzz([40, 40, 40]); }
  if (f.type === 'slap') setTimeout(() => flyHand(f.who, f.n, f.total), 0);
  const who = (id) => id === PID ? 'Você' : nameOf(id);
  if (f.type === 'slapEnd') {
    setTimeout(() => clearHands(f.losers), 300);
    if (f.n) setTimeout(() => { f.losers.forEach(id => floatAt(id, f.n)); banner('✋', `${f.losers.map(who).join(', ')} bateu por último`, `+${f.n} carta${f.n > 1 ? 's' : ''}`, 'bad', f.losers[0]); }, 400);
    if (f.losers.includes(PID)) setTimeout(() => shake(), 300);
  }
  if (f.type === 'last') { banner('✋', `${f.who === PID ? 'VOCÊ ESTÁ' : nameOf(f.who).toUpperCase() + ' ESTÁ'} DE`, 'FAST HAND!', 'fast', f.who); buzz([60, 40, 60]); }
  if (f.type === 'penalty') {
    floatAt(f.who, f.n);
    if (f.reason === 'seven') banner('🤫', `${who(f.who)} quebrou o silêncio!`, `+${f.n} carta${f.n > 1 ? 's' : ''}`, 'bad', f.who);
    else banner('😬', `${who(f.who)} esqueceu o FAST HAND!`, `+${f.n} cartas`, 'bad', f.who);
    if (f.who === PID) { shake(); buzz(150); }
  }
  if (f.type === 'jump') banner('⚡', `${who(f.who)}`, 'CORTOU A VEZ!', 'jump', f.who);
  if (f.type === 'draw' && f.n) {
    floatAt(f.who, f.n);
    if (f.reason === 'd2' || f.reason === 'w4') { banner('😵', `${who(f.who)} pegou`, `+${f.n} cartas!`, 'bad', f.who); if (f.who === PID) buzz(150); }
    else if (f.reason === 'timeout') banner('⏰', `${who(f.who)} demorou`, `+${f.n} carta${f.n > 1 ? 's' : ''}`, 'bad', f.who);
    else if (f.n > 1) banner('🃏', `${who(f.who)} comprou até servir`, `+${f.n} cartas`, '', f.who);
  }
  if (f.type === 'swap' && (f.target === PID || f.who === PID || f.target === 'all')) toast('🔀 Sua mão foi trocada!');
});

// relógio da jogada (barrinha)
(function tick() {
  const bar = $('#timer div');
  const g = S && S.game;
  let pct = 0;
  if (g && g.phase === 'play' && g.deadline && S.room.rules.turnTime) pct = Math.max(0, (g.deadline - (Date.now() + clockOffset)) / (S.room.rules.turnTime * 1000)) * 100;
  else if (g && g.phase === 'slap' && g.slap) pct = Math.max(0, (g.slap.deadline - (Date.now() + clockOffset)) / 4500) * 100;
  bar.style.width = pct + '%';
  const ring = $('.seat.turn .av'); if (ring) ring.style.setProperty('--pct', (g && g.deadline && S.room.rules.turnTime ? pct : 100) + '%');
  const bt = $('.bottom.myturn'); if (bt) bt.style.setProperty('--pct', pct + '%');
  bar.style.background = pct < 25 ? 'var(--danger)' : 'var(--accent)';
  requestAnimationFrame(tick);
})();
setInterval(() => { if (!S && socket.connected && currentScreen === 'scr-play') socket.emit('lobby:list'); }, 5000);

// ----------------------------- TUTORIAL (COMO JOGAR) -----------------------------
// Passo a passo com mini-desafios. Roda só no navegador, não precisa de sala.
let tutStep = 0, tutTimers = [], tutDone = {};
const tutClear = () => { tutTimers.forEach(t => { clearTimeout(t); clearInterval(t); }); tutTimers = []; };
const tLater = (fn, ms) => { const t = setTimeout(fn, ms); tutTimers.push(t); return t; };
const tc = (color, value) => ({ id: 't' + Math.random().toString(36).slice(2, 8), color, value });
function tutCard(c, onclick) { const e = cardEl(c); if (onclick) { e.classList.add('tut-click'); e.onclick = () => onclick(c, e); } return e; }
function tutShake(el, msg) {
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  SFX.bad(); buzz(100); if (msg) tutSay(msg, true);
}
function tutSay(msg, bad) {
  const b = $('#tut-msg'); if (!b) return;
  b.textContent = msg; b.className = 'tut-msg ' + (bad ? 'bad' : 'good');
}
function tutWin(msg) { tutSay(msg || '✅ Isso aí!'); SFX.coins(); tutDone[tutStep] = true; $('#tut-next').classList.add('pulse'); }
function tutTable(top, label) {
  return h('div', { class: 'tut-table' },
    h('div', { class: 'tut-pile' }, h('div', { class: 'card back' }), h('small', { text: 'monte' })),
    h('div', { class: 'tut-pile' }, top ? cardEl(top) : '', h('small', { text: label || 'mesa' })));
}
function tutHand(cards, onclick) { return h('div', { class: 'tut-hand' }, cards.map(c => tutCard(c, onclick))); }
function tutBot(name, txt) {
  const d = h('div', { class: 'tut-bot' }); d.innerHTML = AV.svg(Object.assign({}, look, { usePhoto: false, base: 'robot', shirt: '#2d7fe0' }), 40, { bust: true });
  d.append(h('span', { text: name + (txt ? ' — ' + txt : '') })); return d;
}
const legal = (c, top) => c.color === 'w' || c.color === top.color || c.value === top.value;

const TUT = [
  { t: 'Bem-vindo ao FAST HANDS! ✋', render: (box) => {
    box.append(
      h('p', { html: 'O objetivo é simples: <b>ficar sem nenhuma carta na mão</b> antes de todo mundo.' }),
      h('p', { html: 'Cada um começa com <b>7 cartas</b>. Na sua vez, você joga <b>uma carta</b> em cima da carta da mesa.' }),
      tutHand([tc('r', '3'), tc('y', '8'), tc('b', 'skip'), tc('g', '5'), tc('w', 'wild')]),
      h('p', { class: 'muted', html: 'Dica: o jogo <b>não mostra</b> quais cartas servem. Se você clicar numa carta errada, a tela <b>treme</b>. Fica esperto! 😉' }));
  } },
  { t: 'Combinar cartas', task: true, render: (box) => {
    const top = tc('r', '5');
    box.append(h('p', { html: 'Você pode jogar uma carta da <b>mesma cor</b> OU do <b>mesmo número/símbolo</b> da mesa.' }),
      tutTable(top),
      h('p', { class: 'tut-task', text: '👉 Desafio: clique numa carta que pode ser jogada em cima do 5 vermelho.' }),
      tutHand([tc('g', '8'), tc('b', '5'), tc('y', '1'), tc('r', '2')], (c, e) => {
        if (legal(c, top)) { e.classList.add('tut-played'); SFX.play(); tutWin(c.color === 'r' ? '✅ Mesma cor (vermelho)!' : '✅ Mesmo número (5)!'); }
        else tutShake(e, '❌ Essa não combina. Procure vermelho ou 5.');
      }));
  } },
  { t: 'Não tem carta? Compre!', task: true, render: (box) => {
    const top = tc('g', '3');
    box.append(h('p', { html: 'Se nada combina, clique em <b>🃏 Comprar</b>. Se a carta comprada servir, você pode jogar ela. Se não, <b>passa a vez</b>.' }),
      tutTable(top),
      tutHand([tc('r', '6'), tc('b', '8'), tc('y', 'rev')], (c, e) => tutShake(e, '❌ Nenhuma combina com o 3 verde. Compre!')),
      h('p', { class: 'tut-task', text: '👉 Desafio: você não tem verde nem 3. Compre uma carta.' }),
      h('button', { class: 'btn primary', text: '🃏 Comprar', onclick: (ev) => {
        SFX.draw(); ev.target.disabled = true;
        const got = tc('g', '9'); const hand = $('.tut-hand', box);
        hand.append(tutCard(got, (c, e) => { e.classList.add('tut-played'); SFX.play(); tutWin('✅ Comprou um 9 verde e jogou! (Num jogo de verdade, o 9 ainda faz todo mundo bater na mesa 😄)'); }));
        tutSay('Você comprou um 9 verde. Ele serve! Clique nele.');
      } }));
  } },
  { t: 'Cartas especiais', render: (box) => {
    const row = (c, txt) => h('div', { class: 'tut-spec' }, cardEl(c), h('div', { html: txt }));
    box.append(h('div', { class: 'tut-specs' },
      row(tc('b', 'skip'), '<b>Bloqueio</b> — o próximo jogador perde a vez.'),
      row(tc('y', 'rev'), '<b>Inverter</b> — o sentido do jogo muda.'),
      row(tc('r', 'd2'), '<b>+2</b> — o próximo compra 2 (dá pra acumular jogando outro +2).'),
      row(tc('w', 'wild'), '<b>Coringa</b> — joga em cima de qualquer coisa e você escolhe a cor.'),
      row(tc('w', 'w4'), '<b>+4</b> — escolhe a cor e o próximo compra 4. Se o próximo tiver um <b>+2 da cor escolhida</b>, joga em cima e soma: o seguinte compra <b>6</b>!'),
      row(tc('g', '9'), '<b>9</b> — todo mundo <b>bate na mesa</b>! Quem bater por último compra.'),
      row(tc('b', '0'), '<b>0</b> — você pode trocar de mão com alguém (se quiser).'),
      row(tc('r', '7'), '<b>7</b> — <b>silêncio</b>! Só quem está na vez pode jogar.')),
      h('p', { class: 'muted', html: 'Levou +2 ou +4? Você compra e, <b>se tiver carta que serve</b>, ainda pode jogar. Se não, passa sozinho.' }));
  } },
  { t: 'Não pode bater com coringa', task: true, render: (box) => {
    const top = tc('y', '4');
    box.append(h('p', { html: 'Sua <b>última carta</b> não pode ser <b>Coringa</b> nem <b>+4</b>. Se sobrar só ela, você tem que comprar.' }),
      tutTable(top),
      tutHand([tc('w', 'w4')], (c, e) => tutShake(e, '❌ Não pode bater com +4! Compre uma carta.')),
      h('p', { class: 'tut-task', text: '👉 Desafio: tente jogar o +4… depois faça o certo.' }),
      h('button', { class: 'btn primary', text: '🃏 Comprar', onclick: (ev) => { SFX.draw(); ev.target.disabled = true; $('.tut-hand', box).append(tutCard(tc('y', '2'))); tutWin('✅ Isso! Comprou e continua no jogo.'); } }));
  } },
  { t: 'FAST HAND! ✋', task: true, render: (box) => {
    const top = tc('b', '6');
    box.append(h('p', { html: 'Quando você ficar com <b>1 carta</b>, aperte <b>✋ FAST HAND!</b> rapidinho. Todo mundo vê um aviso. Se esquecer e alguém jogar antes, você compra <b>2 de multa</b>.' }),
      tutTable(top));
    const btn = h('button', { class: 'btn fasthand-btn hidden', text: '✋ FAST HAND!' });
    let bar = h('div', { class: 'tut-bar' }, h('i'));
    box.append(h('p', { class: 'tut-task', text: '👉 Desafio: jogue o 6 vermelho e aperte FAST HAND! em até 3 segundos.' }),
      tutHand([tc('r', '6'), tc('g', '1')], (c, e) => {
        if (!legal(c, top)) return tutShake(e, '❌ Essa não combina com o 6 azul.');
        e.classList.add('tut-played'); SFX.play(); btn.classList.remove('hidden'); bar.classList.add('run');
        tutSay('Agora! Aperte FAST HAND!');
        const fail = tLater(() => { btn.classList.add('hidden'); tutSay('😬 Demorou! Você comprou 2 de multa. Clique em "Tentar de novo".', true); SFX.penalty(); retry.classList.remove('hidden'); }, 3000);
        btn.onclick = () => { clearTimeout(fail); btn.classList.add('hidden'); bar.classList.remove('run'); SFX.last(); tutWin('✅ FAST HAND! Todo mundo foi avisado que você tá com 1 carta.'); };
      }), btn, bar);
    const retry = h('button', { class: 'btn hidden', text: '🔁 Tentar de novo', onclick: () => renderTut() });
    box.append(retry);
  } },
  { t: 'Cortar a vez ⚡', task: true, render: (box) => {
    const top = tc('y', '4');
    box.append(h('p', { html: 'Tem uma carta <b>IDÊNTICA</b> à da mesa (mesma cor e mesmo número)? Pode jogar <b>mesmo fora da sua vez</b>! Quem ia jogar fica <b>congelado</b> 🥶 e o jogo segue a partir de você.' }),
      tutBot('Bot Zeca', 'é a vez dele…'), tutTable(top),
      h('p', { class: 'tut-task', text: '👉 Desafio: corte o Bot Zeca antes dele jogar (4 segundos)!' }));
    let over = false;
    box.append(tutHand([tc('y', '7'), tc('y', '4'), tc('b', '4')], (c, e) => {
      if (over) return;
      if (c.color === 'y' && c.value === '4') { over = true; e.classList.add('tut-played'); SFX.jump(); $('.tut-bot', box).classList.add('is-frozen'); tutWin('⚡ CORTOU! O Bot Zeca ficou congelado.'); }
      else tutShake(e, '❌ Pra cortar tem que ser IDÊNTICA: amarelo 4.');
    }));
    tLater(() => { if (!over) { over = true; tutSay('O Bot Zeca jogou antes. Clique em "Tentar de novo".', true); box.append(h('button', { class: 'btn', text: '🔁 Tentar de novo', onclick: () => renderTut() })); } }, 4000);
  } },
  { t: '9 = Bater na mesa! 🖐️', task: true, render: (box) => {
    box.append(h('p', { html: 'Quando cair um <b>9</b>, todo mundo tem que <b>bater na mesa</b> (botão da mão ou tecla <b>espaço</b>). Quem bater por <b>último</b> compra cartas.' }),
      h('p', { class: 'tut-task', text: '👉 Desafio: clique em "Começar" e, quando o 9 aparecer, bata o mais rápido que puder!' }));
    const area = h('div', { class: 'tut-slap' });
    const go = h('button', { class: 'btn primary', text: 'Começar' });
    box.append(go, area);
    go.onclick = () => {
      go.disabled = true; area.innerHTML = ''; area.append(h('div', { class: 'muted', text: 'Fica atento…' }));
      tLater(() => {
        area.innerHTML = ''; area.append(cardEl(tc('g', '9')));
        const t0 = performance.now(); SFX.slapStart();
        const bots = [r(450, 900), r(500, 1100), r(600, 1300)];
        const slap = h('button', { class: 'btn tut-slapbtn', text: '🖐️ BATER!' });
        let done = false;
        const hit = () => {
          if (!area.isConnected) return document.removeEventListener('keydown', key);
          if (done) return; done = true; const ms = Math.round(performance.now() - t0);
          const slower = bots.filter(b => b > ms).length;
          SFX.slap(1, 4, true);
          if (slower > 0) tutWin(`✅ Bateu em ${ms} ms! Você não foi o último. 💪`);
          else { tutSay(`😅 ${ms} ms… você foi o último e compraria cartas. Tente de novo!`, true); SFX.slapLose(); go.disabled = false; go.textContent = 'Tentar de novo'; }
          document.removeEventListener('keydown', key);
        };
        const key = (e) => { if (e.code === 'Space') { e.preventDefault(); hit(); } };
        document.addEventListener('keydown', key);
        slap.onclick = hit; area.append(slap);
        tLater(() => { if (!done) { done = true; document.removeEventListener('keydown', key); tutSay('😅 Você nem bateu! Tente de novo.', true); go.disabled = false; go.textContent = 'Tentar de novo'; } }, 2500);
      }, r(1200, 2600));
    };
  } },
  { t: '0 = Trocar a mão 🔀', render: (box) => {
    box.append(h('p', { html: 'Jogou um <b>0</b>? Você escolhe uma opção:' }),
      h('div', { class: 'tut-specs' },
        h('div', { class: 'tut-spec' }, h('b', { text: '🔀' }), h('div', { html: '<b>Trocar com alguém</b> — boa quando alguém tem poucas cartas!' })),
        h('div', { class: 'tut-spec' }, h('b', { text: '🙅' }), h('div', { html: '<b>Não trocar</b> — se sua mão já tá boa.' })),
        h('div', { class: 'tut-spec' }, h('b', { text: '🔄' }), h('div', { html: '<b>Todos passam a mão</b> — cada um passa as cartas pro próximo, no sentido do jogo.' }))));
  } },
  { t: '7 = Silêncio 🤫', task: true, render: (box) => {
    box.append(h('p', { html: 'Caiu um <b>7</b>? Silêncio total até o próximo jogar. <b>Só quem está na vez pode jogar.</b> Se alguém jogar fora da vez, clicar em carta errada ou mandar frase/meme, <b>"falou"</b> e compra <b>2 de multa</b>.' }),
      tutBot('Bot Zeca', 'é a vez dele'), tutTable(tc('r', '7')),
      h('p', { class: 'tut-task', text: '👉 Desafio: NÃO faça nada por 5 segundos. Nem cartas, nem frase!' }));
    let over = false, broke = 0;
    const brk = (e) => { if (over) return; broke++; tutShake(e || $('#tut-stage'), `🤫 Você quebrou o silêncio! +2 cartas (já foram ${broke * 2})`); SFX.penalty(); };
    box.append(tutHand([tc('r', '3'), tc('y', '7'), tc('b', '1')], (c, e) => brk(e)),
      h('button', { class: 'btn small', text: '💬 "Ih, rapaz!"', onclick: (ev) => brk(ev.target) }));
    const cd = h('div', { class: 'tut-count', text: '5' }); box.append(cd);
    let n = 5;
    const iv = setInterval(() => { n--; cd.textContent = n; if (n <= 0) { clearInterval(iv); over = true; $('.tut-bot', box).querySelector('span').textContent = 'Bot Zeca jogou. Silêncio acabou!'; if (!broke) tutWin('✅ Ficou caladinho! Mandou bem.'); else { tutSay(`Ficou devendo ${broke * 2} cartas 😅. Dá pra tentar de novo.`, true); box.append(h('button', { class: 'btn', text: '🔁 Tentar de novo', onclick: () => renderTut() })); } } }, 1000);
    tutTimers.push(iv);
  } },
  { t: 'O humor do seu boneco 😄😡🥶', render: (box) => {
    box.append(h('p', { html: 'Durante o jogo o <b>seu próprio boneco</b> (o que você montou em Personalizar) muda de <b>cara</b> conforme o que acontece:' }));
    const moods = [['happy', '😄 Feliz', 'jogou bem ou cortou alguém'], ['nervous', '😰 Nervoso', 'ficou com 1 carta'], ['frozen', '🥶 Congelado', 'foi cortado ou bloqueado'], ['sad', '😢 Triste', 'perdeu a vez'], ['angry', '😠 Bravo', 'comprou cartas'], ['furious', '⛈️ Furioso', 'comprou MUITAS cartas — vem tempestade com raio!'], ['party', '🥳 Festa', 'ganhou a rodada']];
    box.append(h('div', { class: 'tut-moods' }, moods.map(([m, name, why]) => {
      const d = h('div', { class: 'tut-mood' + (m === 'frozen' ? ' is-frozen' : '') });
      const a = h('div', { class: 'avatar-svg' }); a.innerHTML = AV.svg(look, 60, { bust: true, mood: m });
      d.append(a, h('b', { text: name }), h('small', { text: why })); return d;
    })));
  } },
  { t: 'Pronto pra jogar! 🎉', render: (box) => {
    box.append(h('p', { html: 'Resumão:' }),
      h('ul', { class: 'tut-list', html: '<li>Combine <b>cor</b> ou <b>número</b>.</li><li>Nada serve? <b>Compre</b>.</li><li>1 carta? <b>FAST HAND!</b></li><li>Carta idêntica? <b>Corte</b> a vez!</li><li>9 → <b>bata na mesa</b>. 7 → <b>silêncio</b>. 0 → <b>troca</b> (se quiser).</li><li>Não pode <b>bater</b> com Coringa ou +4.</li>' }),
      h('p', { class: 'muted', text: 'Dica: crie uma sala só com bots pra treinar sem pressão.' }),
      h('div', { class: 'col gap' },
        h('button', { class: 'btn primary big', text: '🤖 Treinar com bots', onclick: () => { store.set('tutSeen', 1); show('scr-play'); const b = $('[data-tabs="play"] [data-tab="create"]'); if (b) b.click(); } }),
        h('button', { class: 'btn', text: '🏠 Voltar ao menu', onclick: () => { store.set('tutSeen', 1); show('scr-home'); } })));
  } }
];
function renderTut() {
  tutClear();
  const st = TUT[tutStep], box = $('#tut-stage');
  box.innerHTML = ''; box.classList.remove('shake');
  box.append(h('h3', { text: st.t }));
  st.render(box);
  box.append(h('div', { id: 'tut-msg', class: 'tut-msg' }));
  $('#tut-count').textContent = `${tutStep + 1} / ${TUT.length}`;
  $('#tut-dots').innerHTML = '';
  TUT.forEach((s, i) => $('#tut-dots').append(h('button', { class: 'dot' + (i === tutStep ? ' on' : '') + (tutDone[i] ? ' done' : ''), title: s.t, onclick: () => { tutStep = i; renderTut(); } })));
  $('#tut-prev').disabled = tutStep === 0;
  $('#tut-next').classList.remove('pulse');
  $('#tut-next').textContent = tutStep === TUT.length - 1 ? '✔ Concluir' : (st.task ? 'Pular / Próximo →' : 'Próximo →');
}
$('#tut-prev').onclick = () => { if (tutStep > 0) { tutStep--; renderTut(); } };
$('#tut-next').onclick = () => { if (tutStep < TUT.length - 1) { tutStep++; renderTut(); } else { store.set('tutSeen', 1); tutClear(); show('scr-home'); } };
$('#btn-tut').onclick = () => { tutStep = 0; show('scr-tut'); };

// ----------------------------- INÍCIO -----------------------------
applyUI();
refreshProfileBits();
if (!store.get('name', '')) setTimeout(() => askName(() => { if (!store.get('tutSeen', 0)) modal([h('h3', { text: '🎓 Primeira vez aqui?' }), h('p', { text: 'Quer um tutorial rapidinho (2 minutos) pra aprender as cartas e as regras?' }), h('div', { class: 'row gap' }, h('button', { class: 'btn primary big', text: 'Bora!', onclick: () => { closeModal(); tutStep = 0; show('scr-tut'); } }), h('button', { class: 'btn', text: 'Já sei jogar', onclick: () => { store.set('tutSeen', 1); closeModal(); } }))]); }), 300);
})();
