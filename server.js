// =====================================================================
//  FAST HANDS - servidor do jogo (protótipo)
//  Node.js puro (sem instalar nada além do Node)
//  Tudo que é "regra do jogo" acontece AQUI (o servidor é o juiz),
//  assim ninguém consegue trapacear mexendo no navegador.
// =====================================================================
const path = require('path');
const fs = require('fs');
const http = require('http');
const { MiniIO } = require('./minisock');

// servidor de arquivos simples (entrega a pasta "public" pro navegador)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const PUBLIC = path.join(__dirname, 'public');
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
const io = new MiniIO(server);
const PORT = process.env.PORT || 3000;

// ----------------------------- CONFIGURAÇÕES -----------------------------
const MAX_PLAYERS = 15;
const BOT_SPEED = Number(process.env.BOT_SPEED) || 1; // só pra testes
const COLORS = ['r', 'y', 'g', 'b'];
const COLOR_NAME = { r: 'Vermelho', y: 'Amarelo', g: 'Verde', b: 'Azul', w: 'Coringa' };

// Regras padrão (o dono da sala pode mudar tudo isso)
const DEFAULT_RULES = {
  handSize: 7,          // cartas iniciais
  wild: true,           // coringa (troca cor)
  wild4: true,          // coringa +4
  draw2: true,          // +2
  skip: true,           // bloqueio
  reverse: true,        // inverter
  nine: true,           // 9 = todo mundo bate na mesa
  zero: true,           // 0 = troca a mão com alguém
  seven: true,          // 7 = silêncio (ninguém corta/manda meme até o próximo jogar)
  jumpIn: true,         // cortar a vez com carta idêntica
  stacking: true,       // acumular +2 / +4
  drawUntilPlay: false, // comprar até sair carta que serve
  lastPenalty: 2,       // cartas por esquecer de apertar LAST!
  slapPenalty: 2,       // cartas pra quem bater por último no 9
  turnTime: 30,         // segundos por jogada (0 = sem tempo)
  decks: 0              // baralhos (0 = automático pelo nº de jogadores)
};

// ----------------------------- ESTADO GLOBAL -----------------------------
const rooms = new Map();    // código -> sala
const players = new Map();  // pid -> { pid, name, socketId, roomCode }
const BOT_NAMES = ['Bot Zé', 'Bot Lia', 'Bot Tonho', 'Bot Bia', 'Bot Caju', 'Bot Neném', 'Bot Dudu', 'Bot Kika',
  'Bot Rafa', 'Bot Malu', 'Bot Pipoca', 'Bot Tetê', 'Bot Juca', 'Bot Nina', 'Bot Chico', 'Bot Lulu'];

const now = () => Date.now();
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => L[Math.floor(Math.random() * L.length)]).join(''); } while (rooms.has(c));
  return c;
}

function sanitizeRules(r = {}, base = DEFAULT_RULES) {
  const out = { ...base };
  for (const k of Object.keys(DEFAULT_RULES)) {
    if (!(k in r)) continue;
    if (typeof DEFAULT_RULES[k] === 'boolean') out[k] = !!r[k];
    else out[k] = Number(r[k]) || 0;
  }
  out.handSize = clamp(Math.round(out.handSize), 3, 15);
  out.lastPenalty = clamp(Math.round(out.lastPenalty), 0, 6);
  out.slapPenalty = clamp(Math.round(out.slapPenalty), 0, 6);
  out.turnTime = clamp(Math.round(out.turnTime), 0, 120);
  out.decks = clamp(Math.round(out.decks), 0, 4);
  return out;
}

// ----------------------------- BARALHO -----------------------------
function buildDeck(rules, count) {
  const deck = [];
  let id = 0;
  const add = (color, value) => deck.push({ id: 'c' + (id++), color, value });
  for (let d = 0; d < count; d++) {
    for (const c of COLORS) {
      add(c, '0');
      for (let n = 1; n <= 9; n++) { add(c, String(n)); add(c, String(n)); }
      for (let k = 0; k < 2; k++) {
        if (rules.skip) add(c, 'skip');
        if (rules.reverse) add(c, 'rev');
        if (rules.draw2) add(c, 'd2');
      }
    }
    for (let k = 0; k < 4; k++) {
      if (rules.wild) add('w', 'wild');
      if (rules.wild4) add('w', 'w4');
    }
  }
  return shuffle(deck);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function cardName(c) {
  const v = { skip: 'Bloqueio', rev: 'Inverter', d2: '+2', wild: 'Coringa', w4: 'Coringa +4' }[c.value] || c.value;
  return c.color === 'w' ? v : `${v} ${COLOR_NAME[c.color]}`;
}

// ----------------------------- AJUDANTES DA PARTIDA -----------------------------
const top = (g) => g.discard[g.discard.length - 1];
const currentId = (g) => g.order[g.turn];
function nextIndex(g, steps = 1) {
  const n = g.order.length;
  return (((g.turn + g.dir * steps) % n) + n) % n;
}
function memberName(room, id) {
  const m = room.members.find(x => x.id === id);
  return m ? m.name : '???';
}
function canPlay(g, card) {
  const t = top(g);
  if (g.pending > 0) {
    // só dá pra acumular
    if (g.pendingType === 'd2') return card.value === 'd2' || card.value === 'w4';
    if (g.pendingType === 'w4') return card.value === 'w4';
    return false;
  }
  if (card.color === 'w') return true;
  return card.color === g.color || card.value === t.value;
}
function drawFromPile(g, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (g.draw.length === 0) {
      if (g.discard.length <= 1) break;           // acabou tudo
      const t = g.discard.pop();
      g.draw = shuffle(g.discard);
      g.discard = [t];
    }
    got.push(g.draw.pop());
  }
  return got;
}
function give(room, pid, n) {
  const g = room.game;
  const cards = drawFromPile(g, n);
  g.hands[pid].push(...cards);
  g.called[pid] = false;
  return cards;
}
function log(room, text) {
  const g = room.game;
  if (process.env.DEBUG) console.log(room.code, text);
  if (g) { g.log.push({ t: now(), text }); if (g.log.length > 60) g.log.shift(); }
}
function fx(room, data) { io.to(room.code).emit('fx', data); }

function startTurn(room) {
  const g = room.game;
  g.phase = 'play';
  g.hasDrawn = false;
  g.drawnCardId = null;
  const cur = currentId(g);
  const m = room.members.find(x => x.id === cur);
  if (room.rules.turnTime > 0) g.deadline = now() + room.rules.turnTime * 1000;
  else g.deadline = (m && !m.isBot && !m.connected) ? now() + 10000 : 0;
  g.botAt = now() + rand(900, 1700) * BOT_SPEED;
}

// Quem ficou com 1 carta e NÃO apertou LAST! antes do próximo agir, compra.
function checkLastPenalty(room, actorId) {
  const g = room.game;
  const w = g.lastWatch;
  if (!w || w === actorId) return;
  g.lastWatch = null;
  if (g.hands[w] && g.hands[w].length === 1 && !g.called[w] && room.rules.lastPenalty > 0) {
    give(room, w, room.rules.lastPenalty);
    log(room, `😬 ${memberName(room, w)} esqueceu de gritar LAST! e comprou ${room.rules.lastPenalty}`);
    fx(room, { type: 'penalty', who: w });
  }
}

// ----------------------------- AÇÕES -----------------------------
// Cada ação devolve uma string de erro (vira o "tremor" na tela) ou null se deu certo.
function actPlay(room, pid, { cardId, color, target } = {}) {
  const g = room.game;
  if (!g || g.phase !== 'play') return 'Agora não dá';
  const hand = g.hands[pid];
  if (!hand) return 'Você não está nessa rodada';
  const idx = hand.findIndex(c => c.id === cardId);
  if (idx < 0) return 'Carta não encontrada';
  const card = hand[idx];
  const t = top(g);
  const isTurn = currentId(g) === pid;
  let jump = false;

  if (!isTurn) {
    if (room.rules.jumpIn && !g.silence && g.pending === 0 && t.color !== 'w' &&
        card.color === t.color && card.value === t.value) jump = true;
    else return g.silence ? 'Silêncio do 7! Espere o próximo jogar' : 'Não é sua vez';
  } else {
    if (g.hasDrawn && !room.rules.drawUntilPlay && card.id !== g.drawnCardId) return 'Depois de comprar, só pode jogar a carta comprada';
    if (!canPlay(g, card)) return 'Essa carta não pode ser jogada';
  }
  if (card.color === 'w' && !COLORS.includes(color)) return 'Escolha uma cor';
  let targetId = null;
  if (card.value === '0' && room.rules.zero) {
    if (!g.order.includes(target) || target === pid) return 'Escolha com quem trocar a mão';
    targetId = target;
  }

  // --- a jogada é válida ---
  checkLastPenalty(room, pid);
  g.silence = false;
  hand.splice(idx, 1);
  g.discard.push(card);
  g.color = card.color === 'w' ? color : card.color;
  g.called[pid] = false;
  const name = memberName(room, pid);

  if (jump) {
    g.turn = g.order.indexOf(pid);
    g.pending = 0; g.pendingType = null;
    log(room, `⚡ ${name} CORTOU a vez com ${cardName(card)}!`);
    fx(room, { type: 'jump', who: pid });
  } else {
    log(room, `${name} jogou ${cardName(card)}${card.color === 'w' ? ' → ' + COLOR_NAME[color] : ''}`);
  }
  fx(room, { type: 'play', who: pid, value: card.value });

  if (hand.length === 0) return endRound(room, pid), null;
  if (hand.length === 1) {
    g.lastWatch = pid;
    g.botLastAt = now() + rand(400, 1800) * BOT_SPEED;
    g.botForgets = Math.random() < 0.15;
  }

  let steps = 1;
  const v = card.value;
  const n = g.order.length;
  if (v === 'skip') { steps = 2; log(room, `⛔ ${memberName(room, g.order[nextIndex(g, 1)])} foi bloqueado`); }
  else if (v === 'rev') { g.dir *= -1; if (n === 2) steps = 2; log(room, '🔄 Sentido invertido'); }
  else if (v === 'd2' || v === 'w4') {
    const amt = v === 'd2' ? 2 : 4;
    if (room.rules.stacking) { g.pending += amt; g.pendingType = v; }
    else {
      const victim = g.order[nextIndex(g, 1)];
      give(room, victim, amt);
      log(room, `${memberName(room, victim)} comprou ${amt} e perdeu a vez`);
      steps = 2;
    }
  } else if (v === '0' && targetId) {
    const a = g.hands[pid]; g.hands[pid] = g.hands[targetId]; g.hands[targetId] = a;
    g.called[pid] = false; g.called[targetId] = false;
    g.lastWatch = g.hands[targetId].length === 1 ? targetId : (g.hands[pid].length === 1 ? pid : null);
    g.botLastAt = now() + rand(400, 1800) * BOT_SPEED;
    log(room, `🔀 ${name} trocou a mão com ${memberName(room, targetId)}!`);
    fx(room, { type: 'swap', who: pid, target: targetId });
  } else if (v === '7' && room.rules.seven) {
    g.silence = true;
    log(room, '🤫 SILÊNCIO! Ninguém corta nem manda meme até o próximo jogar');
    fx(room, { type: 'silence' });
  }

  g.turn = nextIndex(g, steps);
  if (v === '9' && room.rules.nine) startSlap(room);
  else startTurn(room);
  return null;
}

function actDraw(room, pid, auto = false) {
  const g = room.game;
  if (!g || g.phase !== 'play') return 'Agora não dá';
  if (currentId(g) !== pid) return 'Não é sua vez';
  const name = memberName(room, pid);
  if (g.pending > 0) {
    checkLastPenalty(room, pid);
    g.silence = false;
    give(room, pid, g.pending);
    log(room, `${name} comprou ${g.pending} cartas 😵`);
    fx(room, { type: 'draw', who: pid, n: g.pending });
    g.pending = 0; g.pendingType = null;
    g.turn = nextIndex(g, 1);
    startTurn(room);
    return null;
  }
  if (g.hasDrawn) return 'Você já comprou — jogue a carta ou passe';
  checkLastPenalty(room, pid);
  g.silence = false;
  let last = null, count = 0;
  if (room.rules.drawUntilPlay) {
    for (let i = 0; i < 40; i++) { const c = give(room, pid, 1)[0]; if (!c) break; count++; last = c; if (canPlay(g, c)) break; }
  } else { last = give(room, pid, 1)[0] || null; count = last ? 1 : 0; }
  g.hasDrawn = true;
  g.drawnCardId = last ? last.id : null;
  fx(room, { type: 'draw', who: pid, n: count });
  if (!last || !canPlay(g, last) || auto) {
    log(room, `${name} comprou ${count > 1 ? count + ' cartas' : '1 carta'} e passou`);
    g.turn = nextIndex(g, 1);
    startTurn(room);
  } else log(room, `${name} comprou ${count > 1 ? count + ' cartas' : '1 carta'}`);
  return null;
}

function actPass(room, pid) {
  const g = room.game;
  if (!g || g.phase !== 'play') return 'Agora não dá';
  if (currentId(g) !== pid) return 'Não é sua vez';
  if (!g.hasDrawn) return 'Compre uma carta antes de passar';
  log(room, `${memberName(room, pid)} passou`);
  g.turn = nextIndex(g, 1);
  startTurn(room);
  return null;
}

function actLast(room, pid) {
  const g = room.game;
  if (!g || !g.hands[pid]) return 'Agora não dá';
  if (g.hands[pid].length !== 1) return 'Só dá pra gritar com 1 carta na mão';
  if (g.called[pid]) return null;
  g.called[pid] = true;
  log(room, `📣 ${memberName(room, pid)} gritou LAST!`);
  fx(room, { type: 'last', who: pid });
  return null;
}

// ---- 9: todo mundo bate na mesa ----
function startSlap(room) {
  const g = room.game;
  g.phase = 'slap';
  const botTimes = {};
  for (const id of g.order) {
    const m = room.members.find(x => x.id === id);
    if (m && m.isBot) botTimes[id] = now() + rand(500, 3200) * BOT_SPEED;
  }
  g.slap = { deadline: now() + 4500, pressed: [], botTimes };
  fx(room, { type: 'slapStart' });
}
function actSlap(room, pid) {
  const g = room.game;
  if (!g || g.phase !== 'slap' || !g.order.includes(pid)) return null;
  if (g.slap.pressed.includes(pid)) return null;
  g.slap.pressed.push(pid);
  fx(room, { type: 'slap', who: pid });
  if (g.slap.pressed.length >= g.order.length) resolveSlap(room);
  return null;
}
function resolveSlap(room) {
  const g = room.game;
  const missed = g.order.filter(id => !g.slap.pressed.includes(id));
  const losers = missed.length ? missed : [g.slap.pressed[g.slap.pressed.length - 1]];
  const pen = room.rules.slapPenalty;
  for (const id of losers) if (pen > 0) give(room, id, pen);
  log(room, `✋ Bateu por último: ${losers.map(id => memberName(room, id)).join(', ')}${pen ? ` (+${pen})` : ''}`);
  fx(room, { type: 'slapEnd', losers });
  g.slap = null;
  startTurn(room);
}

function endRound(room, winnerId) {
  const g = room.game;
  g.phase = 'over';
  g.winner = winnerId;
  g.deadline = 0;
  const m = room.members.find(x => x.id === winnerId);
  if (m) m.wins = (m.wins || 0) + 1;
  log(room, `🏆 ${memberName(room, winnerId)} VENCEU a rodada!`);
  fx(room, { type: 'win', who: winnerId });
}

function startGame(room) {
  const ids = room.members.map(m => m.id);
  if (ids.length < 2) return 'Precisa de pelo menos 2 jogadores (adicione bots!)';
  const r = room.rules;
  const decks = r.decks > 0 ? r.decks : Math.max(1, Math.ceil(ids.length * r.handSize / 55));
  const g = {
    order: shuffle(ids.slice()), hands: {}, called: {}, draw: buildDeck(r, decks), discard: [],
    color: null, turn: 0, dir: 1, pending: 0, pendingType: null, phase: 'play', slap: null,
    silence: false, lastWatch: null, hasDrawn: false, drawnCardId: null, deadline: 0,
    winner: null, log: [], decks
  };
  room.game = g;
  for (const id of g.order) { g.hands[id] = []; g.called[id] = false; give(room, id, r.handSize); }
  // primeira carta da mesa tem que ser número
  let first;
  for (let i = 0; i < 200; i++) {
    first = g.draw.pop();
    if (/^[0-9]$/.test(first.value)) break;
    g.draw.unshift(first);
  }
  g.discard.push(first);
  g.color = first.color;
  log(room, `🃏 Rodada começou! ${ids.length} jogadores, ${decks} baralho(s). Mesa: ${cardName(first)}`);
  startTurn(room);
  fx(room, { type: 'start' });
  return null;
}

function removeFromGame(room, id) {
  const g = room.game;
  if (!g || !g.order.includes(id)) return;
  const wasCur = currentId(g) === id;
  const nextId = g.order.length > 1 ? g.order[nextIndex(g, 1)] : null;
  const curId = currentId(g);
  g.draw.unshift(...(g.hands[id] || []));
  delete g.hands[id];
  g.order = g.order.filter(x => x !== id);
  if (g.lastWatch === id) g.lastWatch = null;
  if (g.phase === 'over') return;
  if (g.order.length < 2) { if (g.order[0]) endRound(room, g.order[0]); else room.game = null; return; }
  g.turn = g.order.indexOf(wasCur ? nextId : curId);
  if (g.turn < 0) g.turn = 0;
  if (g.phase === 'slap') {
    g.slap.pressed = g.slap.pressed.filter(x => x !== id);
    if (g.slap.pressed.length >= g.order.length) resolveSlap(room);
  } else if (wasCur) startTurn(room);
}

// ----------------------------- BOTS -----------------------------
function bestColor(hand) {
  const cnt = { r: 0, y: 0, g: 0, b: 0 };
  hand.forEach(c => { if (c.color !== 'w') cnt[c.color]++; });
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
}
function botAct(room, id) {
  const g = room.game;
  const hand = g.hands[id];
  const pick = (c) => {
    const opts = { cardId: c.id };
    if (c.color === 'w') opts.color = bestColor(hand.filter(x => x.id !== c.id));
    if (c.value === '0' && room.rules.zero) {
      const others = g.order.filter(x => x !== id).sort((a, b) => g.hands[a].length - g.hands[b].length);
      opts.target = others[0];
    }
    return actPlay(room, id, opts);
  };
  if (g.hasDrawn) {
    const c = room.rules.drawUntilPlay ? hand.find(x => canPlay(g, x)) : hand.find(x => x.id === g.drawnCardId);
    if (c && canPlay(g, c)) return pick(c);
    return actPass(room, id);
  }
  const playable = hand.filter(c => canPlay(g, c));
  if (playable.length) {
    playable.sort((a, b) => (a.color === 'w') - (b.color === 'w'));
    return pick(playable[0]);
  }
  actDraw(room, id);
  if (room.game && currentId(g) === id && g.phase === 'play') g.botAt = now() + rand(600, 1100);
}

// ----------------------------- RELÓGIO (bots, tempo, 9) -----------------------------
setInterval(() => {
  for (const room of rooms.values()) {
    const g = room.game;
    if (!g) continue;
    let changed = false;
    try {
      if (g.lastWatch && g.phase !== 'over') {
        const m = room.members.find(x => x.id === g.lastWatch);
        if (m && m.isBot && !g.called[m.id] && !g.botForgets && now() >= g.botLastAt) { actLast(room, m.id); changed = true; }
      }
      if (g.phase === 'slap') {
        for (const [id, t] of Object.entries(g.slap.botTimes)) {
          if (g.phase === 'slap' && now() >= t && !g.slap.pressed.includes(id)) { actSlap(room, id); changed = true; }
        }
        if (g.phase === 'slap' && now() >= g.slap.deadline) { resolveSlap(room); changed = true; }
      } else if (g.phase === 'play') {
        const cur = currentId(g);
        const m = room.members.find(x => x.id === cur);
        if (m && m.isBot) {
          if (now() >= g.botAt) { botAct(room, cur); changed = true; }
        } else if (m && !m.connected && !g.deadline) {
          g.deadline = now() + 10000; changed = true;
        } else if (g.deadline && now() >= g.deadline) {
          log(room, `⏰ Tempo esgotado para ${memberName(room, cur)}`);
          if (g.pending > 0 || !g.hasDrawn) actDraw(room, cur, true);
          else actPass(room, cur);
          changed = true;
        }
      }
    } catch (e) { console.error('Erro no relógio da sala', room.code, e); }
    if (changed) sync(room);
  }
}, 200);

// limpa salas vazias
setInterval(() => {
  for (const [code, room] of rooms) {
    const humansOn = room.members.some(m => !m.isBot && m.connected);
    if (!humansOn && now() - room.lastActive > 3 * 60 * 1000) rooms.delete(code);
    // remove humanos desconectados há muito tempo
    for (const m of room.members.slice()) {
      if (!m.isBot && !m.connected && now() - (m.leftAt || 0) > 90 * 1000) leaveRoom(m.id, true);
    }
  }
}, 15000);

// ----------------------------- SALAS -----------------------------
function view(room, pid) {
  const g = room.game;
  return {
    me: pid,
    now: now(),
    room: { code: room.code, name: room.name, isPublic: room.isPublic, maxPlayers: room.maxPlayers, hostId: room.hostId, rules: room.rules },
    members: room.members.map(m => ({
      id: m.id, name: m.name, isBot: !!m.isBot, connected: !!m.connected, voiceOn: !!m.voiceOn, muted: !!m.muted,
      wins: m.wins || 0,
      inGame: !!(g && g.hands[m.id]),
      count: g && g.hands[m.id] ? g.hands[m.id].length : 0,
      called: !!(g && g.called[m.id])
    })),
    chat: room.chat.slice(-40),
    game: g ? {
      order: g.order, turn: currentId(g), dir: g.dir, top: top(g), color: g.color,
      pending: g.pending, pendingType: g.pendingType, phase: g.phase, silence: g.silence,
      slap: g.slap ? { deadline: g.slap.deadline, pressed: g.slap.pressed } : null,
      drawCount: g.draw.length, hand: g.hands[pid] || null,
      hasDrawn: currentId(g) === pid ? g.hasDrawn : false, drawnCardId: currentId(g) === pid ? g.drawnCardId : null,
      deadline: g.deadline, winner: g.winner, log: g.log.slice(-25), decks: g.decks
    } : null
  };
}
function sync(room) {
  room.lastActive = now();
  for (const m of room.members) {
    if (m.isBot || !m.connected) continue;
    const p = players.get(m.id);
    if (p && p.socketId) io.to(p.socketId).emit('state', view(room, m.id));
  }
}
function lobbyList() {
  return [...rooms.values()].filter(r => r.isPublic).map(r => ({
    code: r.code, name: r.name, count: r.members.length, max: r.maxPlayers,
    inGame: !!(r.game && r.game.phase !== 'over'), host: memberName(r, r.hostId)
  }));
}
function broadcastLobby() { io.to('lobby').emit('lobby', lobbyList()); }

function joinRoom(socket, p, room) {
  if (p.roomCode && p.roomCode !== room.code) leaveRoom(p.pid);
  let m = room.members.find(x => x.id === p.pid);
  if (!m) {
    if (room.members.length >= room.maxPlayers) return 'Sala cheia';
    m = { id: p.pid, name: p.name, connected: true, wins: 0 };
    room.members.push(m);
    if (room.game && room.game.phase !== 'over') room.chat.push({ sys: true, t: now(), text: `${p.name} entrou (joga na próxima rodada)` });
    else room.chat.push({ sys: true, t: now(), text: `${p.name} entrou na sala` });
  }
  m.connected = true; m.name = p.name;
  p.roomCode = room.code;
  socket.leave('lobby');
  socket.join(room.code);
  if (!room.hostId || !room.members.find(x => x.id === room.hostId && !x.isBot)) room.hostId = p.pid;
  sync(room); broadcastLobby();
  return null;
}
function leaveRoom(pid, silent) {
  const p = players.get(pid);
  const code = p ? p.roomCode : null;
  const room = code ? rooms.get(code) : [...rooms.values()].find(r => r.members.some(m => m.id === pid));
  if (!room) return;
  const m = room.members.find(x => x.id === pid);
  removeFromGame(room, pid);
  room.members = room.members.filter(x => x.id !== pid);
  if (m) room.chat.push({ sys: true, t: now(), text: `${m.name} saiu` });
  if (p) {
    p.roomCode = null;
    const s = p.socketId && io.sockets.get(p.socketId);
    if (s) { s.leave(room.code); s.join('lobby'); }
  }
  const humans = room.members.filter(x => !x.isBot);
  if (!humans.length) { rooms.delete(room.code); broadcastLobby(); return; }
  if (room.hostId === pid) room.hostId = (humans.find(x => x.connected) || humans[0]).id;
  sync(room); broadcastLobby();
}

// ----------------------------- CONEXÕES -----------------------------
io.on('connection', (socket) => {
  let p = null;
  const room = () => (p && p.roomCode ? rooms.get(p.roomCode) : null);
  const isHost = () => room() && room().hostId === p.pid;
  const reply = (err) => { if (err) socket.emit('invalid', { reason: err }); };
  const rate = {};
  const limited = (k, ms) => { const t = now(); if (rate[k] && t - rate[k] < ms) return true; rate[k] = t; return false; };

  socket.on('hello', ({ pid, name } = {}) => {
    pid = String(pid || '').slice(0, 40) || ('p' + Math.random().toString(36).slice(2, 10));
    name = String(name || 'Jogador').trim().slice(0, 16) || 'Jogador';
    p = players.get(pid) || { pid, roomCode: null };
    p.name = name; p.socketId = socket.id;
    players.set(pid, p);
    socket.emit('welcome', { pid, roomCode: p.roomCode });
    const r = room();
    if (r) {
      const m = r.members.find(x => x.id === pid);
      if (m) { m.connected = true; m.name = name; socket.join(r.code); sync(r); return; }
      p.roomCode = null;
    }
    socket.join('lobby');
    socket.emit('lobby', lobbyList());
  });

  socket.on('lobby:list', () => socket.emit('lobby', lobbyList()));

  socket.on('room:create', ({ name, isPublic, maxPlayers, rules } = {}) => {
    if (!p) return;
    const code = makeCode();
    const r = {
      code, name: String(name || `Sala de ${p.name}`).slice(0, 30), isPublic: !!isPublic,
      maxPlayers: clamp(Number(maxPlayers) || 8, 2, MAX_PLAYERS), hostId: p.pid,
      members: [], rules: sanitizeRules(rules), game: null, chat: [], lastActive: now()
    };
    rooms.set(code, r);
    reply(joinRoom(socket, p, r));
  });

  socket.on('room:join', ({ code } = {}) => {
    if (!p) return;
    const r = rooms.get(String(code || '').toUpperCase().trim());
    if (!r) return reply('Sala não encontrada');
    reply(joinRoom(socket, p, r));
  });

  socket.on('room:quick', () => {
    if (!p) return;
    const list = [...rooms.values()].filter(r => r.isPublic && r.members.length < r.maxPlayers)
      .sort((a, b) => (!!a.game - !!b.game) || (b.members.length - a.members.length));
    if (!list.length) return reply('Nenhuma sala pública aberta agora — crie uma!');
    reply(joinRoom(socket, p, list[0]));
  });

  socket.on('room:leave', () => { if (p) leaveRoom(p.pid); socket.emit('left'); socket.emit('lobby', lobbyList()); });

  socket.on('room:settings', ({ rules, isPublic, maxPlayers, name } = {}) => {
    const r = room(); if (!r || !isHost()) return;
    if (rules) r.rules = sanitizeRules(rules, r.rules);
    if (typeof isPublic === 'boolean') r.isPublic = isPublic;
    if (maxPlayers) r.maxPlayers = clamp(Number(maxPlayers), Math.max(2, r.members.length), MAX_PLAYERS);
    if (name) r.name = String(name).slice(0, 30);
    sync(r); broadcastLobby();
  });

  socket.on('room:addBot', () => {
    const r = room(); if (!r || !isHost()) return;
    if (r.members.length >= r.maxPlayers) return reply('Sala cheia');
    const used = new Set(r.members.map(m => m.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot ' + r.members.length;
    r.members.push({ id: 'bot_' + Math.random().toString(36).slice(2, 8), name, isBot: true, connected: true, wins: 0 });
    sync(r); broadcastLobby();
  });

  socket.on('room:kick', ({ id } = {}) => {
    const r = room(); if (!r || !isHost() || id === p.pid) return;
    const m = r.members.find(x => x.id === id); if (!m) return;
    if (m.isBot) { removeFromGame(r, id); r.members = r.members.filter(x => x.id !== id); sync(r); broadcastLobby(); }
    else {
      const kp = players.get(id);
      leaveRoom(id);
      if (kp && kp.socketId) io.to(kp.socketId).emit('kicked');
    }
  });

  socket.on('game:start', () => {
    const r = room(); if (!r || !isHost()) return;
    if (r.game && r.game.phase !== 'over') return reply('A rodada ainda está rolando');
    reply(startGame(r)); sync(r); broadcastLobby();
  });
  socket.on('game:stop', () => {
    const r = room(); if (!r || !isHost()) return;
    r.game = null; sync(r); broadcastLobby();
  });

  const gameAction = (fn) => (data) => {
    const r = room(); if (!r || !r.game) return reply('Nenhuma rodada rolando');
    try { reply(fn(r, p.pid, data)); } catch (e) { console.error(e); reply('Erro no servidor'); }
    sync(r);
  };
  socket.on('play', gameAction((r, pid, d) => actPlay(r, pid, d)));
  socket.on('draw', gameAction((r, pid) => actDraw(r, pid)));
  socket.on('pass', gameAction((r, pid) => actPass(r, pid)));
  socket.on('last', gameAction((r, pid) => actLast(r, pid)));
  socket.on('slap', gameAction((r, pid) => actSlap(r, pid)));

  // ---- chat, frases e memes ----
  const silenced = (r) => r.game && r.game.silence && r.game.phase === 'play';
  socket.on('chat', ({ text } = {}) => {
    const r = room(); if (!r || limited('chat', 400)) return;
    text = String(text || '').trim().slice(0, 200); if (!text) return;
    r.chat.push({ from: p.pid, name: p.name, text, t: now() });
    if (r.chat.length > 80) r.chat.shift();
    sync(r);
  });
  socket.on('phrase', ({ text } = {}) => {
    const r = room(); if (!r) return;
    if (silenced(r)) return reply('🤫 Silêncio do 7! Espere o próximo jogar');
    if (limited('say', 2000)) return reply('Calma! Espere 2 segundos');
    text = String(text || '').trim().slice(0, 80); if (!text) return;
    io.to(r.code).emit('phrase', { from: p.pid, name: p.name, text });
  });
  socket.on('meme', ({ label, audio } = {}) => {
    const r = room(); if (!r) return;
    if (silenced(r)) return reply('🤫 Silêncio do 7! Espere o próximo jogar');
    if (limited('say', 2000)) return reply('Calma! Espere 2 segundos');
    if (typeof audio !== 'string' || !audio.startsWith('data:audio') || audio.length > 1.4e6) return reply('Áudio inválido ou muito grande');
    io.to(r.code).emit('meme', { from: p.pid, name: p.name, label: String(label || '').slice(0, 30), audio });
  });

  // ---- voz (WebRTC: o servidor só passa os "recados" entre os navegadores) ----
  socket.on('voice', ({ on, muted } = {}) => {
    const r = room(); if (!r) return;
    const m = r.members.find(x => x.id === p.pid); if (!m) return;
    if (typeof on === 'boolean') m.voiceOn = on;
    if (typeof muted === 'boolean') m.muted = muted;
    sync(r);
  });
  socket.on('rtc', ({ to, data } = {}) => {
    const r = room(); if (!r || !r.members.some(x => x.id === to)) return;
    const tp = players.get(to);
    if (tp && tp.socketId) io.to(tp.socketId).emit('rtc', { from: p.pid, data });
  });

  socket.on('disconnect', () => {
    if (!p || p.socketId !== socket.id) return;
    p.socketId = null;
    const r = room();
    if (r) {
      const m = r.members.find(x => x.id === p.pid);
      if (m) { m.connected = false; m.voiceOn = false; m.leftAt = now(); }
      sync(r);
    }
  });
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  FAST HANDS rodando!');
  console.log(`  Abra no navegador:  http://localhost:${PORT}`);
  console.log('  (Deixe esta janela aberta enquanto joga)');
  console.log('==============================================');
});
