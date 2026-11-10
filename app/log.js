// TX/RX log with timestamps. Autosaves to the local server (POST /api/log) when it is available.
export class Logger {
  constructor({ el = null, prefix = 'app', endpoint = '/api/log', max = 5000 } = {}) {
    this.el = el;
    this.entries = [];
    this.max = max;
    this.verbose = false;
    this.dirty = false;
    this.endpoint = endpoint;
    this.autosave = !!endpoint;
    this.meta = {};
    this.onsave = null;
    this.session = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    setInterval(() => { if (this.dirty) this.save(); }, 15000);
    addEventListener('pagehide', () => this.beacon());
  }

  add(dir, msg, extra = {}) {
    const { quiet, ...rest } = extra;
    const e = { t: new Date().toISOString(), dir, msg, ...rest };
    this.entries.push(e);
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
    this.dirty = true;
    if (!quiet || this.verbose) this.render(e);
    if (dir === 'ERR') console.error('[printer]', msg);
    return e;
  }

  line(e) {
    const t = new Date(e.t).toLocaleTimeString(undefined, { hour12: false }) + '.' + e.t.slice(20, 23);
    return `${t} ${e.dir.padEnd(4)} ${e.msg}${e.hex ? '  | ' + e.hex : ''}`;
  }

  render(e) {
    if (!this.el) return;
    const atBottom = this.el.scrollTop + this.el.clientHeight >= this.el.scrollHeight - 30;
    const d = document.createElement('div');
    d.className = 'l-' + e.dir;
    d.textContent = this.line(e);
    this.el.append(d);
    while (this.el.childElementCount > 1500) this.el.firstElementChild.remove();
    if (atBottom) this.el.scrollTop = this.el.scrollHeight;
  }

  text() { return this.entries.map(e => this.line(e)).join('\n'); }
  json() { return JSON.stringify({ session: this.session, savedAt: new Date().toISOString(), meta: this.meta, entries: this.entries }, null, 1); }
  clearView() { if (this.el) this.el.textContent = ''; }

  async save() {
    if (!this.autosave) return false;
    this.dirty = false;
    try {
      const r = await fetch(`${this.endpoint}?session=${encodeURIComponent(this.session)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: this.json() });
      if (!r.ok) throw new Error(String(r.status));
      this.onsave?.(true);
      return true;
    } catch {
      this.autosave = false; // static hosting without the local server: keep the log in the page only
      this.onsave?.(false);
      return false;
    }
  }

  beacon() {
    if (!this.autosave || !this.dirty) return;
    try { navigator.sendBeacon(`${this.endpoint}?session=${encodeURIComponent(this.session)}`, new Blob([this.json()], { type: 'application/json' })); } catch {}
  }

  download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([this.json()], { type: 'application/json' }));
    a.download = this.session + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}
