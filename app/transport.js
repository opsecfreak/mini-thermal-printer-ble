// Web Bluetooth transport for the MX10.
// One async write queue owns the characteristic. Status polls use the same queue
// and pause during a print job. Writes pause on "buffer full" (ae 10) and resume on ae 00.

import { ADV_SERVICE, PRINT_SERVICE, TX_CHAR, RX_CHAR, PacketParser, commands, decode, describeTx, hex } from './protocol.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const short = uuid => { const m = /^0000([0-9a-f]{4})-/i.exec(uuid); return m ? m[1] : uuid; };

// Settings proven on the MX10 (probe 2026-11-10). The simple UI does not expose these.
export const DEFAULTS = Object.freeze({
  energy: 24000,
  speed: 32,
  feedSpeed: 8,
  feedAfter: 50,
  rowDelayMs: 5,
  resumeTimeoutMs: 10000,
  cancelFeed: 50,
  doneTimeoutMs: 30000,
});

export class Printer extends EventTarget {
  constructor({ log } = {}) {
    super();
    this.log = log || (() => {});
    this.device = null;
    this.tx = null;
    this.rx = null;
    this.state = 'disconnected';
    this.job = null;
    this.flowFull = false;
    this.status = null;
    this.parser = new PacketParser();
    this._chain = Promise.resolve();
    this._onNotify = this._onNotify.bind(this);
    this._onDisconnect = this._onDisconnect.bind(this);
    this._pollTimer = null;
  }

  get connected() { return this.state === 'connected' && !!this.tx; }
  get deviceName() { return this.device?.name || ''; }

  _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  _setState(s) { this.state = s; this._emit('state', { state: s, name: this.deviceName }); }

  async connect() {
    if (this.state === 'connecting' || this.state === 'connected') return;
    if (!navigator.bluetooth) throw new Error('Web Bluetooth is not available. Use Chrome on http://127.0.0.1 or https.');
    this._setState('connecting');
    try {
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ services: [ADV_SERVICE] }, { services: [PRINT_SERVICE] }, { namePrefix: 'MX' }],
        optionalServices: [PRINT_SERVICE],
      });
      if (this.device && this.device !== dev) this.device.removeEventListener('gattserverdisconnected', this._onDisconnect);
      this.device = dev;
      dev.addEventListener('gattserverdisconnected', this._onDisconnect); // same function ref: never added twice
      this.log('INFO', `Selected "${dev.name}"`);
      await this._openGatt();
    } catch (e) {
      this._setState('disconnected');
      this.log(e.name === 'NotFoundError' ? 'INFO' : 'ERR', `Connect: ${e.message}`);
      throw e;
    }
  }

  async reconnect() {
    if (!this.device) return this.connect();
    if (this.state !== 'disconnected') return;
    this._setState('connecting');
    try { await this._openGatt(); } catch (e) { this._setState('disconnected'); this.log('ERR', `Reconnect: ${e.message}`); throw e; }
  }

  async _openGatt() {
    const t = performance.now();
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(PRINT_SERVICE);
    const chars = await svc.getCharacteristics();
    const list = chars.map(c => `${short(c.uuid)}[${['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter(k => c.properties[k]).join(',')}]`);
    this.log('INFO', `GATT ${Math.round(performance.now() - t)} ms, AE30 characteristics: ${list.join(' ')}`);
    const want = n => chars.find(c => short(c.uuid) === n.toString(16).padStart(4, '0'));
    const tx = want(TX_CHAR) || chars.find(c => c.properties.writeWithoutResponse);
    const rx = want(RX_CHAR) || chars.find(c => c.properties.notify);
    if (!tx || !rx) throw new Error('Printer characteristics not found (expected AE01/AE02)');
    if (this.rx && this.rx !== rx) this.rx.removeEventListener('characteristicvaluechanged', this._onNotify);
    rx.addEventListener('characteristicvaluechanged', this._onNotify);
    await rx.startNotifications();
    this.tx = tx;
    this.rx = rx;
    this.parser.reset();
    this.flowFull = false;
    this.log('INFO', `Using write ${short(tx.uuid)}, notify ${short(rx.uuid)}`);
    this._setState('connected');
    this.send(commands.status()).catch(() => {});
  }

  async disconnect() {
    this.stopPolling();
    if (this.job) this.job.cancel = true;
    try { await this.rx?.stopNotifications(); } catch {}
    try { this.device?.gatt?.disconnect(); } catch {}
    this.tx = null;
    this._setState('disconnected');
    this.log('INFO', 'Disconnected');
  }

  _onDisconnect() {
    if (this.job) { this.job.cancel = true; this.job.disconnected = true; }
    this.tx = null;
    this.flowFull = false;
    this._setState('disconnected');
    this.log('WARN', 'Printer disconnected');
  }

  _onNotify(ev) {
    const v = ev.target.value;
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice();
    const { packets, junk } = this.parser.push(bytes);
    if (junk.length) this.log('WARN', 'Unparsed bytes', { hex: hex(junk) });
    for (const p of packets) {
      const d = decode(p);
      let note = d.name;
      if (d.kind === 'status') {
        this.status = d;
        note = `status flags=0x${d.flags.toString(16)} level=${d.level}`;
        this._emit('status', d);
      } else if (d.kind === 'flow') {
        this.flowFull = d.full;
        note = d.full ? 'BUFFER FULL (pause)' : 'buffer ok (resume)';
        this._emit('flow', d);
      } else if (d.kind === 'temp') {
        note = `temp ${d.value}`;
        this._emit('temp', d);
      } else if (d.kind === 'info') note = `info "${d.text}"`;
      this.log('RX', note + (d.crcOk ? '' : ' (CRC mismatch)'), { hex: hex(p), quiet: d.kind === 'status' && this._pollQuiet });
    }
  }

  // ---- write queue ----
  send(bytes, { quiet = false } = {}) {
    const p = this._chain.then(() => this._write(bytes, quiet));
    this._chain = p.catch(() => {});
    return p;
  }

  async _write(bytes, quiet) {
    const tx = this.tx;
    if (!tx) throw new Error('Printer not connected');
    this.log('TX', describeTx(bytes), { hex: hex(bytes), quiet });
    try {
      if (tx.properties.writeWithoutResponse) await tx.writeValueWithoutResponse(bytes);
      else await tx.writeValueWithResponse(bytes);
    } catch (e) {
      this.log('ERR', `Write failed: ${e.name}: ${e.message}`, { hex: hex(bytes) });
      throw e;
    }
  }

  startPolling(ms = 15000) {
    this.stopPolling();
    this._pollTimer = setInterval(() => {
      if (!this.connected || this.job) return;
      this._pollQuiet = true;
      this.send(commands.status(), { quiet: true }).catch(() => {}).finally(() => setTimeout(() => (this._pollQuiet = false), 500));
    }, ms);
  }
  stopPolling() { clearInterval(this._pollTimer); this._pollTimer = null; }

  async _waitBuffer(job, timeout) {
    if (!this.flowFull) return;
    const t0 = performance.now();
    this.log('INFO', 'Printer buffer full, waiting');
    job.pauses++;
    while (this.flowFull) {
      if (job.cancel && !job.draining) return;
      if (!this.connected) throw new Error('Printer disconnected');
      if (performance.now() - t0 > timeout) throw new Error(`Printer did not resume within ${Math.round(timeout / 1000)} s after "buffer full"`);
      await sleep(15);
    }
    this.log('INFO', `Resumed after ${Math.round(performance.now() - t0)} ms`);
  }

  // Waits for the printer to report it finished (ae 00), or times out quietly.
  _waitDone(timeout) {
    return new Promise(resolve => {
      const done = ok => { clearTimeout(t); this.removeEventListener('flow', on); resolve(ok); };
      const on = e => { if (!e.detail.full) done(true); };
      const t = setTimeout(() => done(false), timeout);
      this.addEventListener('flow', on);
    });
  }

  /**
   * Print a list of jobs. Each job: { rows: Uint8Array[48][], energy?, speed?, feedAfter? }.
   * Calls onProgress({sent,total}). Returns {outcome, sent, total, pauses, seconds}.
   */
  async print(jobs, opts = {}, onProgress = () => {}) {
    if (!this.connected) throw new Error('Printer not connected');
    if (this.job) throw new Error('Already printing');
    const o = { ...DEFAULTS, ...opts };
    const total = jobs.reduce((n, j) => n + j.rows.length, 0);
    const job = (this.job = { cancel: false, draining: false, disconnected: false, pauses: 0 });
    const t0 = performance.now();
    let sent = 0;
    let outcome = 'sent';
    this._emit('job', { active: true });
    this.log('INFO', `Print: ${jobs.length} part(s), ${total} rows (${(total / 203).toFixed(2)} in)`);
    try {
      for (const [i, j] of jobs.entries()) {
        if (job.cancel) break;
        const speed = j.speed ?? o.speed;
        await this.send(commands.status());
        await this.send(commands.speed(speed));
        await this.send(commands.energy(j.energy ?? o.energy));
        await this.send(commands.mode(1));
        for (let r = 0; r < j.rows.length; r++) {
          if (job.cancel) break;
          await this._waitBuffer(job, o.resumeTimeoutMs);
          if (job.cancel) break;
          await this.send(commands.row(j.rows[r]), { quiet: !(r < 2 || r === j.rows.length - 1 || r % 100 === 0) });
          sent++;
          if ((sent & 3) === 0 || r === j.rows.length - 1) onProgress({ sent, total });
          if (o.rowDelayMs) await sleep(o.rowDelayMs);
        }
        const feed = j.feedAfter ?? (i === jobs.length - 1 ? o.feedAfter : 0);
        if (!job.cancel && feed > 0) {
          await this.send(commands.speed(o.feedSpeed));
          await this.send(commands.feed(feed));
          await this.send(commands.speed(speed));
        }
      }
      if (job.cancel) {
        outcome = job.disconnected ? 'disconnected' : 'cancelled';
        if (!job.disconnected && this.connected) {
          job.draining = true;
          await this._waitBuffer(job, o.resumeTimeoutMs).catch(() => {});
          if (o.cancelFeed > 0) await this.send(commands.feed(o.cancelFeed));
        }
      }
    } catch (e) {
      outcome = 'error';
      this.log('ERR', `Print failed after ${sent}/${total} rows: ${e.message}`);
      this.job = null;
      this._emit('job', { active: false, outcome, error: e.message });
      throw e;
    }
    const seconds = +((performance.now() - t0) / 1000).toFixed(2);
    this.log('INFO', `Print ${outcome}: ${sent}/${total} rows in ${seconds}s, ${job.pauses} buffer pause(s)`);
    this.job = null;
    this._emit('job', { active: false, outcome, sent, total });
    if (outcome === 'sent') {
      this._waitDone(o.doneTimeoutMs).then(ok => this._emit('done', { ok }));
    }
    return { outcome, sent, total, pauses: job.pauses, seconds };
  }

  cancel() {
    if (this.job) { this.job.cancel = true; this.log('WARN', 'Cancel requested'); }
  }

  feed(n) { return this._paper(commands.feed(n)); }
  retract(n) { return this._paper(commands.retract(n)); }
  async _paper(pkt) {
    if (this.job) throw new Error('Printing; wait or cancel first');
    await this.send(commands.speed(DEFAULTS.feedSpeed));
    await this.send(pkt);
  }
}
