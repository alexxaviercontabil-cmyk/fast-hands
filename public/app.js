// =====================================================================
//  FAST HANDS - parte do navegador (tela, cartas, voz, memes)
// =====================================================================
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v; else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && e.append(k));
  return e;
};

// ----------------------------- ARMAZENAMENTO LOCAL -----------------------------
const store = {
  get(k, def) { try { const v = localStorage.getItem('fh_' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('fh_' + k, JSON.stringify(v)); } catch (e) { } }
};
let PID = store.get('pid', null);
if (!PID) { PID = 'p' + Math.random().toString(36).slice(2, 12); store.set('pid', PID); }
const settings = Object.assign({ sound: true, memes: true, tts: false }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);

const DEFAULT_PHRASES = ['Corta essa! ✋', 'Segura esse +4 😈', 'Alguém tem azul aí?', 'Tava blefando 😅', 'GG! 🏆',
  'Que sorte, hein…', 'Foi sem querer 🙏', 'Vai devagar aí!', 'Olha o LAST!', 'Bora, joga logo!'];
let phrases = store.get('phrases', null);
if (!phrases) { phrases = DEFAULT_PHRASES.map((t, i) => ({ id: 'f' + i, text: t, on: i < 8 })); store.set('phrases', phrases); }
const savePhrases = () => store.set('phrases', phrases);
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

// ----------------------------- SONS (gerados, sem arquivos) -----------------------------
let actx = null;
function audioCtx() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
document.addEventListener('pointerdown', audioCtx, { once: true });
function tone(freqs, dur = 0.12, type = 'sine', vol = 0.15, gap = 0) {
  if (!settings.sound) return;
  const c = audioCtx(); if (!c) return;
  let t = c.currentTime;
  for (const f of [].concat(freqs)) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    t += gap || dur;
  }
}
function noise(dur = 0.15, vol = 0.3) {
  if (!settings.sound) return;
  const c = audioCtx(); if (!c) return;
  const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const s = c.createBufferSource(), g = c.createGain(); g.gain.value = vol;
  s.buffer = b; s.connect(g).connect(c.destination); s.start();
}
const SFX = {
  play: () => noise(0.08, 0.25),
  draw: () => tone([500, 380], 0.06, 'triangle', 0.1),
  myturn: () => tone([660, 880], 0.1, 'sine', 0.12),
  bad: () => tone([180, 140], 0.12, 'square', 0.08),
  slap: () => { noise(0.2, 0.6); tone(90, 0.15, 'sine', 0.4); },
  slapStart: () => tone([880, 1100, 880, 1100], 0.07, 'square', 0.08),
  last: () => tone([523, 659, 784, 1046], 0.09, 'sawtooth', 0.08),
  penalty: () => tone([400, 300, 200], 0.14, 'sawtooth', 0.08),
  jump: () => tone([300, 600, 1200], 0.06, 'square', 0.08),
  swap: () => tone([400, 800, 400, 800], 0.07, 'triangle', 0.1),
  silence: () => tone([300, 250], 0.25, 'sine', 0.12),
  win: () => tone([523, 659, 784, 1046, 784, 1046], 0.12, 'triangle', 0.13),
  msg: () => tone(1200, 0.05, 'sine', 0.05)
};

// ----------------------------- REGRAS (descrição pra tela) -----------------------------
const RULES_META = [
  ['wild', 'Coringa (troca cor)', 'bool'], ['wild4', 'Coringa +4', 'bool'], ['draw2', 'Cartas +2', 'bool'],
  ['skip', 'Bloqueio', 'bool'], ['reverse', 'Inverter', 'bool'],
  ['nine', '9 = Bater na mesa', 'bool', 'Todo mundo bate; quem bater por último compra'],
  ['zero', '0 = Trocar a mão', 'bool', 'Quem joga escolhe alguém pra trocar as cartas'],
  ['seven', '7 = Silêncio', 'bool', 'Ninguém corta nem manda frase/meme até o próximo jogar'],
  ['jumpIn', 'Cortar a vez', 'bool', 'Carta IDÊNTICA (cor e número) entra fora da vez'],
  ['stacking', 'Acumular +2 / +4', 'bool'], ['drawUntilPlay', 'Comprar até servir', 'bool'],
  ['handSize', 'Cartas iniciais', 'num', 3, 15], ['lastPenalty', 'Multa por não gritar LAST!', 'num', 0, 6],
  ['slapPenalty', 'Multa do 9 (último a bater)', 'num', 0, 6], ['turnTime', 'Tempo por jogada (seg, 0 = livre)', 'num', 0, 120],
  ['decks', 'Baralhos (0 = automático)', 'num', 0, 4]
];
const DEFAULT_RULES = { handSize: 7, wild: true, wild4: true, draw2: true, skip: true, reverse: true, nine: true, zero: true, seven: true,
  jumpIn: true, stacking: true, drawUntilPlay: false, lastPenalty: 2, slapPenalty: 2, turnTime: 30, decks: 0 };
function renderRules(box, rules, editable, onChange) {
  box.innerHTML = '';
  box.classList.toggle('readonly', !editable);
  for (const [k, label, type, a, b] of RULES_META) {
    let inp;
    if (type === 'bool') inp = h('input', { type: 'checkbox' }), inp.checked = !!rules[k];
    else inp = h('input', { type: 'number', min: a, max: b, value: rules[k] });
    inp.addEventListener('change', () => {
      rules[k] = type === 'bool' ? inp.checked : Math.max(a, Math.min(b, Number(inp.value) || 0));
      onChange && onChange(rules);
    });
    const desc = type === 'bool' && RULES_META.find(r => r[0] === k)[3];
    box.append(h('label', { class: 'rule' }, h('span', {}, label, desc ? h('small', { text: desc }) : null), inp));
  }
}

// ----------------------------- UTILIDADES DE TELA -----------------------------
function show(id) { $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); }
function toast(msg, bad) {
  const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), text: msg });
  $('#toasts').append(t); setTimeout(() => t.remove(), 2600);
}
function shake(reason) {
  const el = $('#scr-game').classList.contains('hidden') ? $('#app') : $('#scr-game');
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  const f = $('#flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60);
  SFX.bad();
  if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) { }
  if (reason) toast(reason, true);
}
const COLORS_HEX = { r: '#e8474c', y: '#f5c21b', g: '#2fae5b', b: '#2d7fe0' };
const COLOR_PT = { r: 'Vermelho', y: 'Amarelo', g: 'Verde', b: 'Azul' };
function avatarColor(id) { let x = 0; for (const c of id) x = (x * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${x % 360} 55% 42%)`; }
function avatar(m) { return h('div', { class: 'avatar', style: `background:${avatarColor(m.id)}`, text: m.isBot ? '🤖' : (m.name || '?').slice(0, 2).toUpperCase() }); }
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
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && $('#modal').dataset.kind !== 'over') closeModal(); });

// ----------------------------- ESTADO -----------------------------
let S = null;               // último estado vindo do servidor
let clockOffset = 0;        // diferença de relógio com o servidor
let prev = { top: null, hand: new Set(), turn: null, phase: null, chatLen: 0 };
const meMember = () => S && S.members.find(m => m.id === PID);
const isHost = () => S && S.room.hostId === PID;
const nameOf = (id) => (S && (S.members.find(m => m.id === id) || {}).name) || '???';

// ----------------------------- HOME -----------------------------
$('#in-name').value = store.get('name', '');
const params = new URLSearchParams(location.search);
if (params.get('sala')) $('#in-code').value = params.get('sala').toUpperCase();
function needName() {
  const n = $('#in-name').value.trim();
  if (!n) { shake('Digite seu apelido primeiro'); $('#in-name').focus(); return null; }
  store.set('name', n);
  socket.emit('hello', { pid: PID, name: n });
  return n;
}
$('#btn-create').onclick = () => { if (needName()) openCreate(); };
$('#btn-quick').onclick = () => { if (needName()) socket.emit('room:quick'); };
$('#btn-join').onclick = () => { if (needName()) { const c = $('#in-code').value.trim().toUpperCase(); if (c.length < 5) return shake('Código tem 5 letras'); socket.emit('room:join', { code: c }); } };
$('#in-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-join').click(); });
$('#btn-refresh').onclick = () => socket.emit('lobby:list');
$('#btn-library').onclick = openLibrary;

socket.on('lobby', (list) => {
  const box = $('#room-list'); box.innerHTML = '';
  if (!list.length) return box.append(h('div', { class: 'muted', text: 'Nenhuma sala pública agora. Crie a primeira!' }));
  for (const r of list) {
    const full = r.count >= r.max;
    box.append(h('div', { class: 'room-item' },
      h('div', {}, h('b', { text: r.name }), h('br'), h('small', { text: `${r.count}/${r.max} jogadores · ${r.inGame ? '🎮 jogando' : '⏳ esperando'} · dono: ${r.host}` })),
      h('button', { class: 'btn small primary', disabled: full ? '' : false, text: full ? 'Cheia' : 'Entrar', onclick: () => { if (needName()) socket.emit('room:join', { code: r.code }); } })));
  }
});

// ----------------------------- CRIAR SALA -----------------------------
let createRules = Object.assign({}, DEFAULT_RULES, store.get('lastRules', {}));
function openCreate() {
  $('#cr-name').value = `Sala de ${store.get('name', '')}`;
  renderRules($('#cr-rules'), createRules, true);
  show('scr-create');
}
$('#cr-max').oninput = () => $('#cr-max-v').textContent = $('#cr-max').value;
$('#cr-back').onclick = () => show('scr-home');
$('#cr-go').onclick = () => {
  store.set('lastRules', createRules);
  socket.emit('room:create', {
    name: $('#cr-name').value, isPublic: $('input[name=cr-vis]:checked').value === 'pub',
    maxPlayers: Number($('#cr-max').value), rules: createRules
  });
};

// ----------------------------- SALA DE ESPERA -----------------------------
$('#lb-leave').onclick = leaveRoom;
$('#lb-addbot').onclick = () => socket.emit('room:addBot');
$('#lb-start').onclick = () => socket.emit('game:start');
$('#lb-copy').onclick = () => {
  const link = `${location.origin}/?sala=${S.room.code}`;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Convite copiado! Mande pros amigos 😉'))
    .catch(() => prompt('Copie o convite:', link));
};
$('#lb-max').oninput = () => { $('#lb-max-v').textContent = $('#lb-max').value; };
$('#lb-max').onchange = () => socket.emit('room:settings', { maxPlayers: Number($('#lb-max').value) });
$('#lb-public').onchange = () => socket.emit('room:settings', { isPublic: $('#lb-public').checked });
function leaveRoom() { voice.leave(); socket.emit('room:leave'); S = null; closeModal(); show('scr-home'); }

function renderLobby() {
  show('scr-lobby');
  const r = S.room;
  $('#lb-name').textContent = r.name;
  $('#lb-code').textContent = r.code;
  $('#lb-vis').textContent = r.isPublic ? '🌎 Pública' : '🔒 Fechada';
  $('#lb-count').textContent = `(${S.members.length}/${r.maxPlayers})`;
  $$('.host-only').forEach(e => e.classList.toggle('hidden', !isHost()));
  $$('.not-host').forEach(e => e.classList.toggle('hidden', isHost()));
  $('#lb-max').value = r.maxPlayers; $('#lb-max-v').textContent = r.maxPlayers; $('#lb-public').checked = r.isPublic;
  const box = $('#lb-members'); box.innerHTML = '';
  for (const m of S.members) {
    box.append(h('div', { class: 'member' + (m.connected ? '' : ' off') }, avatar(m),
      h('span', { class: 'nm', text: `${m.name}${m.id === PID ? ' (você)' : ''}` }),
      m.id === r.hostId ? h('span', { title: 'Dono da sala', text: '👑' }) : null,
      m.voiceOn ? h('span', { text: m.muted ? '🔇' : '🎙️' }) : null,
      m.wins ? h('span', { class: 'muted tiny', text: `🏆${m.wins}` }) : null,
      isHost() && m.id !== PID ? h('button', { class: 'btn small ghost', text: '✕', title: 'Remover', onclick: () => socket.emit('room:kick', { id: m.id }) }) : null));
  }
  // regras: só re-renderiza se mudou (pra não atrapalhar quem está editando)
  const key = JSON.stringify(r.rules) + isHost();
  if ($('#lb-rules').dataset.key !== key) {
    $('#lb-rules').dataset.key = key;
    const copy = Object.assign({}, r.rules);
    renderRules($('#lb-rules'), copy, isHost(), (nr) => socket.emit('room:settings', { rules: nr }));
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
function localCanPlay(g, c) {
  if (g.pending > 0) {
    if (g.pendingType === 'd2') return c.value === 'd2' || c.value === 'w4';
    if (g.pendingType === 'w4') return c.value === 'w4';
    return false;
  }
  if (c.color === 'w') return true;
  return c.color === g.color || c.value === g.top.value;
}

function renderGame() {
  show('scr-game');
  const g = S.game, r = S.room, rules = r.rules;
  const me = meMember();
  $('#gm-room').textContent = `${r.name} · ${r.code}`;

  // --- assentos ---
  const inGame = g.order.includes(PID);
  let others = g.order.slice();
  if (inGame) { const i = others.indexOf(PID); others = others.slice(i + 1).concat(others.slice(0, i)); }
  const seats = $('#seats');
  const keep = {};
  $$('.seat', seats).forEach(s => keep[s.dataset.id] = s);
  const k = others.length;
  const narrow = $('#table').clientWidth < 700;
  others.forEach((id, i) => {
    const m = S.members.find(x => x.id === id) || { id, name: '?' };
    const a = Math.PI + ((i + 1) / (k + 1)) * Math.PI;
    let rx = 44, ry = 40;
    if (k > 7 && narrow && i % 2) { rx *= 0.7; ry *= 0.62; }
    const x = 50 + rx * Math.cos(a), y = 52 + ry * Math.sin(a);
    let s = keep[id]; delete keep[id];
    if (!s) { s = h('div', { class: 'seat' }); s.dataset.id = id; seats.append(s); }
    s.style.left = x + '%'; s.style.top = y + '%';
    s.className = 'seat' + (g.turn === id && g.phase === 'play' ? ' turn' : '') + (m.connected ? '' : ' off');
    const bubble = $('.bubble', s);
    s.innerHTML = '';
    const av = h('div', { class: 'av' }, avatar(m));
    if (m.count === 1) av.append(h('span', { class: 'badge' + (m.called ? ' ok' : ''), text: m.called ? 'LAST!' : '1' }));
    if (m.voiceOn) av.append(h('span', { class: 'vc', text: m.muted ? '🔇' : '🎙️' }));
    s.append(av, h('div', { class: 'nm', text: m.name + (r.hostId === id ? ' 👑' : '') }),
      h('div', { class: 'cnt' }, h('span', { class: 'mini' }), String(m.count)));
    if (bubble) s.append(bubble);
  });
  Object.values(keep).forEach(s => s.remove());

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
  $('#color-dot').title = COLOR_PT[g.color] || '';
  $('#dir').className = 'dir' + (g.dir < 0 ? ' ccw' : '');
  $('#pending').classList.toggle('hidden', !g.pending);
  $('#pending').textContent = `+${g.pending}`;
  $('#silence').classList.toggle('hidden', !(g.silence && g.phase === 'play'));

  const myTurn = g.turn === PID && g.phase === 'play';
  const st = $('#status');
  if (g.phase === 'over') st.textContent = `🏆 ${nameOf(g.winner)} venceu!`;
  else if (g.phase === 'slap') st.textContent = '✋ BATE NA MESA!';
  else if (myTurn) st.textContent = g.pending ? `SUA VEZ! Acumule ou compre +${g.pending}` : (g.hasDrawn ? 'Jogue a carta comprada ou passe' : 'SUA VEZ!');
  else st.textContent = `Vez de ${nameOf(g.turn)}`;
  st.classList.toggle('me', myTurn);
  if (myTurn && prev.turn !== PID) { SFX.myturn(); if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { } }
  prev.turn = g.phase === 'play' ? g.turn : prev.turn;

  // --- minha mão (SEM destacar as cartas que podem ser jogadas!) ---
  const hand = $('#hand');
  const cards = g.hand || [];
  const newSet = new Set(cards.map(c => c.id));
  hand.innerHTML = '';
  hand.classList.toggle('many', cards.length > 10);
  if (!inGame) hand.append(h('div', { class: 'muted', text: '👀 Você está assistindo. Entra na próxima rodada!' }));
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
        h('div', { class: 'win-title', text: `🏆 ${nameOf(g.winner)} venceu!` }),
        h('div', { class: 'members' }, ranking.map(m => h('div', { class: 'member' }, avatar(m), h('span', { class: 'nm', text: m.name }), h('b', { text: `🏆 ${m.wins}` })))),
        isHost() ? h('div', { class: 'row gap' },
          h('button', { class: 'btn ghost', text: 'Voltar pra sala', onclick: () => { closeModal(); socket.emit('game:stop'); } }),
          h('button', { class: 'btn primary big', text: '▶ Nova rodada', onclick: () => { closeModal(); socket.emit('game:start'); } }))
          : h('div', { class: 'muted center', text: 'Esperando o dono da sala começar outra…' })
      ], 'over');
    }
  } else if ($('#modal').dataset.kind === 'over') closeModal();
  if (g.phase !== 'play' && ['color', 'target'].includes($('#modal').dataset.kind)) closeModal();

  renderQuickbar();
}

// ----- tentar jogar uma carta -----
function tryPlay(c) {
  const g = S.game; if (!g) return;
  if (g.phase !== 'play') return shake();
  const rules = S.room.rules;
  const myTurn = g.turn === PID;
  if (!myTurn) {
    const t = g.top;
    const jump = rules.jumpIn && !g.silence && !g.pending && t.color !== 'w' && c.color === t.color && c.value === t.value;
    if (!jump) return shake(g.silence ? '🤫 Silêncio do 7!' : null);
  } else {
    if (g.hasDrawn && !rules.drawUntilPlay && c.id !== g.drawnCardId) return shake('Só a carta que você comprou');
    if (!localCanPlay(g, c)) return shake();
  }
  const send = (extra = {}) => { socket.emit('play', Object.assign({ cardId: c.id }, extra)); };
  const needTarget = c.value === '0' && rules.zero && g.order.length > 1;
  const pickTarget = (extra) => {
    if (!needTarget) return send(extra);
    const others = g.order.filter(id => id !== PID);
    modal([h('h3', { text: '🔀 Trocar a mão com quem?' }),
      h('div', { class: 'targets' }, others.map(id => {
        const m = S.members.find(x => x.id === id) || { id, name: '?', count: 0 };
        return h('button', { class: 'btn', onclick: () => { closeModal(); send(Object.assign({ target: id }, extra)); } },
          `${m.name} — ${m.count} carta${m.count === 1 ? '' : 's'}`);
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
document.addEventListener('keydown', (e) => {   // atalhos no PC
  if (!S || !S.game || /input|textarea/i.test(document.activeElement.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); if (S.game.phase === 'slap') socket.emit('slap'); }
  if (e.key === 'l' || e.key === 'L') socket.emit('last');
  if (e.key === 'c' || e.key === 'C') $('#draw-pile').click();
});

// ----------------------------- MENU DA PARTIDA -----------------------------
function soundIcon() { $('#gm-sound').textContent = settings.sound ? '🔊' : '🔈'; }
soundIcon();
$('#gm-sound').onclick = () => { settings.sound = !settings.sound; saveSettings(); soundIcon(); };
$('#gm-menu').onclick = () => {
  const chk = (key, label) => { const i = h('input', { type: 'checkbox' }); i.checked = settings[key]; i.onchange = () => { settings[key] = i.checked; saveSettings(); soundIcon(); }; return h('label', { class: 'chk' }, i, label); };
  const rulesBox = h('div', { class: 'rules' });
  renderRules(rulesBox, Object.assign({}, S.room.rules), false);
  modal([h('h3', { text: '⚙️ Opções' }),
    chk('sound', '🔊 Efeitos sonoros'), chk('memes', '😂 Tocar memes de áudio dos outros'), chk('tts', '🗣️ Ler frases em voz alta'),
    h('button', { class: 'btn', text: '🎙️ Minhas frases & memes', onclick: openLibrary }),
    h('details', {}, h('summary', { text: 'Ver regras da sala' }), rulesBox),
    h('div', { class: 'muted tiny', text: 'Atalhos no PC: C = comprar · L = LAST! · Espaço = bater na mesa' }),
    isHost() ? h('button', { class: 'btn', text: '⏹ Encerrar partida (voltar pra sala)', onclick: () => { closeModal(); socket.emit('game:stop'); } }) : null,
    h('div', { class: 'row gap' }, h('button', { class: 'btn danger', text: 'Sair da sala', onclick: () => { closeModal(); leaveRoom(); } }),
      h('button', { class: 'btn primary big', text: 'Fechar', onclick: closeModal }))
  ], 'menu');
};

// ----------------------------- FRASES & MEMES -----------------------------
// memes de áudio ficam guardados NO SEU NAVEGADOR (IndexedDB)
const memeDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('fasthands', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('memes', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('memes', mode); const s = t.objectStore('memes'); const out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  return {
    all: () => tx('readonly', s => s.getAll()).catch(() => []),
    put: (m) => tx('readwrite', s => s.put(m)),
    del: (id) => tx('readwrite', s => s.delete(id))
  };
})();
let memesCache = [];
memeDB.all().then(l => { memesCache = l || []; });

function renderQuickbar() {
  const bar = $('#quickbar'); bar.innerHTML = '';
  phrases.filter(p => p.on).forEach(p => bar.append(h('button', { class: 'btn', text: p.text, onclick: () => socket.emit('phrase', { text: p.text }) })));
  memesCache.filter(m => m.on).forEach(m => bar.append(h('button', { class: 'btn meme', text: '🔊 ' + m.label, onclick: () => sendMeme(m) })));
  bar.append(h('button', { class: 'btn ghost', text: '✏️', title: 'Editar frases e memes', onclick: openLibrary }));
}
function blobToDataURL(b) { return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); }
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
  if (settings.memes) { const a = new Audio(audio); a.volume = 0.9; a.play().catch(() => { }); }
});

let recorder = null;
function openLibrary() {
  let tab = 'f';
  const body = h('div', {});
  const draw = async () => {
    memesCache = await memeDB.all();
    body.innerHTML = '';
    const eqF = phrases.filter(p => p.on).length, eqM = memesCache.filter(m => m.on).length;
    body.append(h('div', { class: 'tabs' },
      h('button', { class: 'btn small' + (tab === 'f' ? ' on' : ''), text: `💬 Frases (${eqF}/${MAX_EQUIP})`, onclick: () => { tab = 'f'; draw(); } }),
      h('button', { class: 'btn small' + (tab === 'm' ? ' on' : ''), text: `🔊 Memes de áudio (${eqM}/${MAX_EQUIP})`, onclick: () => { tab = 'm'; draw(); } })));
    body.append(h('div', { class: 'muted tiny', text: `Crie quantos quiser. Marque até ${MAX_EQUIP} de cada pra aparecerem na partida.` }));
    if (tab === 'f') {
      const inp = h('input', { maxlength: 80, placeholder: 'Nova frase… ex: "Hoje não, parceiro!"' });
      const add = () => { const t = inp.value.trim(); if (!t) return; phrases.push({ id: 'f' + Date.now(), text: t, on: eqF < MAX_EQUIP }); savePhrases(); draw(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      body.append(h('div', { class: 'row gap' }, inp, h('button', { class: 'btn primary', text: 'Adicionar', onclick: add })));
      body.append(h('div', { class: 'lib-list' }, phrases.map(p => {
        const c = h('input', { type: 'checkbox' }); c.checked = p.on;
        c.onchange = () => { if (c.checked && phrases.filter(x => x.on).length >= MAX_EQUIP) { c.checked = false; return shake(`Máximo ${MAX_EQUIP} na partida`); } p.on = c.checked; savePhrases(); draw(); };
        return h('div', { class: 'lib-item' }, c, h('span', { class: 't', text: p.text }),
          h('button', { class: 'btn small ghost', text: '🗑', onclick: () => { phrases = phrases.filter(x => x !== p); savePhrases(); draw(); } }));
      })));
    } else {
      const lbl = h('input', { maxlength: 30, placeholder: 'Nome do meme (ex: "Risada do mal")' });
      const recBtn = h('button', { class: 'btn primary', text: '⏺ Gravar (até 8s)' });
      const file = h('input', { type: 'file', accept: 'audio/*', style: 'display:none' });
      const saveBlob = async (blob) => {
        if (blob.size > 900000) return shake('Áudio grande demais (máx ~900 KB / poucos segundos)');
        const label = lbl.value.trim() || `Meme ${memesCache.length + 1}`;
        await memeDB.put({ id: 'm' + Date.now(), label, blob, on: eqM < MAX_EQUIP });
        toast('Meme salvo! 🎉'); draw();
      };
      recBtn.onclick = async () => {
        if (recorder) { recorder.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          recorder = new MediaRecorder(stream);
          recorder.ondataavailable = e => chunks.push(e.data);
          recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); const r = recorder; recorder = null; saveBlob(new Blob(chunks, { type: r.mimeType || 'audio/webm' })); };
          recorder.start();
          recBtn.classList.add('rec'); recBtn.textContent = '⏹ Parar';
          setTimeout(() => { if (recorder && recorder.state === 'recording') recorder.stop(); }, 8000);
        } catch (e) { shake('Não consegui usar o microfone (permita no navegador)'); }
      };
      file.onchange = () => { if (file.files[0]) saveBlob(file.files[0]); };
      body.append(lbl, h('div', { class: 'row gap wrap' }, recBtn, h('button', { class: 'btn', text: '📁 Enviar arquivo de áudio', onclick: () => file.click() }), file));
      if (!memesCache.length) body.append(h('div', { class: 'muted', text: 'Nenhum meme ainda. Grave o primeiro!' }));
      body.append(h('div', { class: 'lib-list' }, memesCache.map(m => {
        const c = h('input', { type: 'checkbox' }); c.checked = !!m.on;
        c.onchange = async () => { if (c.checked && memesCache.filter(x => x.on).length >= MAX_EQUIP) { c.checked = false; return shake(`Máximo ${MAX_EQUIP} na partida`); } m.on = c.checked; await memeDB.put(m); draw(); };
        return h('div', { class: 'lib-item' }, c, h('span', { class: 't', text: m.label }),
          h('button', { class: 'btn small', text: '▶', onclick: () => { const a = new Audio(URL.createObjectURL(m.blob)); a.play(); } }),
          h('button', { class: 'btn small ghost', text: '🗑', onclick: async () => { await memeDB.del(m.id); draw(); } }));
      })));
    }
    body.append(h('button', { class: 'btn primary big', text: 'Pronto', onclick: () => { closeModal(); if (S && S.game) renderQuickbar(); } }));
  };
  modal([h('h3', { text: '🎙️ Minhas frases & memes' }), body], 'lib');
  draw();
}

// ----------------------------- VOZ (WebRTC) -----------------------------
const voice = (() => {
  let on = false, muted = false, stream = null;
  const peers = {};
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  function updateButtons() {
    $$('.voice-btn').forEach(b => { b.classList.toggle('on', on); b.textContent = b.closest('.topbar') ? '🎧' : (on ? '🎧 Na voz (sair)' : '🎧 Entrar na voz'); b.title = on ? 'Sair da voz' : 'Entrar na voz'; });
    $('#gm-mic').classList.toggle('hidden', !on || !stream);
    $('#gm-mic').textContent = muted ? '🔇' : '🎤';
  }
  function peer(id, initiator) {
    if (peers[id]) return peers[id];
    const pc = new RTCPeerConnection(ICE);
    peers[id] = pc;
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = (e) => { if (e.candidate) socket.emit('rtc', { to: id, data: { ice: e.candidate } }); };
    pc.ontrack = (e) => {
      let a = $(`#aud-${id}`);
      if (!a) { a = h('audio', { id: 'aud-' + id, autoplay: '' }); $('#audios').append(a); }
      a.srcObject = e.streams[0] || new MediaStream([e.track]);
      a.play().catch(() => { });
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) drop(id); };
    if (initiator) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => socket.emit('rtc', { to: id, data: { sdp: pc.localDescription } }));
    return pc;
  }
  function drop(id) { const pc = peers[id]; if (pc) { try { pc.close(); } catch (e) { } delete peers[id]; } const a = $(`#aud-${id}`); if (a) a.remove(); }
  socket.on('rtc', async ({ from, data }) => {
    if (!on) return;
    const pc = peer(from, false);
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); socket.emit('rtc', { to: from, data: { sdp: pc.localDescription } }); }
      } else if (data.ice) await pc.addIceCandidate(data.ice);
    } catch (e) { console.warn('voz', e); }
  });
  return {
    async toggle() {
      if (on) return this.leave();
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { stream = null; toast('Sem microfone: você vai só ouvir 🎧', true); }
      on = true; muted = false;
      socket.emit('voice', { on: true, muted: !stream });
      updateButtons(); toast('Você entrou na voz 🎙️');
    },
    leave() {
      if (!on) return;
      on = false; Object.keys(peers).forEach(drop);
      if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
      socket.emit('voice', { on: false }); updateButtons();
    },
    mute() { if (!stream) return; muted = !muted; stream.getAudioTracks().forEach(t => t.enabled = !muted); socket.emit('voice', { muted }); updateButtons(); },
    sync() {
      if (!on || !S) return;
      const want = S.members.filter(m => m.voiceOn && !m.isBot && m.connected && m.id !== PID).map(m => m.id);
      want.forEach(id => { if (!peers[id] && PID < id) peer(id, true); });
      Object.keys(peers).forEach(id => { if (!want.includes(id)) drop(id); });
    }
  };
})();
$$('.voice-btn').forEach(b => b.onclick = () => voice.toggle());
$('#gm-mic').onclick = () => voice.mute();

// ----------------------------- EVENTOS DO SERVIDOR -----------------------------
socket.on('connect', () => {
  const n = store.get('name', '');
  if (n) socket.emit('hello', { pid: PID, name: n });
});
socket.on('disconnect', () => toast('Conexão caiu… tentando voltar 🔌', true));
socket.on('welcome', ({ roomCode }) => {
  if (!roomCode) {
    if (S) { S = null; }
    if (!$('#scr-create').classList.contains('hidden')) return;
    show('scr-home');
    const code = params.get('sala');
    if (code && store.get('name', '')) { params.delete('sala'); history.replaceState(null, '', location.pathname); socket.emit('room:join', { code }); }
  }
});
socket.on('state', (st) => {
  const firstGame = st.game && (!S || !S.game || (S.game.phase === 'over' && st.game.phase !== 'over'));
  if (firstGame) { prev.top = null; prev.hand = new Set(); $('#discard').innerHTML = ''; }
  S = st;
  clockOffset = st.now - Date.now();
  if (S.game) renderGame(); else { if ($('#modal').dataset.kind === 'over') closeModal(); renderLobby(); }
  renderChat();
  voice.sync();
});
socket.on('invalid', ({ reason }) => shake(reason));
socket.on('left', () => { S = null; show('scr-home'); });
socket.on('kicked', () => { voice.leave(); S = null; show('scr-home'); toast('Você foi removido da sala', true); });
socket.on('fx', (f) => {
  const fn = { play: SFX.play, draw: SFX.draw, slap: SFX.slap, slapStart: SFX.slapStart, last: SFX.last, penalty: SFX.penalty, jump: SFX.jump, swap: SFX.swap, silence: SFX.silence, win: SFX.win }[f.type];
  if (fn) fn();
  if (f.type === 'last') toast(`📣 ${f.who === PID ? 'Você' : nameOf(f.who)} gritou LAST!`);
  if (f.type === 'penalty' && f.who === PID) shake('Esqueceu de gritar LAST! 😬');
  if (f.type === 'jump') toast(`⚡ ${f.who === PID ? 'Você' : nameOf(f.who)} CORTOU!`);
  if (f.type === 'swap' && (f.target === PID || f.who === PID)) toast('🔀 Sua mão foi trocada!');
  if (f.type === 'slapEnd' && f.losers.includes(PID)) shake('Você bateu por último! ✋');
});

// relógio da jogada (barrinha)
(function tick() {
  const bar = $('#timer div');
  const g = S && S.game;
  let pct = 0;
  if (g && g.phase === 'play' && g.deadline && S.room.rules.turnTime) {
    pct = Math.max(0, (g.deadline - (Date.now() + clockOffset)) / (S.room.rules.turnTime * 1000)) * 100;
  } else if (g && g.phase === 'slap' && g.slap) pct = Math.max(0, (g.slap.deadline - (Date.now() + clockOffset)) / 4500) * 100;
  bar.style.width = pct + '%';
  bar.style.background = pct < 25 ? 'var(--danger)' : 'var(--accent)';
  requestAnimationFrame(tick);
})();

// atualiza lista de salas públicas de vez em quando
setInterval(() => { if (!S && socket.connected) socket.emit('lobby:list'); }, 5000);
})();
