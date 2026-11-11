// UI wiring. Protocol and Bluetooth code live in protocol.js / transport.js (unchanged by the UI).
import config from './config.js';
import { Printer, DEFAULTS } from './transport.js';
import {
  renderDoc, canvasToRows, drawRows, calibrationJobs, MARKUP, MARKUP_HELP, itemTotals, money,
  TYPE_DEFAULTS, LABEL_SIZES, HEAD_STYLES, binLines, processLogo, autoThreshold, setLogo,
} from './render.js';
import { DPI } from './protocol.js';
import { Logger } from './log.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

// ---------- state ----------
const store = {
  load() { try { return JSON.parse(localStorage.getItem(config.storageKey) || '{}'); } catch { return {}; } },
  save(v) { try { localStorage.setItem(config.storageKey, JSON.stringify(v)); return true; } catch { return false; } },
};
const saved = store.load();
const settings = {
  energy: DEFAULTS.energy, speed: DEFAULTS.speed, feedAfter: DEFAULTS.feedAfter, rowDelayMs: DEFAULTS.rowDelayMs,
  threshold: 140, poll: true, theme: 'auto', zoom: 'fit', paperLines: 50, copies: 1, taxPct: 0, tab: 'compose',
  ...(saved.settings || {}),
};
const brand = {
  baseSize: 22, font: 'sans-serif', logo: '', logoWidth: 200, logoThreshold: 128, logoDither: false, logoInvert: false,
  ...config.brand, ...(saved.brand || {}),
};
let myPresets = Array.isArray(saved.myPresets) ? saved.myPresets : [];
let myHeadings = Array.isArray(saved.myHeadings) ? saved.myHeadings : [];
let learned = saved.learned && typeof saved.learned === 'object' ? saved.learned : {};
let devices = Array.isArray(saved.devices) ? saved.devices : [];

const blankItem = () => ({ desc: '', qty: 1, price: '' });
const blankCustomer = () => ({ name: '', phone: '', email: '', device: '' });
const blankDoc = (type = 'receipt') => ({
  type, orderNo: '', customer: blankCustomer(), order: '', title: type === 'receipt' ? 'RECEIPT' : '',
  items: [blankItem()], taxPct: settings.taxPct || 0, discount: 0, payment: '', body: '', ...TYPE_DEFAULTS[type],
});
const normalize = d => {
  const out = { ...blankDoc(d?.type || 'receipt'), ...(d || {}) };
  out.customer = { ...blankCustomer(), ...(out.customer || {}) };
  if (!Array.isArray(out.items) || !out.items.length) out.items = [blankItem()];
  return out;
};
let doc = normalize(saved.doc);

// Seed remembered prices from the last receipt on first run of this version.
if (!saved.learned) for (const it of doc.items) if ((it.desc || '').trim() && it.price !== '' && it.price != null) learned[it.desc.trim()] = Number(it.price) || 0;

let persistTimer;
const persist = () => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (!store.save({ settings, brand, doc, myPresets, myHeadings, learned, devices })) logger.add('WARN', 'Could not save settings (browser storage full?). Try a smaller logo.');
  }, 250);
};

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
printer.addEventListener('done', ({ detail }) => { if (!printer.job) $('#progText').textContent = detail.ok ? 'Done. Tear off the print.' : 'Sent.'; });

// ---------- tabs ----------
function showTab(name) {
  settings.tab = name;
  $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tabpanel').forEach(p => (p.hidden = p.id !== 'tab-' + name));
  persist();
}
$$('.tabs [role=tab]').forEach(b => (b.onclick = () => showTab(b.dataset.tab)));

// ---------- presets: category -> group -> preset ----------
const MY = 'My presets';
const allPresets = () => [...config.presets.map((p, i) => ({ ...p, id: 'b' + i })), ...myPresets.map((p, i) => ({ cat: MY, group: p.group || 'Saved', name: p.name, doc: p.doc, id: 'm' + i }))];
const presetById = id => allPresets().find(p => p.id === id);
const fillSelect = (sel, items, placeholder) => {
  sel.textContent = '';
  if (placeholder) sel.append(new Option(placeholder, ''));
  for (const [v, t] of items) sel.append(new Option(t, v));
};
function renderPresetPickers(sel = {}) {
  const list = allPresets();
  const cats = [...new Set(list.map(p => p.cat))];
  const cat = sel.cat ?? ($('#pCat').value || cats[0]);
  fillSelect($('#pCat'), cats.map(c => [c, `${c} (${list.filter(p => p.cat === c).length})`]));
  $('#pCat').value = cats.includes(cat) ? cat : cats[0];
  const groups = [...new Set(list.filter(p => p.cat === $('#pCat').value).map(p => p.group))];
  const group = sel.group ?? '';
  fillSelect($('#pGroup'), [['', 'All groups'], ...groups.map(g => [g, g])]);
  $('#pGroup').value = groups.includes(group) ? group : '';
  const shown = list.filter(p => p.cat === $('#pCat').value && (!$('#pGroup').value || p.group === $('#pGroup').value));
  fillSelect($('#pName'), shown.map(p => [p.id, $('#pGroup').value ? p.name : `${p.name}`]), 'Choose…');
  $('#pName').value = sel.id && shown.some(p => p.id === sel.id) ? sel.id : '';
  $('#btnDeletePreset').hidden = !($('#pName').value || '').startsWith('m');
  const dl = $('#presetList');
  dl.textContent = '';
  for (const p of list) dl.append(new Option(`${p.name}  —  ${p.cat} / ${p.group}`));
}
function loadPreset(id) {
  const p = presetById(id);
  if (!p) return;
  const keep = { orderNo: doc.orderNo, customer: doc.customer, order: doc.order };
  const d = structuredClone(p.doc);
  doc = normalize({ ...blankDoc(d.type), ...d, ...keep });
  if (d.type === 'receipt' && d.taxPct == null) doc.taxPct = settings.taxPct || 0;
  doc.items = doc.items.map(it => ({ ...it, price: it.price || learned[(it.desc || '').trim()] || (it.desc ? 0 : '') }));
  fillForm(); changed();
  $('#btnDeletePreset').hidden = !id.startsWith('m');
}
$('#pCat').onchange = () => renderPresetPickers({ cat: $('#pCat').value, group: '' });
$('#pGroup').onchange = () => renderPresetPickers({ cat: $('#pCat').value, group: $('#pGroup').value });
$('#pName').onchange = e => { if (e.target.value) loadPreset(e.target.value); $('#btnDeletePreset').hidden = !e.target.value.startsWith('m'); };
$('#pSearch').onchange = e => {
  const v = e.target.value;
  const p = allPresets().find(p => `${p.name}  —  ${p.cat} / ${p.group}` === v) || allPresets().find(p => p.name.toLowerCase() === v.trim().toLowerCase());
  if (!p) return;
  renderPresetPickers({ cat: p.cat, group: p.group, id: p.id });
  loadPreset(p.id);
  e.target.value = '';
};

// ---------- type buttons ----------
const TYPES = { receipt: 'Receipt', note: 'Note / sticky', warning: 'Warning', checklist: 'Checklist', tag: 'Tag', bins: 'Bin labels' };
const BODY_HINTS = {
  receipt: ['Notes under the totals (optional)', MARKUP_HELP],
  note: ['Text', MARKUP_HELP],
  warning: ['Warning text', MARKUP_HELP],
  checklist: ['Items, one per line', 'Each line becomes a checkbox. ' + MARKUP_HELP],
  tag: ['Fields, one per line', '"Label: value" lines get a bold label. Leave the value empty for a write-in line.'],
  bins: ['Bin labels, one per line', 'Each line prints as its own cut-out label. Add a small second line with "|": MOTORS | Mavic 3'],
};
for (const [k, label] of Object.entries(TYPES)) {
  const b = el('button', { type: 'button', textContent: label });
  b.dataset.type = k;
  b.onclick = () => {
    if (doc.type === k) return;
    const wasTitle = doc.title;
    Object.assign(doc, { type: k, ...TYPE_DEFAULTS[k] });
    if (k !== 'receipt' && wasTitle === 'RECEIPT') doc.title = '';
    if (k === 'receipt' && !wasTitle) doc.title = 'RECEIPT';
    fillForm(); changed();
  };
  $('#typeSeg').append(b);
}

// ---------- customer ----------
const custFields = [['#cOrder', d => d.orderNo, (d, v) => (d.orderNo = v)], ['#cName', d => d.customer.name, (d, v) => (d.customer.name = v)],
  ['#cPhone', d => d.customer.phone, (d, v) => (d.customer.phone = v)], ['#cEmail', d => d.customer.email, (d, v) => (d.customer.email = v)],
  ['#cDevice', d => d.customer.device, (d, v) => (d.customer.device = v)], ['#fOrder', d => d.order, (d, v) => (d.order = v)]];
for (const [sel, , set] of custFields) $(sel).addEventListener('input', e => { set(doc, e.target.value); custSummary(); changed(); });
$('#cDevice').addEventListener('change', e => { const v = e.target.value.trim(); if (v && !devices.includes(v)) { devices = [v, ...devices].slice(0, 50); renderDevices(); persist(); } });
function custSummary() {
  const c = doc.customer;
  $('#custSummary').textContent = [doc.orderNo && `#${String(doc.orderNo).replace(/^#/, '')}`, c.name, c.device].filter(Boolean).join(' · ');
}
function renderDevices() { const dl = $('#deviceList'); dl.textContent = ''; for (const d of devices) dl.append(new Option(d)); }
$('#btnNewCustomer').onclick = () => { doc.orderNo = ''; doc.order = ''; doc.customer = blankCustomer(); fillForm(); changed(); $('#cOrder').focus(); };

// ---------- receipt items ----------
const catalogPrice = desc => learned[desc] ?? null;
function renderItemList() {
  const names = new Set([...Object.keys(learned), ...Object.values(config.catalog || {}).flat()]);
  const dl = $('#itemList'); dl.textContent = '';
  for (const n of [...names].sort((a, b) => a.localeCompare(b))) {
    const o = new Option(n); if (learned[n] != null) o.label = `${brand.currency ?? '$'}${money(learned[n])}`; dl.append(o);
  }
}
function renderQuickAdd() {
  const cats = Object.keys(config.catalog || {});
  const rem = Object.keys(learned);
  fillSelect($('#qaCat'), [...(rem.length ? [['__learned', `Remembered (${rem.length})`]] : []), ...cats.map(c => [c, c])]);
  if (settings.qaCat && [...$('#qaCat').options].some(o => o.value === settings.qaCat)) $('#qaCat').value = settings.qaCat;
  renderQuickItems();
}
function renderQuickItems() {
  const c = $('#qaCat').value;
  const list = c === '__learned' ? Object.keys(learned).sort((a, b) => a.localeCompare(b)) : config.catalog[c] || [];
  const cur = brand.currency ?? '$';
  fillSelect($('#qaItem'), list.map(n => [n, learned[n] != null ? `${n}  (${cur}${money(learned[n])})` : n]), '+ Pick an item to add…');
}
$('#qaCat').onchange = () => { settings.qaCat = $('#qaCat').value; persist(); renderQuickItems(); };
$('#qaItem').onchange = e => {
  const desc = e.target.value;
  if (!desc) return;
  const p = catalogPrice(desc);
  const row = { desc, qty: 1, price: p ?? '' };
  const last = doc.items[doc.items.length - 1];
  if (last && !(last.desc || '').trim() && !Number(last.price)) doc.items[doc.items.length - 1] = row; else doc.items.push(row);
  e.target.value = '';
  renderItems(); changed();
  if (p == null) $('#items tr:last-child .price').focus();
};

function learn(desc, price) {
  desc = (desc || '').trim();
  if (!desc || price === '' || price == null || !Number.isFinite(Number(price))) return;
  learned[desc] = Number(price);
  const keys = Object.keys(learned);
  if (keys.length > 400) delete learned[keys[0]];
  renderItemList();
}

function renderItems() {
  const tb = $('#items');
  tb.textContent = '';
  const cur = brand.currency ?? '$';
  doc.items.forEach((it, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="desc" list="itemList" placeholder="Type or pick an item"></td>
      <td><div class="qty-wrap"><button type="button" class="step" data-d="-1" aria-label="Less">−</button><input class="qty" type="number" min="0" step="1"><button type="button" class="step" data-d="1" aria-label="More">+</button></div></td>
      <td><input class="price" type="number" step="0.01" placeholder="0.00"></td>
      <td class="num line"></td>
      <td><button type="button" class="icon" title="Remove line">✕</button></td>`;
    const [d, q, p] = tr.querySelectorAll('input');
    const line = tr.querySelector('.line');
    const showLine = () => { line.textContent = cur + money((Number(it.qty) || 0) * (Number(it.price) || 0)); };
    d.value = it.desc ?? ''; q.value = it.qty ?? 1; p.value = it.price ?? '';
    showLine();
    d.oninput = () => {
      it.desc = d.value;
      const known = catalogPrice(d.value.trim());
      if (known != null && (it.price === '' || it.price == null || Number(it.price) === 0)) { it.price = known; p.value = known; }
      showLine(); changed();
    };
    q.oninput = () => { it.qty = q.value; showLine(); changed(); };
    p.oninput = () => { it.price = p.value; showLine(); changed(); };
    p.onchange = () => { learn(it.desc, it.price); persist(); };
    d.onkeydown = p.onkeydown = q.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); if (i === doc.items.length - 1) $('#btnAddItem').click(); else tb.children[i + 1].querySelector('.desc').focus(); }
    };
    tr.querySelectorAll('.step').forEach(b => (b.onclick = () => { it.qty = Math.max(0, (Number(it.qty) || 0) + Number(b.dataset.d)); q.value = it.qty; showLine(); changed(); }));
    tr.querySelector('.icon').onclick = () => { doc.items.splice(i, 1); if (!doc.items.length) doc.items.push(blankItem()); renderItems(); changed(); };
    tb.append(tr);
  });
}

function updateTotals() {
  if (doc.type !== 'receipt') return;
  const cur = brand.currency ?? '$';
  const { subtotal, discount, tax, total } = itemTotals(doc.items, doc.taxPct, doc.discount);
  $('#totals').textContent = `Subtotal ${cur}${money(subtotal)}${discount ? ` · Discount -${cur}${money(discount)}` : ''} · Tax ${cur}${money(tax)} · Total ${cur}${money(total)}`;
}

// ---------- formatting toolbar ----------
const ta = $('#fBody');
const PREFIX_RE = /^(#{1,3}\s*|>\s*|!!\s*|[-•]\s+|\*\s+|\[\s*[xX✓]?\s*\]\s*)/;
function bodyChanged() { doc.body = ta.value; changed(); }
function lineRange() {
  const v = ta.value;
  const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  let e = v.indexOf('\n', ta.selectionEnd - (ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === '\n' ? 1 : 0));
  if (e < 0) e = v.length;
  return [s, e];
}
function setPrefix(prefix) {
  const [s, e] = lineRange();
  const lines = ta.value.slice(s, e).split('\n');
  const all = lines.every(l => l.startsWith(prefix.trim()));
  const out = lines.map(l => (all ? l.replace(PREFIX_RE, '') : prefix + l.replace(PREFIX_RE, ''))).join('\n');
  ta.setRangeText(out, s, e, 'select');
  ta.focus(); bodyChanged();
}
function insertLine(text) {
  const [, e] = lineRange();
  const cur = ta.value.slice(lineRange()[0], e);
  const ins = (cur.trim() ? '\n' : '') + text + (e === ta.value.length ? '' : '');
  ta.setRangeText(ins, e, e, 'end');
  ta.focus(); bodyChanged();
}
function bold() {
  const { selectionStart: s, selectionEnd: e } = ta;
  if (s === e) { ta.setRangeText('**bold text**', s, e, 'select'); ta.setSelectionRange(s + 2, s + 11); }
  else {
    const sel = ta.value.slice(s, e);
    ta.setRangeText(/^\*\*.*\*\*$/s.test(sel) ? sel.slice(2, -2) : `**${sel}**`, s, e, 'select');
  }
  ta.focus(); bodyChanged();
}
function leftRight() {
  const [s, e] = lineRange();
  const l = ta.value.slice(s, e);
  if (!l.trim()) { ta.setRangeText('Left text | Right text', s, e, 'select'); }
  else if (!l.includes('|')) { ta.setRangeText(l + ' | ', s, e, 'end'); }
  ta.focus(); bodyChanged();
}
const TOOL_ACTIONS = {
  Title: () => setPrefix('# '), Heading: () => setPrefix('## '), Small: () => setPrefix('### '), Center: () => setPrefix('> '),
  Bullet: () => setPrefix('- '), Checkbox: () => setPrefix('[ ] '), Banner: () => setPrefix('!! '), Bold: bold,
  'Left | Right': leftRight, 'Dashed line': () => insertLine('---'), 'Solid line': () => insertLine('==='),
};
const TOOL_ICONS = { Title: 'T', Heading: 'H', Small: 'small', Center: '≡ Center', Bullet: '• List', Checkbox: '☐ Box', Banner: '■ Banner', Bold: 'B', 'Left | Right': 'L | R', 'Dashed line': '- - -', 'Solid line': '───' };
for (const m of MARKUP) {
  const b = el('button', { type: 'button', textContent: TOOL_ICONS[m.label] || m.label, title: `${m.what}\nExample: ${m.example}` });
  if (m.label === 'Bold') b.style.fontWeight = '700';
  if (m.label === 'Title') b.style.fontSize = '16px';
  b.onmousedown = e => e.preventDefault(); // keep the textarea selection
  b.onclick = TOOL_ACTIONS[m.label];
  $('#fmtBar').append(b);
}
for (const m of MARKUP) {
  const tr = el('tr', {}, el('td', {}, el('code', { textContent: m.example })), el('td', { textContent: m.what }));
  $('#fmtHelp').append(tr);
}
// note snippets
{
  const sel = $('#snippet');
  sel.append(new Option('Insert a ready-made line…', ''));
  for (const [g, list] of Object.entries(config.snippets || {})) {
    const og = el('optgroup', { label: g });
    list.forEach(t => og.append(new Option(t.replace(/^> /, '').replace(/\*\*/g, ''), t)));
    sel.append(og);
  }
  sel.onchange = () => { if (sel.value) insertLine(sel.value); sel.value = ''; };
}
ta.addEventListener('input', bodyChanged);
ta.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); bold(); }
});

// ---------- fill compose form ----------
function fillForm() {
  $$('#typeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === doc.type)));
  for (const [sel, get] of custFields) $(sel).value = get(doc) || '';
  custSummary();
  $('#fTitle').value = doc.title || '';
  $('#fTitle').placeholder = doc.type === 'warning' ? 'WARNING' : doc.type === 'bins' ? 'Not printed on bin labels' : 'Optional';
  $('#fTitle').disabled = doc.type === 'bins';
  $('#receiptBox').hidden = doc.type !== 'receipt';
  $('#custBox').hidden = doc.type === 'bins';
  $('#fTax').value = doc.taxPct || 0;
  $('#fDiscount').value = doc.discount || '';
  $('#fPayment').value = doc.payment || '';
  ta.value = doc.body || '';
  ta.rows = doc.type === 'receipt' ? 5 : 9;
  const [label, hint] = BODY_HINTS[doc.type] || BODY_HINTS.note;
  $('#bodyLabel').textContent = label;
  $('#bodyHint').textContent = hint;
  $('#lSize').value = doc.size in LABEL_SIZES ? doc.size : 'auto';
  $('#lFrame').value = doc.frame || 'none';
  $('#lText').value = doc.textSize || 'M';
  $('#lHeader').value = doc.header || 'full';
  $('#lDate').checked = doc.showDate !== false;
  $('#lTime').checked = doc.showTime !== false;
  $('#lCust').checked = doc.showCustomer !== false;
  $('#custBox').classList.toggle('off', doc.showCustomer === false);
  $('#fFooter').checked = !!doc.showFooter;
  renderItems();
  updateTotals();
}

$('#fTitle').oninput = e => { doc.title = e.target.value; changed(); };
$('#fTax').oninput = e => { doc.taxPct = e.target.value; settings.taxPct = Number(e.target.value) || 0; changed(); };
$('#fDiscount').oninput = e => { doc.discount = e.target.value; changed(); };
$('#fPayment').onchange = e => { doc.payment = e.target.value; changed(); };
$('#lSize').onchange = e => { doc.size = e.target.value; changed(); };
$('#lFrame').onchange = e => { doc.frame = e.target.value; changed(); };
$('#lText').onchange = e => { doc.textSize = e.target.value; changed(); };
$('#lHeader').onchange = e => { doc.header = e.target.value; changed(); };
$('#lDate').onchange = e => { doc.showDate = e.target.checked; changed(); };
$('#lTime').onchange = e => { doc.showTime = e.target.checked; changed(); };
$('#lCust').onchange = e => { doc.showCustomer = e.target.checked; $('#custBox').classList.toggle('off', !e.target.checked); changed(); };
$('#fFooter').onchange = e => { doc.showFooter = e.target.checked; changed(); };
$('#btnAddItem').onclick = () => { doc.items.push(blankItem()); renderItems(); changed(); $('#items tr:last-child .desc').focus(); };
$('#btnClear').onclick = () => {
  const keep = { orderNo: doc.orderNo, customer: doc.customer, order: doc.order };
  doc = normalize({ ...blankDoc(doc.type), ...keep });
  renderPresetPickers({ cat: $('#pCat').value, group: $('#pGroup').value });
  fillForm(); changed();
};
$('#btnSavePreset').onclick = () => {
  const name = prompt('Name for this preset', doc.title || 'My preset');
  if (!name) return;
  myPresets.push({ group: TYPES[doc.type] || 'Saved', name: name.slice(0, 60), doc: structuredClone({ ...doc, orderNo: '', customer: blankCustomer(), order: '' }) });
  persist();
  renderPresetPickers({ cat: MY, group: '', id: 'm' + (myPresets.length - 1) });
};
$('#btnDeletePreset').onclick = () => {
  const v = $('#pName').value;
  if (!v.startsWith('m') || !confirm(`Delete preset "${myPresets[+v.slice(1)]?.name}"?`)) return;
  myPresets.splice(+v.slice(1), 1);
  persist();
  renderPresetPickers({ cat: myPresets.length ? MY : undefined });
};

function changed() { updateTotals(); persist(); schedulePreview(); }

// ---------- heading tab ----------
const MYH = 'my:';
function renderHeadingPresets(selected = '') {
  const sel = $('#hPreset');
  sel.textContent = '';
  sel.append(new Option('Choose a heading style…', ''));
  const og = el('optgroup', { label: 'Styles' });
  (config.headingPresets || []).forEach((h, i) => og.append(new Option(h.name, 'b' + i)));
  sel.append(og);
  if (myHeadings.length) {
    const mg = el('optgroup', { label: 'My headings' });
    myHeadings.forEach((h, i) => mg.append(new Option(h.name, MYH + i)));
    sel.append(mg);
  }
  sel.value = selected;
  $('#btnDeleteHeading').hidden = !selected.startsWith(MYH);
}
const HEADING_KEYS = ['headStyle', 'nameScale', 'shopName', 'tagline', 'info', 'showLogo', 'logoWidth', 'logoThreshold', 'logoDither', 'logoInvert'];
$('#hPreset').onchange = e => {
  const v = e.target.value;
  const h = v.startsWith(MYH) ? myHeadings[+v.slice(MYH.length)] : config.headingPresets[+v.slice(1)];
  if (!h) return;
  Object.assign(brand, h.set);
  syncHeadingUi(); refreshLogo(); persist(); schedulePreview();
  $('#btnDeleteHeading').hidden = !v.startsWith(MYH);
};
$('#btnSaveHeading').onclick = () => {
  const name = prompt('Name for this heading', 'My heading');
  if (!name) return;
  const set = {}; for (const k of HEADING_KEYS) set[k] = brand[k];
  myHeadings.push({ name: name.slice(0, 60), set });
  persist(); renderHeadingPresets(MYH + (myHeadings.length - 1));
};
$('#btnDeleteHeading').onclick = () => {
  const v = $('#hPreset').value;
  if (!v.startsWith(MYH) || !confirm(`Delete heading "${myHeadings[+v.slice(MYH.length)]?.name}"?`)) return;
  myHeadings.splice(+v.slice(MYH.length), 1);
  persist(); renderHeadingPresets();
};
fillSelect($('#hStyle'), Object.entries(HEAD_STYLES));

function syncHeadingUi() {
  $('#hStyle').value = brand.headStyle || 'classic';
  $('#bName').value = brand.shopName || '';
  $('#hScale').value = brand.nameScale || 2;
  $('#hScaleVal').textContent = `${Number(brand.nameScale || 2).toFixed(1)}x`;
  $('#bTagline').value = brand.tagline || '';
  $('#bInfo').value = brand.info || '';
  $('#lgShow').checked = brand.showLogo !== false;
  $('#lgWidth').value = brand.logoWidth;
  $('#lgWidthVal').textContent = `${brand.logoWidth} dots (${(brand.logoWidth / 8).toFixed(0)} mm)`;
  $('#lgThresh').value = brand.logoThreshold;
  $('#lgThreshVal').textContent = String(brand.logoThreshold);
  $('#lgMode').value = brand.logoDither ? 'dither' : 'sharp';
  $('#lgInvert').checked = !!brand.logoInvert;
  $('#logoTools').hidden = !brand.logo;
  $('#btnLogoRemove').hidden = !brand.logo;
  $('#bFooter').value = brand.footer || '';
  $('#bCurrency').value = brand.currency ?? '$';
  $('#bSize').value = brand.baseSize;
  $('#bFont').value = brand.font;
}
const brandInput = (sel, key, parse = v => v, ev = 'input', after) => $(sel).addEventListener(ev, e => {
  brand[key] = parse(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  after?.(); syncHeadingUi(); persist(); schedulePreview();
});
brandInput('#hStyle', 'headStyle', v => v, 'change');
brandInput('#bName', 'shopName');
brandInput('#hScale', 'nameScale', Number);
brandInput('#bTagline', 'tagline');
brandInput('#bInfo', 'info');
brandInput('#bFooter', 'footer');
brandInput('#bCurrency', 'currency', v => v, 'input', () => { updateTotals(); renderQuickItems(); });
brandInput('#bSize', 'baseSize', v => clampInt(v, 12, 40, 22));
brandInput('#bFont', 'font', v => v, 'change');
brandInput('#lgShow', 'showLogo', Boolean, 'change');
brandInput('#lgWidth', 'logoWidth', v => clampInt(v, 48, 384, 200), 'input', refreshLogo);
brandInput('#lgThresh', 'logoThreshold', v => clampInt(v, 20, 240, 128), 'input', refreshLogo);
brandInput('#lgMode', 'logoDither', v => v === 'dither', 'change', refreshLogo);
brandInput('#lgInvert', 'logoInvert', Boolean, 'change', refreshLogo);

// ---------- logo ----------
let logoImg = null;
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image')); i.src = src; });
}
function refreshLogo() {
  if (!logoImg) { setLogo(null); return; }
  const c = processLogo(logoImg, { width: brand.logoWidth, threshold: brand.logoThreshold, dither: brand.logoDither, invert: brand.logoInvert });
  setLogo(c);
  const pv = $('#logoPreview');
  pv.width = c.width; pv.height = c.height;
  pv.getContext('2d').drawImage(c, 0, 0);
  $('#logoInfo').textContent = `${c.width} × ${c.height} dots · ${(c.height / DPI * 25.4).toFixed(0)} mm tall`;
}
async function initLogo() {
  if (!brand.logo) { logoImg = null; refreshLogo(); return; }
  try { logoImg = await loadImage(brand.logo); refreshLogo(); } catch (e) { logger.add('WARN', 'Saved logo could not be loaded: ' + e.message); logoImg = null; }
  schedulePreview();
}
$('#logoFile').onchange = async e => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
    const img = await loadImage(url);
    // Store a copy no bigger than the print width (keeps browser storage small).
    const k = Math.min(1, 384 / Math.max(img.naturalWidth || 384, img.naturalHeight || 384));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || 384) * k)); c.height = Math.max(1, Math.round((img.naturalHeight || 384) * k));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    brand.logo = c.toDataURL('image/png');
    logoImg = await loadImage(brand.logo);
    brand.logoThreshold = autoThreshold(logoImg);
    brand.logoWidth = Math.min(256, Math.max(96, Math.round(c.width / 8) * 8));
    brand.showLogo = true;
    refreshLogo(); syncHeadingUi(); persist(); schedulePreview();
    logger.add('INFO', `Logo loaded: ${f.name} (${c.width}x${c.height}), cut-off ${brand.logoThreshold}`);
  } catch (err) { logger.add('ERR', 'Logo upload failed: ' + err.message); alert('Logo upload failed: ' + err.message); }
};
$('#btnLogoAuto').onclick = () => { if (!logoImg) return; brand.logoThreshold = autoThreshold(logoImg); refreshLogo(); syncHeadingUi(); persist(); schedulePreview(); };
$('#btnLogoRemove').onclick = () => { if (!confirm('Remove the logo?')) return; brand.logo = ''; logoImg = null; refreshLogo(); syncHeadingUi(); persist(); schedulePreview(); };

// ---------- preview ----------
let previewTimer;
const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 120); };
const renderCurrent = (now = new Date()) => renderDoc(doc, brand, now);
function applyZoom() {
  const c = $('#preview');
  c.style.width = settings.zoom === 'fit' ? '' : `${384 * Number(settings.zoom)}px`;
  c.classList.toggle('fit', settings.zoom === 'fit');
}
function updatePreview() {
  const rows = canvasToRows(renderCurrent(), settings.threshold);
  drawRows($('#preview'), rows);
  applyZoom();
  const n = doc.type === 'bins' ? Math.max(1, binLines(doc).length) : 0;
  $('#previewInfo').textContent = `${n ? `${n} label${n > 1 ? 's' : ''} · ` : ''}${(rows.length / DPI).toFixed(2)} in + ${settings.feedAfter} lines feed`;
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
  if (doc.type === 'receipt') { for (const it of doc.items) learn(it.desc, it.price); persist(); }
  const rows = canvasToRows(renderCurrent(new Date()), settings.threshold);
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
      const b = el('button', { type: 'button', textContent: p.label });
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

// ---------- printer settings UI ----------
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
}
function bindSetting(sel, key, parse, after) {
  const e = $(sel);
  e.addEventListener(e.type === 'checkbox' || e.tagName === 'SELECT' ? 'change' : 'input', () => {
    settings[key] = e.type === 'checkbox' ? e.checked : parse ? parse(e.value) : e.value;
    after?.();
    persist(); schedulePreview();
  });
}
function applyTheme() {
  if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', settings.theme);
  $('#btnTheme').textContent = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' }[settings.theme];
}

bindSetting('#energy', 'energy', v => clampInt(v, 4000, 60000, DEFAULTS.energy), syncSettingsUi);
bindSetting('#feedAfter', 'feedAfter', v => clampInt(v, 0, 500, DEFAULTS.feedAfter));
bindSetting('#paperLines', 'paperLines', v => clampInt(v, 1, 1000, 50));
bindSetting('#copies', 'copies', v => clampInt(v, 1, 20, 1));
bindSetting('#sSpeed', 'speed', v => clampInt(v, 1, 255, DEFAULTS.speed));
bindSetting('#sDelay', 'rowDelayMs', v => clampInt(v, 0, 100, DEFAULTS.rowDelayMs));
bindSetting('#sThreshold', 'threshold', v => clampInt(v, 40, 230, 140));
bindSetting('#sPoll', 'poll', null, () => (settings.poll && printer.connected ? printer.startPolling(15000) : printer.stopPolling()));
$('#btnResetSettings').onclick = () => {
  if (!confirm('Reset printer settings (darkness, feed, speed) to defaults? Presets and heading stay.')) return;
  Object.assign(settings, { energy: DEFAULTS.energy, speed: DEFAULTS.speed, feedAfter: DEFAULTS.feedAfter, rowDelayMs: DEFAULTS.rowDelayMs, threshold: 140, poll: true });
  syncSettingsUi(); persist(); schedulePreview();
};
$('#btnForgetItems').onclick = () => {
  if (!confirm(`Forget ${Object.keys(learned).length} remembered item prices?`)) return;
  learned = {}; renderItemList(); renderQuickAdd(); persist();
};

$('#btnConnect').onclick = () => (printer.device ? printer.reconnect().catch(() => printer.connect()) : printer.connect()).catch(() => {});
$('#btnDisconnect').onclick = () => printer.disconnect();
$('#btnPrint').onclick = printDoc;
$('#btnCancel').onclick = () => printer.cancel();
$('#btnFeed').onclick = () => printer.feed(settings.paperLines).catch(e => logger.add('ERR', e.message));
$('#btnRetract').onclick = () => printer.retract(settings.paperLines).catch(e => logger.add('ERR', e.message));
$$('[data-cal]').forEach(b => (b.onclick = () => (b.dataset.cal === 'all' ? calibrateAll() : calibrate(b.dataset.cal))));
$('#btnTheme').onclick = () => { settings.theme = { auto: 'light', light: 'dark', dark: 'auto' }[settings.theme]; applyTheme(); persist(); };
$('#zoom').onchange = e => { settings.zoom = e.target.value; applyZoom(); persist(); };

$('#logVerbose').onchange = e => { logger.verbose = e.target.checked; };
$('#btnLogCopy').onclick = async () => { try { await navigator.clipboard.writeText(logger.text()); logger.add('INFO', 'Log copied'); } catch (e) { logger.add('ERR', 'Copy failed: ' + e.message); } };
$('#btnLogDownload').onclick = () => logger.download();
$('#btnLogClear').onclick = () => logger.clearView();

addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !$('#btnPrint').disabled) { e.preventDefault(); printDoc(); }
});

// ---------- start ----------
document.title = config.appName;
$('#appName').textContent = config.appName;
renderPresetPickers({ cat: config.presets[0]?.cat });
renderHeadingPresets();
renderItemList();
renderQuickAdd();
renderDevices();
fillForm();
syncHeadingUi();
syncSettingsUi();
applyTheme();
showTab(settings.tab === 'heading' ? 'heading' : 'compose');
updatePreview();
updateButtons();
initLogo();
