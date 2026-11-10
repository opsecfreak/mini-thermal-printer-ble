// Text/receipt renderer: document -> layout blocks -> white canvas -> 1-bit rows (LSB first).
import { PRINT_WIDTH as W, BYTES_PER_ROW } from './protocol.js';

const PAD_X = 2;

// ---------- markup ----------
// #  Big centered title        ## Bold heading        > Centered line
// -  Bullet                    [ ] Checkbox  [x] Ticked
// --- dashed line   === solid line   !! Black banner
// left | right  (two columns)   **whole line bold**   blank lines are kept
export const MARKUP_HELP = '# big title · ## heading · > centered · - bullet · [ ] checkbox · --- dashed · === solid · !! banner · left | right · **bold**';

export function parseMarkup(text, base, { checklist = false, keyValue = false } = {}) {
  const out = [];
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (line === '') out.push({ t: 'space', h: Math.round(base * 0.6) });
    else if (/^-{3,}$/.test(line)) out.push({ t: 'rule', style: 'dashed' });
    else if (/^={3,}$/.test(line)) out.push({ t: 'rule', style: 'solid' });
    else if ((m = /^#\s+(.*)$/.exec(line))) out.push({ t: 'text', text: m[1], size: Math.round(base * 1.45), bold: true, align: 'center' });
    else if ((m = /^##\s+(.*)$/.exec(line))) out.push({ t: 'text', text: m[1], size: Math.round(base * 1.1), bold: true });
    else if ((m = /^!!\s*(.*)$/.exec(line))) out.push({ t: 'banner', text: m[1] || 'WARNING', size: Math.round(base * 1.2) });
    else if ((m = /^>\s?(.*)$/.exec(line))) out.push({ t: 'text', text: m[1], size: base, align: 'center' });
    else if ((m = /^\[( |x|X)\]\s*(.*)$/.exec(line))) out.push({ t: 'check', text: m[2], checked: m[1] !== ' ', size: base });
    else if ((m = /^[-*•]\s+(.*)$/.exec(line))) out.push({ t: 'bullet', text: m[1], size: base });
    else if ((m = /^\*\*(.*)\*\*$/.exec(line))) out.push({ t: 'text', text: m[1], size: base, bold: true });
    else if (line.includes(' | ')) {
      const i = line.lastIndexOf(' | ');
      out.push({ t: 'lr', left: line.slice(0, i).trim(), right: line.slice(i + 3).trim(), size: base });
    } else if (keyValue && (m = /^([^:]{1,24}):\s*(.*)$/.exec(line))) out.push({ t: 'kv', key: m[1] + ':', value: m[2], size: base });
    else if (checklist) out.push({ t: 'check', text: line, checked: false, size: base });
    else out.push({ t: 'text', text: line, size: base });
  }
  return out;
}

// ---------- document -> blocks ----------
export const money = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

export function itemTotals(items, taxPct) {
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const tax = subtotal * (Number(taxPct) || 0) / 100;
  return { subtotal, tax, total: subtotal + tax };
}

/**
 * doc: { type: receipt|note|warning|checklist|tag, order, title, items[{desc,qty,price}], taxPct, payment, body, showFooter }
 * brand: { shopName, tagline, footer, currency, showHeader, showDateTime, baseSize, font }
 */
export function buildBlocks(doc, brand, now = new Date()) {
  const base = brand.baseSize || 22;
  const b = [];
  if (brand.showHeader !== false && brand.shopName) {
    b.push({ t: 'fit', text: brand.shopName, maxSize: Math.round(base * 2), bold: true });
    if (brand.tagline) b.push({ t: 'text', text: brand.tagline, size: Math.round(base * 0.8), align: 'center' });
  }
  if (brand.showDateTime !== false) {
    b.push({
      t: 'lr',
      left: now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      right: now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      size: Math.round(base * 0.85),
    });
  }
  if (doc.order && doc.order.trim()) b.push({ t: 'text', text: doc.order.trim(), size: base, bold: true });
  if (b.length) b.push({ t: 'rule', style: 'solid' });

  const title = (doc.title || '').trim();
  switch (doc.type) {
    case 'receipt': {
      if (title) b.push({ t: 'text', text: title, size: Math.round(base * 1.15), bold: true, align: 'center' }, { t: 'space', h: 6 });
      const cur = brand.currency ?? '$';
      const items = (doc.items || []).filter(it => (it.desc || '').trim() || Number(it.price));
      for (const it of items) {
        const qty = Number(it.qty) || 0;
        b.push({ t: 'lr', left: (qty !== 1 ? `${qty} x ` : '') + (it.desc || '').trim(), right: cur + money(qty * (Number(it.price) || 0)), size: base });
        if (qty !== 1 && qty) b.push({ t: 'text', text: `   @ ${cur}${money(it.price)} each`, size: Math.round(base * 0.75) });
      }
      const { subtotal, tax, total } = itemTotals(items, doc.taxPct);
      b.push({ t: 'rule', style: 'dashed' });
      if (Number(doc.taxPct)) {
        b.push({ t: 'lr', left: 'Subtotal', right: cur + money(subtotal), size: base });
        b.push({ t: 'lr', left: `Tax (${Number(doc.taxPct)}%)`, right: cur + money(tax), size: base });
      }
      b.push({ t: 'lr', left: 'TOTAL', right: cur + money(total), size: Math.round(base * 1.25), bold: true });
      if (doc.payment) b.push({ t: 'lr', left: 'Payment', right: doc.payment, size: base });
      if ((doc.body || '').trim()) b.push({ t: 'space', h: 8 }, ...parseMarkup(doc.body, base));
      break;
    }
    case 'warning':
      b.push({ t: 'banner', text: title || 'WARNING', size: Math.round(base * 1.35) }, { t: 'space', h: 8 });
      b.push(...parseMarkup(doc.body, base));
      b.push({ t: 'space', h: 8 }, { t: 'rule', style: 'thick' });
      break;
    case 'checklist':
      if (title) b.push({ t: 'text', text: title, size: Math.round(base * 1.2), bold: true, align: 'center' }, { t: 'space', h: 6 });
      b.push(...parseMarkup(doc.body, base, { checklist: true }));
      break;
    case 'tag':
      if (title) b.push({ t: 'fit', text: title, maxSize: Math.round(base * 1.8), bold: true });
      b.push({ t: 'space', h: 4 }, ...parseMarkup(doc.body, Math.round(base * 1.05), { keyValue: true }));
      break;
    default: // note
      if (title) b.push({ t: 'text', text: title, size: Math.round(base * 1.2), bold: true, align: 'center' }, { t: 'space', h: 6 });
      b.push(...parseMarkup(doc.body, base));
  }
  if (doc.showFooter && brand.footer) b.push({ t: 'space', h: 10 }, ...parseMarkup(brand.footer.split('\n').map(l => (l && !/^[#>!\-=\[*]/.test(l) ? '> ' + l : l)).join('\n'), Math.round(base * 0.9)));
  return b;
}

// ---------- layout + draw ----------
function wrap(ctx, text, maxW) {
  if (!text) return [''];
  const out = [];
  let cur = '';
  for (const word of text.split(/(\s+)/)) {
    const next = cur + word;
    if (ctx.measureText(next).width <= maxW) { cur = next; continue; }
    if (cur.trim()) out.push(cur.trimEnd());
    cur = word.trimStart();
    while (cur && ctx.measureText(cur).width > maxW) {
      let i = cur.length;
      while (i > 1 && ctx.measureText(cur.slice(0, i)).width > maxW) i--;
      out.push(cur.slice(0, i));
      cur = cur.slice(i);
    }
  }
  if (cur.trim() || !out.length) out.push(cur.trimEnd());
  return out;
}
const fontOf = (size, bold, family) => `${bold ? 'bold ' : ''}${size}px ${family}`;
const lineH = size => Math.ceil(size * 1.25);

export function renderBlocks(blocks, { font = 'sans-serif', padTop = 4, padBottom = 6 } = {}) {
  const m = document.createElement('canvas').getContext('2d');
  const ops = [];
  let y = padTop;
  const maxW = W - PAD_X * 2;
  for (const b of blocks) {
    const size = b.size || 22;
    const fam = b.font || font;
    const f = fontOf(size, b.bold, fam);
    m.font = f;
    switch (b.t) {
      case 'text':
        for (const ln of wrap(m, b.text, maxW)) { ops.push({ k: 'text', y, f, text: ln, align: b.align || 'left' }); y += lineH(size); }
        break;
      case 'fit': {
        let s = b.maxSize || 44;
        m.font = fontOf(s, b.bold, fam);
        while (s > 10 && m.measureText(b.text).width > maxW) { s--; m.font = fontOf(s, b.bold, fam); }
        ops.push({ k: 'text', y, f: fontOf(s, b.bold, fam), text: b.text, align: 'center' });
        y += lineH(s);
        break;
      }
      case 'lr': {
        const rw = m.measureText(b.right).width;
        const lines = wrap(m, b.left, Math.max(60, maxW - rw - 12));
        ops.push({ k: 'text', y, f, text: b.right, align: 'right' });
        for (const ln of lines) { ops.push({ k: 'text', y, f, text: ln, align: 'left' }); y += lineH(size); }
        break;
      }
      case 'kv': {
        const kf = fontOf(size, true, fam);
        m.font = kf;
        const kw = m.measureText(b.key + ' ').width;
        m.font = f;
        const lines = wrap(m, b.value || '', Math.max(60, maxW - kw));
        ops.push({ k: 'text', y, f: kf, text: b.key, align: 'left' });
        lines.forEach((ln, i) => { ops.push({ k: 'text', y, f, text: ln, align: 'left', x: PAD_X + kw }); y += lineH(size); });
        if (!(b.value || '').trim()) ops.push({ k: 'line', y: y - Math.round(size * 0.2), x: PAD_X + kw, w: maxW - kw });
        break;
      }
      case 'bullet':
      case 'check': {
        const ind = Math.round(size * 1.3);
        const lines = wrap(m, b.text, maxW - ind);
        ops.push({ k: b.t, y, size, checked: b.checked });
        for (const ln of lines) { ops.push({ k: 'text', y, f, text: ln, align: 'left', x: PAD_X + ind }); y += lineH(size); }
        if (b.t === 'check') y += 2;
        break;
      }
      case 'banner': {
        const bf = fontOf(size, true, fam);
        m.font = bf;
        const lines = wrap(m, b.text, maxW - 12);
        const h = lines.length * lineH(size) + 10;
        ops.push({ k: 'box', y, h });
        lines.forEach((ln, i) => ops.push({ k: 'text', y: y + 5 + i * lineH(size), f: bf, text: ln, align: 'center', white: true }));
        y += h + 4;
        break;
      }
      case 'rule':
        ops.push({ k: 'rule', y: y + 4, style: b.style });
        y += b.style === 'thick' ? 14 : 10;
        break;
      case 'space':
        y += b.h ?? 12;
        break;
      case 'ruler':
        ops.push({ k: 'ruler', y });
        y += 44;
        break;
      case 'bar':
        ops.push({ k: 'bar', y, h: b.h || 12, w: b.w || W });
        y += (b.h || 12) + 4;
        break;
      case 'border':
        ops.push({ k: 'borderStart', y });
        break;
      default:
        break;
    }
  }
  y += padBottom;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = Math.max(1, Math.ceil(y));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; // white first: transparent pixels would print black
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textBaseline = 'top';
  let borderY = null;
  for (const o of ops) {
    ctx.fillStyle = '#000';
    switch (o.k) {
      case 'text':
        ctx.font = o.f;
        ctx.textAlign = o.align;
        if (o.white) ctx.fillStyle = '#fff';
        ctx.fillText(o.text, o.x ?? (o.align === 'left' ? PAD_X : o.align === 'right' ? W - PAD_X : W / 2), o.y);
        break;
      case 'box': ctx.fillRect(0, o.y, W, o.h); break;
      case 'bar': ctx.fillRect(0, o.y, o.w, o.h); break;
      case 'line': ctx.fillRect(o.x, o.y, o.w, 1); break;
      case 'rule':
        if (o.style === 'dashed') for (let x = 0; x < W; x += 12) ctx.fillRect(x, o.y, 7, 2);
        else if (o.style === 'thick') { ctx.fillRect(0, o.y, W, 3); ctx.fillRect(0, o.y + 6, W, 3); }
        else ctx.fillRect(0, o.y, W, 2);
        break;
      case 'bullet': {
        const r = Math.max(2, Math.round(o.size * 0.14));
        ctx.beginPath(); ctx.arc(PAD_X + Math.round(o.size * 0.45), o.y + Math.round(o.size * 0.55), r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'check': {
        const s = Math.round(o.size * 0.8), x = PAD_X + 1, yy = o.y + Math.round(o.size * 0.12);
        ctx.fillRect(x, yy, s, 2); ctx.fillRect(x, yy + s - 2, s, 2); ctx.fillRect(x, yy, 2, s); ctx.fillRect(x + s - 2, yy, 2, s);
        if (o.checked) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 3, yy + s / 2); ctx.lineTo(x + s / 2.5, yy + s - 4); ctx.lineTo(x + s - 3, yy + 3); ctx.stroke(); }
        break;
      }
      case 'ruler':
        ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
        for (let x = 0; x < W; x += 8) {
          ctx.fillRect(x, o.y, 1, x % 48 === 0 ? 18 : 8);
          if (x % 96 === 0) ctx.fillText(String(x), Math.min(Math.max(x, 12), W - 14), o.y + 22);
        }
        ctx.fillRect(W - 1, o.y, 1, 18);
        break;
      case 'borderStart': borderY = o.y; break;
    }
  }
  if (borderY !== null) { ctx.fillStyle = '#000'; ctx.fillRect(0, borderY, 2, c.height - borderY); ctx.fillRect(W - 2, borderY, 2, c.height - borderY); }
  return c;
}

// ---------- 1-bit conversion ----------
export function canvasToRows(canvas, threshold = 140) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const rows = [];
  for (let y = 0; y < canvas.height; y++) {
    const row = new Uint8Array(BYTES_PER_ROW);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = data[i + 3] / 255;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (255 - a * (255 - lum) < threshold) row[x >> 3] |= 1 << (x & 7); // LSB = leftmost dot
    }
    rows.push(row);
  }
  return rows;
}

export function drawRows(canvasEl, rows) {
  canvasEl.width = W;
  canvasEl.height = Math.max(1, rows.length);
  const ctx = canvasEl.getContext('2d');
  const img = ctx.createImageData(W, canvasEl.height);
  rows.forEach((row, y) => {
    for (let x = 0; x < W; x++) {
      const v = row[x >> 3] & (1 << (x & 7)) ? 0 : 255;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
}

// ---------- calibration pages ----------
export function calibrationJobs(kind, { font = 'sans-serif', baseSize = 22, energy = 24000 } = {}) {
  const r = blocks => renderBlocks(blocks, { font });
  if (kind === 'alignment') return [{ canvas: r([
    { t: 'border' },
    { t: 'text', text: 'ALIGNMENT & EDGES', size: 26, bold: true, align: 'center' },
    { t: 'ruler' },
    { t: 'lr', left: '<LEFT', right: 'RIGHT>', size: 22, bold: true },
    { t: 'text', text: 'Both side lines and the ruler ends (0 and 383) should be visible. This sentence must be readable.', size: 18 },
    { t: 'bar', h: 16 },
    { t: 'text', text: 'Solid bar above should be even, with no light stripes.', size: 16 },
  ]) }];
  if (kind === 'density') {
    const levels = [12000, 18000, 24000, 30000, 36000, 42000];
    return levels.map(e => ({
      energy: e,
      label: e,
      canvas: r([
        { t: 'lr', left: `Density ${e}`, right: e === energy ? '(current)' : '', size: 20, bold: true },
        { t: 'text', text: 'The quick brown fox 0123456789', size: 18 },
        { t: 'bar', h: 10 },
      ]),
    }));
  }
  if (kind === 'sizes') {
    const sizes = [14, 16, 18, 20, 22, 24, 28, 32];
    return [{ canvas: r([
      { t: 'text', text: 'TEXT SIZES', size: 24, bold: true, align: 'center' },
      ...sizes.flatMap(s => [{ t: 'text', text: `${s}px Repair ticket 1234`, size: s }, { t: 'text', text: `${s}px bold Order #1234`, size: s, bold: true }]),
    ]) }];
  }
  if (kind === 'tear') return [{ canvas: r([
    { t: 'text', text: 'TEAR-OFF TEST', size: 24, bold: true, align: 'center' },
    { t: 'text', text: 'Tear the paper at the bar. If this last line is torn or missing, raise "Feed after print".', size: 18 },
    { t: 'rule', style: 'solid' },
    { t: 'text', text: 'LAST LINE', size: 22, bold: true, align: 'center' },
  ]) }];
  throw new Error('unknown calibration ' + kind);
}
