// =====================================================================
//  minisock.js - mini servidor WebSocket SEM dependências.
//  Imita o jeitinho do Socket.io: socket.on('evento'), socket.emit('evento', dados),
//  salas com join/leave e io.to('sala').emit(...).
//  Assim o jogo roda só com o Node.js instalado (não precisa "npm install").
// =====================================================================
const crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class MiniSocket {
  constructor(io, sock) {
    this.io = io; this.sock = sock;
    this.id = crypto.randomBytes(8).toString('hex');
    this.handlers = {}; this.rooms = new Set();
    this.buf = Buffer.alloc(0); this.frags = []; this.alive = true; this.closed = false;
    sock.setNoDelay(true);
    sock.on('data', (d) => this._onData(d));
    sock.on('close', () => this._close());
    sock.on('error', () => this._close());
  }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  _fire(ev, data) { (this.handlers[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error('Erro no evento', ev, e); } }); }
  emit(ev, data) { this._send(JSON.stringify({ e: ev, d: data })); }
  join(r) { this.rooms.add(r); this.io._room(r).add(this); }
  leave(r) { this.rooms.delete(r); const s = this.io.roomsMap.get(r); if (s) { s.delete(this); if (!s.size) this.io.roomsMap.delete(r); } }

  _send(str, opcode = 1) {
    if (this.closed) return;
    const payload = Buffer.from(str);
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | opcode;
    try { this.sock.write(Buffer.concat([head, payload])); } catch (e) { this._close(); }
  }
  _onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > 4e6) return this._close();
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 3e6) return this._close();
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = this.buf.subarray(need);
      if (op === 8) return this._close();
      if (op === 9) { this._send(payload, 10); continue; }   // ping -> pong
      if (op === 10) { this.alive = true; continue; }          // pong
      if (op === 1 || op === 0 || op === 2) {
        this.frags.push(payload);
        if (fin) {
          const text = Buffer.concat(this.frags).toString('utf8'); this.frags = [];
          this.alive = true;
          try { const m = JSON.parse(text); if (m && typeof m.e === 'string') this._fire(m.e, m.d); } catch (e) { /* ignora lixo */ }
        }
      }
    }
  }
  _close() {
    if (this.closed) return;
    this.closed = true;
    for (const r of [...this.rooms]) this.leave(r);
    this.io.sockets.delete(this.id);
    try { this.sock.destroy(); } catch (e) { }
    this._fire('disconnect');
  }
}

class MiniIO {
  constructor(server) {
    this.sockets = new Map(); this.roomsMap = new Map(); this.handlers = [];
    server.on('upgrade', (req, sock) => {
      const key = req.headers['sec-websocket-key'];
      if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') return sock.destroy();
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
      const s = new MiniSocket(this, sock);
      this.sockets.set(s.id, s);
      this.handlers.forEach(fn => fn(s));
    });
    // batimento: derruba conexões mortas (celular que perdeu sinal etc.)
    setInterval(() => {
      for (const s of this.sockets.values()) {
        if (!s.alive) { s._close(); continue; }
        s.alive = false; s._send('', 9);
      }
    }, 20000);
  }
  _room(r) { if (!this.roomsMap.has(r)) this.roomsMap.set(r, new Set()); return this.roomsMap.get(r); }
  on(ev, fn) { if (ev === 'connection') this.handlers.push(fn); }
  to(target) {
    return {
      emit: (ev, data) => {
        const msg = JSON.stringify({ e: ev, d: data });
        const s = this.sockets.get(target);
        if (s) return s._send(msg);
        const set = this.roomsMap.get(target);
        if (set) for (const x of set) x._send(msg);
      }
    };
  }
}
module.exports = { MiniIO };
