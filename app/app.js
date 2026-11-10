// UI wiring. Protocol and Bluetooth code live in protocol.js / transport.js.
import config from './config.js';
import { Printer, DEFAULTS } from './transport.js';
import { buildBlocks, renderBlocks, canvasToRows, drawRows, calibrationJobs, MARKUP_HELP, itemTotals, money } from './render.js';
import { DPI } from './protocol.js';
import { Logger } from './log.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

// ---------- state ----------
const store = {
  load() { try { return JSON.parse(localStorage.getItem(config.storageKey) || '{}'); } catch { return {}; } },
  save(v) { try { localStorage.setItem(config.storageKey, JSON.stringify(v)); } catch {} },
};
const saved = store.load();
const settings = {
  energy: DEFAULTS.energy, speed: DEFAULTS.speed, feedAfter: DEFAULTS.feedAfter, rowDelayMs: DEFAULTS.rowDelayMs,
  threshold: 140, poll: true, theme: 'auto', zoom: 'fit', paperLines: 50, copies: 1,
  ...(saved.settings || {}),
};
const brand = { showHeader: true, showDateTime: true, baseSize: 22, font: 'sans-serif', ...config.brand, ...(saved.brand || {}) };
let myPresets = Array.isArray(saved.myPresets) ? saved.myPresets : [];
const blankDoc = (type = 'receipt') => ({ type, order: '', title: type === 'receipt' ? 'RECEIPT' : '', items: [{ desc: '', qty: 1, price: 0 }], taxPct: 0, payment: '', body: '', showFooter: type === 'receipt' || type === 'note' });
let doc = { ...blankDoc(), ...(saved.doc || {}) };
if (!Array.isArray(doc.items) || !doc.items.length) doc.items = [{ desc: '', qty: 1, price: 0 }];

let persistTimer;
const persist = () => { clearTimeout(persistTimer); persistTimer = setTimeout(() => store.save({ settings, brand, doc, myPresets }), 250); };

// ---------- log + printer ----------
const logger = new Logger({ el: $('#log'), prefix: config.logPrefix || 'app', endpoint: config.logEndpoint ?? '/api/log' });
logger.onsave = ok => { $('#saveState').textContent = ok ? `Log autosaved ${new Date().toLocaleTimeString()}` : 'Log autosave off (download it instead)'; };
logger.meta = { app: config.appName, userAgent: navigator.userAgent };
const printer = new Printer({ log: (d, m, x) => logger.add(d, m, x) });
logger.add('INFO', `${config.appName} ready. Secure context: ${isSecureContext}, Web Bluetooth: ${!!navigator.bluetooth}`);
if (!navigator.bluetooth) logger.add('ERR', 'Web Bluetooth is unavailable. Open this page in Chrome or Edge from http://127.0.0.1 (use the launcher).');

// ---------- header pills ----------
let lastStatusLabel = ['Ready', 'ok'];
function pill(id, text, cls = '', title = '') { const p = $(id); p.hidden = !text; p.textContent = text; p.className = 'pill ' + cls; p.title = title; }

printer.addEventListener('state', ({ detail }) => {
  const s = detail.state;
  pill('#pConn', s === 'connected' ? `Connected: ${detail.name}` : s === 'connecting' ? 'Connecting…' : 'Not connected', s === 'connected' ? 'ok' : s === 'connecting' ? 'warn' : '');
  $('#btnConnect').hidden = s === 'connected';
  $('#btnConnect').disabled = s === 'connecting';
  $('#btnConnect').textContent = printer.device && s === 'disconnected' ? 'Reconnect' : 'Connect printer';
  $('#btnDisconnect').hidden = s !== 'connected';
  if (s === 'connected') { logger.meta.device = detail.name; if (settings.poll) printer.startPolling(15000); }
  else { pill('#pStatus', ''); pill('#pBattery', ''); pill('#pTemp', ''); }
  updateButtons();
});
printer.addEventListener('status', ({ detail: d }) => {
  lastStatusLabel = d.outOfPaper ? ['Out of paper', 'err'] : d.coverOpen ? ['Cover open', 'err'] : d.overheat ? ['Overheated, wait', 'err'] : d.printing || d.busy ? ['Printing', 'warn'] : ['Ready', 'ok'];
  if (!printer.flowFull) pill('#pStatus', ...lastStatusLabel);
  pill('#pBattery', d.lowBattery ? 'Battery low' : 'Battery OK', d.lowBattery ? 'warn' : 'ok', `Printer flag 0x${d.flags.toString(16)}, level byte ${d.level ?? '?'}`);
});
printer.addEventListener('flow', ({ detail }) => pill('#pStatus', ...(detail.full ? ['Buffer full, waiting', 'warn'] : lastStatusLabel)));
printer.addEventListener('temp', ({ detail }) => pill('#pTemp', `Temp ${detail.value}`, '', 'Value the printer reports while printing (likely °C)'));
printer.addEventListener('done', ({ detail }) => { if (!printer.job) $('#progText').textContent = detail.ok ? 'Done. Tear off the receipt.' : 'Sent.'; });

// ---------- compose form ----------
const TYPES = { receipt: 'Receipt', note: 'Note', warning: 'Warning', checklist: 'Checklist', tag: 'Tag / label' };
const BODY_HINTS = {
  receipt: ['Notes (optional)', MARKUP_HELP],
  note: ['Text', MARKUP_HELP],
  warning: ['Warning text', MARKUP_HELP],
  checklist: ['Items, one per line', 'Each line becomes a checkbox. ' + MARKUP_HELP],
  tag: ['Fields, one per line', '"Label: value" lines get a bold label. Leave the value empty for a write-in line.'],
};

function buildTypeSeg() {
  const seg = $('#typeSeg');
  for (const [k, label] of Object.entries(TYPES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.type = k; b.textContent = label;
    b.onclick = () => { doc.type = k; if (k !== 'receipt' && doc.title === 'RECEIPT') doc.title = ''; fillForm(); changed(); };
    seg.append(b);
  }
}

function renderPresets(selected = '') {
  const sel = $('#preset');
  sel.textContent = '';
  sel.append(new Option('Choose a preset…', ''));
  const groups = {};
  config.presets.forEach((p, i) => (groups[p.group] ||= []).push(['b' + i, p.name]));
  if (myPresets.length) groups['My presets'] = myPresets.map((p, i) => ['m' + i, p.name]);
  for (const [g, list] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = g;
    list.forEach(([v, n]) => og.append(new Option(n, v)));
    sel.append(og);
  }
  sel.value = selected;
  $('#btnDeletePreset').hidden = !selected.startsWith('m');
}

function loadPreset(v) {
  const p = v[0] === 'b' ? config.presets[+v.slice(1)] : myPresets[+v.slice(1)];
  if (!p) return;
  const order = doc.order;
  doc = { ...blankDoc(p.doc.type), ...structuredClone(p.doc), order };
  if (!Array.isArray(doc.items) || !doc.items.length) doc.items = [{ desc: '', qty: 1, price: 0 }];
  fillForm(); changed();
  $('#btnDeletePreset').hidden = v[0] !== 'm';
}

function renderItems() {
  const tb = $('#items');
  tb.textContent = '';
  doc.items.forEach((it, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input class="desc" placeholder="Item or service"></td><td><input class="qty" type="number" min="0" step="1"></td><td><input class="price" type="number" step="0.01" min="0"></td><td><button type="button" class="icon" title="Remove item">✕</button></td>';
    const [d, q, p] = tr.querySelectorAll('input');
    d.value = it.desc ?? ''; q.value = it.qty ?? 1; p.value = it.price ?? 0;
    d.oninput = () => { it.desc = d.value; changed(); };
    q.oninput = () => { it.qty = q.value; changed(); };
    p.oninput = () => { it.price = p.value; changed(); };
    tr.querySelector('button').onclick = () => { doc.items.splice(i, 1); if (!doc.items.length) doc.items.push({ desc: '', qty: 1, price: 0 }); renderItems(); changed(); };
    tb.append(tr);
  });
}

function fillForm() {
  $$('#typeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === doc.type)));
  $('#fOrder').value = doc.order || '';
  $('#fTitle').value = doc.title || '';
  $('#fTitle').placeholder = doc.type === 'warning' ? 'WARNING' : 'Optional';
  $('#receiptBox').hidden = doc.type !== 'receipt';
  $('#fTax').value = doc.taxPct || 0;
  $('#fPayment').value = doc.payment || '';
  $('#fBody').value = doc.body || '';
  $('#fFooter').checked = !!doc.showFooter;
  const [label, hint] = BODY_HINTS[doc.type] || BODY_HINTS.note;
  $('#bodyLabel').textContent = label;
  $('#bodyHint').textContent = hint;
  renderItems();
}

function updateTotals() {
  if (doc.type !== 'receipt') return;
  const cur = brand.currency ?? '$';
  const { subtotal, tax, total } = itemTotals(doc.items, doc.taxPct);
  $('#totals').textContent = `Subtotal ${cur}${money(subtotal)} · Tax ${cur}${money(tax)} · Total ${cur}${money(total)}`;
}

function changed() { updateTotals(); persist(); schedulePreview(); }

// ---------- preview ----------
let previewTimer;
const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 120); };
const renderDoc = (now = new Date()) => renderBlocks(buildBlocks(doc, brand, now), { font: brand.font });
function applyZoom() {
  const c = $('#preview');
  c.style.width = settings.zoom === 'fit' ? '' : `${384 * Number(settings.zoom)}px`;
  c.classList.toggle('fit', settings.zoom === 'fit');
}
function updatePreview() {
  const rows = canvasToRows(renderDoc(), settings.threshold);
  drawRows($('#preview'), rows);
  applyZoom();
  $('#previewInfo').textContent = `${(rows.length / DPI).toFixed(2)} in + ${settings.feedAfter} lines feed`;
}
setInterval(() => { if (!printer.job) updatePreview(); }, 30000); // keep the clock current

// ---------- printing ----------
function updateButtons() {
  const ok = printer.connected && !printer.job;
  $('#btnPrint').disabled = !ok;
  $$('.needs-printer').forEach(b => (b.disabled = !ok));
  $('#btnCancel').disabled = !printer.job;
  if (!printer.connected && !printer.job) $('#progText').textContent = 'Connect the printer to print.';
  else if (ok && /Connect the printer/.test($('#progText').textContent)) $('#progText').textContent = 'Ready.';
}

async function runPrint(jobs, label) {
  if (!printer.connected || printer.job) return null;
  logger.add('INFO', `Job: ${label}`, { settings: { ...settings }, font: brand.font, baseSize: brand.baseSize });
  $('#prog').value = 0;
  $('#progText').textContent = 'Sending…';
  const p = printer.print(jobs, { energy: settings.energy, speed: settings.speed, feedAfter: settings.feedAfter, rowDelayMs: settings.rowDelayMs }, ({ sent, total }) => {
    $('#prog').value = sent / total;
    $('#progText').textContent = `Sending ${sent} / ${total} lines`;
  });
  updateButtons();
  try {
    const r = await p;
    $('#progText').textContent = r.outcome === 'sent' ? 'Sent. Printing…' : r.outcome === 'cancelled' ? 'Cancelled. Paper fed out.' : 'Printer disconnected during the print.';
    return r;
  } catch (e) {
    $('#progText').textContent = 'Error: ' + e.message;
    return null;
  } finally {
    updateButtons();
    logger.save();
  }
}

function printDoc() {
  const copies = clampInt($('#copies').value, 1, 20, 1);
  const rows = canvasToRows(renderDoc(new Date()), settings.threshold);
  return runPrint(Array.from({ length: copies }, () => ({ rows, feedAfter: settings.feedAfter })), `${doc.type} "${doc.title || ''}" x${copies}`);
}

async function calibrate(kind) {
  const parts = calibrationJobs(kind, { font: brand.font, baseSize: brand.baseSize, energy: settings.energy });
  const jobs = parts.map((p, i) => ({ rows: canvasToRows(p.canvas, settings.threshold), energy: p.energy, feedAfter: i === parts.length - 1 ? settings.feedAfter : 6 }));
  const r = await runPrint(jobs, `calibration: ${kind}`);
  if (r && kind === 'density') {
    const box = $('#densityPick');
    box.textContent = 'Pick the darkest strip that is still crisp: ';
    for (const p of parts) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = p.label;
      b.onclick = () => { settings.energy = p.energy; syncSettingsUi(); persist(); logger.add('INFO', `Darkness set to ${p.energy}`); };
      box.append(b);
    }
  }
  return r;
}

async function calibrateAll() {
  for (const k of ['alignment', 'density', 'sizes', 'tear']) {
    const r = await calibrate(k);
    if (!r || r.outcome !== 'sent') break;
    await new Promise(res => { const on = () => { printer.removeEventListener('done', on); res(); }; printer.addEventListener('done', on); setTimeout(on, 20000); });
  }
}

// ---------- settings UI ----------
function syncSettingsUi() {
  $('#energy').value = settings.energy;
  $('#energyVal').textContent = settings.energy === DEFAULTS.energy ? `${settings.energy} (default)` : settings.energy;
  $('#feedAfter').value = settings.feedAfter;
  $('#paperLines').value = settings.paperLines;
  $('#copies').value = settings.copies;
  $('#zoom').value = settings.zoom;
  $('#sSpeed').value = settings.speed;
  $('#sDelay').value = settings.rowDelayMs;
  $('#sThreshold').value = settings.threshold;
  $('#sPoll').checked = settings.poll;
  $('#bName').value = brand.shopName;
  $('#bTagline').value = brand.tagline || '';
  $('#bFooter').value = brand.footer || '';
  $('#bCurrency').value = brand.currency ?? '$';
  $('#bSize').value = brand.baseSize;
  $('#bFont').value = brand.font;
  $('#bHeader').checked = brand.showHeader !== false;
  $('#bDate').checked = brand.showDateTime !== false;
}

function bindSetting(sel, obj, key, parse, after) {
  const el = $(sel);
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    obj[key] = el.type === 'checkbox' ? el.checked : parse ? parse(el.value) : el.value;
    after?.();
    persist(); schedulePreview();
  });
}

function applyTheme() {
  if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', settings.theme);
  $('#btnTheme').textContent = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' }[settings.theme];
}

// ---------- wire up ----------
document.title = config.appName;
$('#appName').textContent = config.appName;
buildTypeSeg();
renderPresets();
fillForm();
syncSettingsUi();
applyTheme();
updateTotals();
updatePreview();
updateButtons();

$('#preset').onchange = e => { if (e.target.value) loadPreset(e.target.value); };
$('#btnSavePreset').onclick = () => {
  const name = prompt('Preset name', doc.title || 'My preset');
  if (!name) return;
  myPresets.push({ group: 'My presets', name: name.slice(0, 60), doc: structuredClone({ ...doc, order: '' }) });
  persist();
  renderPresets('m' + (myPresets.length - 1));
};
$('#btnDeletePreset').onclick = () => {
  const v = $('#preset').value;
  if (!v.startsWith('m') || !confirm(`Delete preset "${myPresets[+v.slice(1)]?.name}"?`)) return;
  myPresets.splice(+v.slice(1), 1);
  persist();
  renderPresets();
};
$('#btnClear').onclick = () => { doc = blankDoc(doc.type); renderPresets(); fillForm(); changed(); };
$('#fOrder').oninput = e => { doc.order = e.target.value; changed(); };
$('#fTitle').oninput = e => { doc.title = e.target.value; changed(); };
$('#fTax').oninput = e => { doc.taxPct = e.target.value; changed(); };
$('#fPayment').onchange = e => { doc.payment = e.target.value; changed(); };
$('#fBody').oninput = e => { doc.body = e.target.value; changed(); };
$('#fFooter').onchange = e => { doc.showFooter = e.target.checked; changed(); };
$('#btnAddItem').onclick = () => { doc.items.push({ desc: '', qty: 1, price: 0 }); renderItems(); changed(); $('#items tr:last-child .desc').focus(); };

$('#btnConnect').onclick = () => (printer.device ? printer.reconnect().catch(() => printer.connect()) : printer.connect()).catch(() => {});
$('#btnDisconnect').onclick = () => printer.disconnect();
$('#btnPrint').onclick = printDoc;
$('#btnCancel').onclick = () => printer.cancel();
$('#btnFeed').onclick = () => printer.feed(settings.paperLines).catch(e => logger.add('ERR', e.message));
$('#btnRetract').onclick = () => printer.retract(settings.paperLines).catch(e => logger.add('ERR', e.message));
$$('[data-cal]').forEach(b => (b.onclick = () => (b.dataset.cal === 'all' ? calibrateAll() : calibrate(b.dataset.cal))));
$('#btnTheme').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme]; applyTheme(); persist(); };
$('#zoom').onchange = e => { settings.zoom = e.target.value; applyZoom(); persist(); };

bindSetting('#energy', settings, 'energy', v => clampInt(v, 4000, 60000, DEFAULTS.energy), syncSettingsUi);
bindSetting('#feedAfter', settings, 'feedAfter', v => clampInt(v, 0, 500, DEFAULTS.feedAfter));
bindSetting('#paperLines', settings, 'paperLines', v => clampInt(v, 1, 1000, 50));
bindSetting('#copies', settings, 'copies', v => clampInt(v, 1, 20, 1));
bindSetting('#sSpeed', settings, 'speed', v => clampInt(v, 1, 255, DEFAULTS.speed));
bindSetting('#sDelay', settings, 'rowDelayMs', v => clampInt(v, 0, 100, DEFAULTS.rowDelayMs));
bindSetting('#sThreshold', settings, 'threshold', v => clampInt(v, 40, 230, 140));
bindSetting('#sPoll', settings, 'poll', null, () => (settings.poll && printer.connected ? printer.startPolling(15000) : printer.stopPolling()));
bindSetting('#bName', brand, 'shopName');
bindSetting('#bTagline', brand, 'tagline');
bindSetting('#bFooter', brand, 'footer');
bindSetting('#bCurrency', brand, 'currency', null, updateTotals);
bindSetting('#bSize', brand, 'baseSize', v => clampInt(v, 12, 40, 22));
bindSetting('#bFont', brand, 'font');
bindSetting('#bHeader', brand, 'showHeader');
bindSetting('#bDate', brand, 'showDateTime');
$('#btnResetSettings').onclick = () => {
  if (!confirm('Reset printer and shop settings to defaults? Your presets stay.')) return;
  Object.assign(settings, { energy: DEFAULTS.energy, speed: DEFAULTS.speed, feedAfter: DEFAULTS.feedAfter, rowDelayMs: DEFAULTS.rowDelayMs, threshold: 140, poll: true });
  Object.assign(brand, { showHeader: true, showDateTime: true, baseSize: 22, font: 'sans-serif', ...config.brand });
  syncSettingsUi(); persist(); schedulePreview();
};

$('#logVerbose').onchange = e => { logger.verbose = e.target.checked; };
$('#btnLogCopy').onclick = async () => { try { await navigator.clipboard.writeText(logger.text()); logger.add('INFO', 'Log copied'); } catch (e) { logger.add('ERR', 'Copy failed: ' + e.message); } };
$('#btnLogDownload').onclick = () => logger.download();
$('#btnLogClear').onclick = () => logger.clearView();

addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !$('#btnPrint').disabled) { e.preventDefault(); printDoc(); }
});
