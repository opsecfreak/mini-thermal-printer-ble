// Text/receipt renderer: document -> layout blocks -> white canvas -> 1-bit rows (LSB first).
import { PRINT_WIDTH as W, BYTES_PER_ROW } from './protocol.js';

// ---------- markup ----------
// Forgiving on purpose: the space after a marker is optional and **bold** works anywhere in a line.
export const MARKUP = [
  { mark: '# ', label: 'Title', example: '# READY FOR PICKUP', what: 'Big bold centered line' },
  { mark: '## ', label: 'Heading', example: '## Parts used', what: 'Bold heading' },
  { mark: '### ', label: 'Small', example: '### Fine print', what: 'Small text' },
  { mark: '> ', label: 'Center', example: '> Thank you!', what: 'Centered line' },
  { mark: '- ', label: 'Bullet', example: '- Calibrate the compass', what: 'Bullet point' },
  { mark: '[ ] ', label: 'Checkbox', example: '[ ] Props checked', what: 'Empty checkbox ([x] = ticked)' },
  { mark: '!! ', label: 'Banner', example: '!! DO NOT FLY', what: 'White text on a black bar' },
  { mark: '**', label: 'Bold', example: 'Warranty is **30 days**', what: 'Bold words (wrap with **)' },
  { mark: ' | ', label: 'Left | Right', example: 'Labor | $35.00', what: 'Two columns: left and right' },
  { mark: '---', label: 'Dashed line', example: '---', what: 'Dashed divider' },
  { mark: '===', label: 'Solid line', example: '===', what: 'Solid divider' },
];
export const MARKUP_HELP = 'Use the buttons above, or type: # title · ## heading · > center · - bullet · [ ] box · !! banner · **bold** · left | right · --- / ===';

const stripBold = s => String(s ?? '').replace(/\*\*/g, '');
const hasBold = s => /\*\*[^*]+\*\*/.test(String(s ?? ''));

export function parseMarkup(text, base, { checklist = false, keyValue = false } = {}) {
  const out = [];
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    let m;
    if (line === '') out.push({ t: 'space', h: Math.round(base * 0.6) });
    else if (/^(-\s*){3,}$/.test(line) || /^\.{3,}$/.test(line)) out.push({ t: 'rule', style: 'dashed' });
    else if (/^(=\s*){3,}$/.test(line)) out.push({ t: 'rule', style: 'solid' });
    else if (/^_{3,}$/.test(line)) out.push({ t: 'space', h: Math.round(base * 1.1) }, { t: 'rule', style: 'thin' });
    else if ((m = /^###\s*(.+)$/.exec(line))) out.push({ t: 'text', text: m[1], size: Math.round(base * 0.8) });
    else if ((m = /^##\s*(.+)$/.exec(line))) out.push({ t: 'text', text: m[1], size: Math.round(base * 1.1), bold: true });
    else if ((m = /^#\s*(.+)$/.exec(line))) out.push({ t: 'text', text: m[1], size: Math.round(base * 1.45), bold: true, align: 'center' });
    else if ((m = /^!!\s*(.*)$/.exec(line))) out.push({ t: 'banner', text: m[1] || 'WARNING', size: Math.round(base * 1.2) });
    else if ((m = /^>\s*(.*)$/.exec(line))) out.push({ t: 'text', text: m[1], size: base, align: 'center' });
    else if ((m = /^\[\s*([xX✓✔]?)\s*\]\s*(.*)$/.exec(line))) out.push({ t: 'check', text: m[2], checked: !!m[1], size: base });
    else if ((m = /^(?:[-•]|\*(?!\*))\s+(.+)$/.exec(line)) || (m = /^-([A-Za-z].*)$/.exec(line))) out.push({ t: 'bullet', text: m[1], size: base });
    else if ((m = /^([^|]+?)\s*\|$/.exec(line))) out.push({ t: 'kv', key: m[1], value: '', size: base });
    else if (/\S\s*\|\s*\S/.test(line) && !line.startsWith('|')) {
      const i = line.lastIndexOf('|');
      out.push({ t: 'lr', left: line.slice(0, i).trim(), right: line.slice(i + 1).trim(), size: base });
    } else if (keyValue && (m = /^([^:]{1,24}):\s*(.*)$/.exec(line))) out.push({ t: 'kv', key: m[1] + ':', value: m[2], size: base });
    else if (checklist) out.push({ t: 'check', text: line, checked: false, size: base });
    else out.push({ t: 'text', text: line, size: base });
  }
  return out;
}

// ---------- document model ----------
export const money = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

export function itemTotals(items, taxPct, discount = 0) {
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const disc = Math.min(Math.max(0, Number(discount) || 0), Math.max(0, subtotal));
  const tax = (subtotal - disc) * (Number(taxPct) || 0) / 100;
  return { subtotal, discount: disc, tax, total: subtotal - disc + tax };
}

export const TEXT_SIZES = { S: 0.85, M: 1, L: 1.25, XL: 1.6 };
// Label lengths in dots (203 dpi). The print width is always 384 dots (48 mm).
export const LABEL_SIZES = { auto: 0, '1': 203, '1.5': 305, '2': 406, '3': 609, '4': 812 };
const FRAME_PAD = { none: 0, cut: 8, box: 10, round: 14 };

// Layout defaults per type; presets and the form can override any of them.
export const TYPE_DEFAULTS = {
  receipt: { header: 'full', showDate: true, showTime: true, showCustomer: true, size: 'auto', frame: 'none', textSize: 'M', showFooter: true },
  note: { header: 'full', showDate: true, showTime: true, showCustomer: true, size: 'auto', frame: 'none', textSize: 'M', showFooter: true },
  warning: { header: 'full', showDate: true, showTime: true, showCustomer: true, size: 'auto', frame: 'none', textSize: 'M', showFooter: false },
  checklist: { header: 'full', showDate: true, showTime: true, showCustomer: true, size: 'auto', frame: 'none', textSize: 'M', showFooter: false },
  tag: { header: 'name', showDate: true, showTime: false, showCustomer: true, size: 'auto', frame: 'cut', textSize: 'M', showFooter: false },
  bins: { header: 'none', showDate: false, showTime: false, showCustomer: false, size: '1', frame: 'cut', textSize: 'L', showFooter: false },
};

const fmtDate = now => now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
const fmtTime = now => now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// ---------- logo ----------
let LOGO = null; // processed 1-bit canvas, set by the app
export const setLogo = c => { LOGO = c || null; };

function grayOf(img, width) {
  const w = Math.max(8, Math.min(W, Math.round(width)));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * w / (img.naturalWidth || img.width)));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // transparent -> white
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return { c, ctx, w, h, g };
}

/** Otsu threshold: the cut between dark and light that separates them best. */
export function autoThreshold(img) {
  const { g } = grayOf(img, 192);
  const hist = new Array(256).fill(0);
  for (const v of g) hist[Math.min(255, Math.max(0, v | 0))]++;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = g.length - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  return Math.min(230, Math.max(30, t + 1));
}

/** Image -> pure black/white canvas the printer reproduces exactly. */
export function processLogo(img, { width = 200, threshold = 128, dither = false, invert = false } = {}) {
  const { c, ctx, w, h, g } = grayOf(img, width);
  if (invert) for (let i = 0; i < g.length; i++) g[i] = 255 - g[i];
  const out = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const v = g[i];
    const black = v < threshold;
    if (dither) { // Floyd-Steinberg, centered on the chosen threshold
      const err = v - (black ? threshold - 128 : threshold + 127);
      if (x + 1 < w) g[i + 1] += err * 7 / 16;
      if (y + 1 < h) { if (x > 0) g[i + w - 1] += err * 3 / 16; g[i + w] += err * 5 / 16; if (x + 1 < w) g[i + w + 1] += err / 16; }
    }
    const p = i * 4;
    out.data[p] = out.data[p + 1] = out.data[p + 2] = black ? 0 : 255;
    out.data[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

// ---------- heading ----------
export const HEAD_STYLES = {
  classic: 'Classic: big bold name',
  bar: 'Black bar: white name on black',
  boxed: 'Boxed: name in a frame',
  lines: 'Lines: rules above and below',
  big: 'Extra large name',
  minimal: 'Minimal: small, left aligned',
  logo: 'Logo only (no name)',
};

function headerBlocks(doc, brand, base, now) {
  const b = [];
  const mode = doc.header || 'full';
  const name = (brand.shopName || '').trim();
  const st = brand.headStyle || 'classic';
  const left = st === 'minimal';
  if (mode === 'full') {
    if (LOGO && brand.showLogo !== false) b.push({ t: 'image', canvas: LOGO, scale: base / Math.round((brand.baseSize || 22) * (TEXT_SIZES[doc.textSize] || 1)), align: left ? 'left' : 'center' }, { t: 'space', h: 4 });
    const ns = Math.round(base * (Number(brand.nameScale) || 2));
    if (name && st !== 'logo') {
      if (st === 'bar') b.push({ t: 'banner', text: name, size: Math.round(ns * 0.7), fit: true });
      else if (st === 'boxed') b.push({ t: 'fit', text: name, maxSize: Math.round(ns * 0.85), bold: true, box: true });
      else if (st === 'lines') b.push({ t: 'rule', style: 'thick' }, { t: 'fit', text: name, maxSize: ns, bold: true }, { t: 'rule', style: 'thick' });
      else if (st === 'big') b.push({ t: 'fit', text: name, maxSize: Math.round(ns * 1.5), minSize: Math.round(base * 1.4), bold: true });
      else if (st === 'minimal') b.push({ t: 'text', text: name, size: Math.round(base * 1.25), bold: true });
      else b.push({ t: 'fit', text: name, maxSize: ns, bold: true });
    }
    if ((brand.tagline || '').trim()) b.push({ t: 'text', text: brand.tagline.trim(), size: Math.round(base * 0.8), align: left ? 'left' : 'center', bold: st === 'bar' });
    const info = String(brand.info || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (info.length) b.push(...parseMarkup(info.map(l => (left || /^[#>!\-=\[*]|\|/.test(l.trim()) ? l : '> ' + l)).join('\n'), Math.round(base * 0.75)));
  } else if (mode === 'name' && name) {
    b.push({ t: 'fit', text: name, maxSize: Math.round(base * 1.15), bold: true, minSize: 10 });
  } else if (mode === 'bar' && name) {
    b.push({ t: 'banner', text: name, size: Math.round(base * 0.9), fit: true });
  }
  const d = doc.showDate !== false, t = doc.showTime !== false;
  if (d || t) {
    if (mode === 'full' && d && t) b.push({ t: 'lr', left: fmtDate(now), right: fmtTime(now), size: Math.round(base * 0.85) });
    else b.push({ t: 'text', text: [d && fmtDate(now), t && fmtTime(now)].filter(Boolean).join(' · '), size: mode === 'full' ? Math.round(base * 0.85) : Math.min(Math.round(base * 0.7), Math.round((brand.baseSize || 22) * 0.75)), align: left && mode === 'full' ? 'left' : 'center' });
  }
  return b;
}

function customerBlocks(doc, base) {
  const b = [];
  const ord = String(doc.orderNo ?? '').trim();
  if (ord) b.push({ t: 'text', text: /order|ticket|invoice|#/i.test(ord) ? ord : `Order #${ord}`, size: Math.round(base * 1.1), bold: true });
  const c = doc.customer || {};
  const s = Math.round(base * 0.9);
  if ((c.name || '').trim()) b.push({ t: 'kv', key: 'Customer:', value: c.name.trim(), size: s });
  if ((c.device || '').trim()) b.push({ t: 'kv', key: 'Device:', value: c.device.trim(), size: s });
  if ((c.phone || '').trim()) b.push({ t: 'kv', key: 'Phone:', value: c.phone.trim(), size: s });
  if ((c.email || '').trim()) b.push({ t: 'kv', key: 'Email:', value: c.email.trim(), size: s });
  if ((doc.order || '').trim()) b.push({ t: 'text', text: doc.order.trim(), size: s, bold: !ord });
  return b;
}

/**
 * doc: { type, orderNo, customer{name,phone,email,device}, order, title, items[{desc,qty,price}], taxPct, discount, payment,
 *        body, showFooter, header: full|name|bar|none, showDate, size, frame, textSize }
 * brand: { shopName, tagline, footer, currency, baseSize, font }
 */
export function buildBlocks(doc, brand, now = new Date(), baseOverride) {
  const base = baseOverride || Math.round((brand.baseSize || 22) * (TEXT_SIZES[doc.textSize] || 1));
  const b = headerBlocks(doc, brand, base, now);
  const named = b.length > 0 && (doc.header || 'full') !== 'none';
  const cust = doc.showCustomer === false ? [] : customerBlocks(doc, base);
  if (cust.length) { if (b.length) b.push({ t: 'space', h: 2 }); b.push(...cust); }
  if ((named || cust.length) && doc.type !== 'warning') b.push({ t: 'rule', style: 'solid' });
  else if (b.length) b.push({ t: 'space', h: 6 });

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
      const { subtotal, discount, tax, total } = itemTotals(items, doc.taxPct, doc.discount);
      b.push({ t: 'rule', style: 'dashed' });
      if (Number(doc.taxPct) || discount) b.push({ t: 'lr', left: 'Subtotal', right: cur + money(subtotal), size: base });
      if (discount) b.push({ t: 'lr', left: 'Discount', right: '-' + cur + money(discount), size: base });
      if (Number(doc.taxPct)) b.push({ t: 'lr', left: `Tax (${Number(doc.taxPct)}%)`, right: cur + money(tax), size: base });
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
      if (title) b.push({ t: 'fit', text: title, maxSize: Math.round(base * 1.8), minSize: base, bold: true });
      b.push({ t: 'space', h: 4 }, ...parseMarkup(doc.body, Math.round(base * 1.05), { keyValue: true }));
      break;
    default: // note / sticky note
      if (title) b.push({ t: 'text', text: title, size: Math.round(base * 1.3), bold: true, align: 'center' }, { t: 'space', h: 6 });
      b.push(...parseMarkup(doc.body, base));
  }
  if (doc.showFooter && brand.footer) b.push({ t: 'space', h: 10 }, ...parseMarkup(brand.footer.split('\n').map(l => (l && !/^[#>!\-=\[*]/.test(l) ? '> ' + l : l)).join('\n'), Math.round(base * 0.9)));
  // drop a trailing rule/space so fixed-size labels center nicely
  while (b.length && b[b.length - 1].t === 'space') b.pop();
  return b;
}

// One bin label: "Main text | optional small line"
function binBlocks(line, doc, brand, base, now) {
  const i = line.indexOf('|');
  const main = (i < 0 ? line : line.slice(0, i)).trim();
  const sub = i < 0 ? '' : line.slice(i + 1).trim();
  const b = headerBlocks(doc, brand, Math.round(base * 0.75), now);
  if (b.length) b.push({ t: 'space', h: 4 });
  b.push({ t: 'fit', text: main || ' ', maxSize: Math.round(base * 2.4), minSize: Math.round(base * 1.2), bold: true });
  if (sub) b.push({ t: 'text', text: sub, size: Math.round(base * 0.95), align: 'center' });
  return b;
}

export const binLines = doc => String(doc.body || '').replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);

// ---------- layout + draw ----------
let BROKE = 0; // count of words split across lines in the current render
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
      BROKE++;
      let i = cur.length;
      while (i > 1 && ctx.measureText(cur.slice(0, i)).width > maxW) i--;
      out.push(cur.slice(0, i));
      cur = cur.slice(i);
    }
  }
  if (cur.trim() || !out.length) out.push(cur.trimEnd());
  return out;
}

// Rich wrap: text with **bold** spans -> lines of pieces [{text, f, dx}] with total width w.
function wrapRich(ctx, text, size, bold, fam, maxW) {
  const parts = String(text ?? '').split('**');
  const segs = parts.length >= 3 ? parts.map((t, i) => ({ t, b: bold || i % 2 === 1 })) : [{ t: stripBold(text), b: bold }];
  const lines = [];
  let line = [];
  let lw = 0;
  const flush = () => {
    while (line.length && !line[line.length - 1].text.trim()) lw -= line.pop().w;
    lines.push({ pieces: line, w: Math.max(0, lw) });
    line = []; lw = 0;
  };
  for (const s of segs) {
    const f = fontOf(size, s.b, fam);
    ctx.font = f;
    for (const tok of s.t.split(/(\s+)/)) {
      if (!tok) continue;
      const ws = !tok.trim();
      if (ws && !line.length) continue;
      const tw = ctx.measureText(ws ? ' ' : tok).width;
      if (lw + tw <= maxW || ws) { line.push({ text: ws ? ' ' : tok, f, dx: lw, w: tw }); lw += tw; continue; }
      if (line.length) flush();
      let rest = tok;
      while (ctx.measureText(rest).width > maxW) {
        BROKE++;
        let i = rest.length;
        while (i > 1 && ctx.measureText(rest.slice(0, i)).width > maxW) i--;
        const piece = rest.slice(0, i);
        lines.push({ pieces: [{ text: piece, f, dx: 0, w: ctx.measureText(piece).width }], w: ctx.measureText(piece).width });
        rest = rest.slice(i);
      }
      const rw = ctx.measureText(rest).width;
      line.push({ text: rest, f, dx: 0, w: rw }); lw = rw;
    }
  }
  if (line.length || !lines.length) flush();
  return lines;
}

const fontOf = (size, bold, family) => `${bold ? 'bold ' : ''}${size}px ${family}`;
const lineH = size => Math.ceil(size * 1.25);

export function renderBlocks(blocks, { font = 'sans-serif', padTop = 4, padBottom = 6, padX = 2 } = {}) {
  const m = document.createElement('canvas').getContext('2d');
  const ops = [];
  BROKE = 0;
  let y = padTop;
  const PX = padX;
  const maxW = W - PX * 2;
  const richOps = (text, size, bold, fam, width, xLeft, align) => {
    for (const ln of wrapRich(m, text, size, bold, fam, width)) {
      const x0 = align === 'center' ? xLeft + (width - ln.w) / 2 : align === 'right' ? xLeft + width - ln.w : xLeft;
      ops.push({ k: 'rich', y, x0, pieces: ln.pieces });
      y += lineH(size);
    }
  };
  for (const b of blocks) {
    const size = b.size || 22;
    const fam = b.font || font;
    const f = fontOf(size, b.bold, fam);
    m.font = f;
    switch (b.t) {
      case 'text':
        richOps(b.text, size, b.bold, fam, maxW, PX, b.align || 'left');
        break;
      case 'fit': {
        const text = stripBold(b.text);
        const fw = b.box ? maxW - 28 : maxW;
        let s = b.maxSize || 44;
        const min = b.minSize || 10;
        m.font = fontOf(s, b.bold, fam);
        while (s > min && m.measureText(text).width > fw) { s--; m.font = fontOf(s, b.bold, fam); }
        const y0 = y;
        if (b.box) y += 10;
        if (m.measureText(text).width > fw) richOps(text, s, b.bold, fam, fw, PX + (maxW - fw) / 2, 'center');
        else { ops.push({ k: 'text', y, f: fontOf(s, b.bold, fam), text, align: 'center' }); y += lineH(s); }
        if (b.box) { y += 6; ops.push({ k: 'frame', x: PX + 2, y: y0, w: maxW - 4, h: y - y0 }); y += 6; }
        break;
      }
      case 'image': {
        const c = b.canvas;
        const sc = Math.min(b.scale || 1, maxW / c.width);
        const w = Math.max(1, Math.round(c.width * sc)), h = Math.max(1, Math.round(c.height * sc));
        const x = b.align === 'left' ? PX : Math.round((W - w) / 2);
        ops.push({ k: 'image', canvas: c, x, y, w, h });
        y += h + 4;
        break;
      }
      case 'lr': {
        const bold = b.bold || hasBold(b.left) || hasBold(b.right);
        const lf = fontOf(size, bold, fam);
        m.font = lf;
        const right = stripBold(b.right);
        const rw = m.measureText(right).width;
        const lines = wrap(m, stripBold(b.left), Math.max(60, maxW - rw - 12));
        ops.push({ k: 'text', y, f: lf, text: right, align: 'right' });
        for (const ln of lines) { ops.push({ k: 'text', y, f: lf, text: ln, align: 'left' }); y += lineH(size); }
        break;
      }
      case 'kv': {
        const kf = fontOf(size, true, fam);
        m.font = kf;
        const kw = m.measureText(stripBold(b.key) + ' ').width;
        m.font = f;
        const lines = wrap(m, stripBold(b.value || ''), Math.max(60, maxW - kw));
        ops.push({ k: 'text', y, f: kf, text: stripBold(b.key), align: 'left' });
        lines.forEach(ln => { ops.push({ k: 'text', y, f, text: ln, align: 'left', x: PX + kw }); y += lineH(size); });
        if (!(b.value || '').trim()) ops.push({ k: 'line', y: y - Math.round(size * 0.2), x: PX + kw, w: maxW - kw });
        break;
      }
      case 'bullet':
      case 'check': {
        const ind = Math.round(size * 1.3);
        ops.push({ k: b.t, y, size, checked: b.checked, x: PX });
        richOps(b.text, size, b.bold, fam, maxW - ind, PX + ind, 'left');
        if (b.t === 'check') y += 2;
        break;
      }
      case 'banner': {
        let bs = size;
        if (b.fit) { m.font = fontOf(bs, true, fam); while (bs > 10 && m.measureText(stripBold(b.text)).width > maxW - 12) { bs--; m.font = fontOf(bs, true, fam); } }
        const bsize = bs;
        const bf = fontOf(bsize, true, fam);
        m.font = bf;
        const lines = wrap(m, stripBold(b.text), maxW - 12);
        const h = lines.length * lineH(bsize) + 10;
        ops.push({ k: 'box', y, h, x: PX, w: maxW });
        lines.forEach((ln, i) => ops.push({ k: 'text', y: y + 5 + i * lineH(bsize), f: bf, text: ln, align: 'center', white: true }));
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
  const x0 = PX > 4 ? PX : 0;
  const x1 = PX > 4 ? W - PX : W;
  for (const o of ops) {
    ctx.fillStyle = '#000';
    switch (o.k) {
      case 'text':
        ctx.font = o.f;
        ctx.textAlign = o.align;
        if (o.white) ctx.fillStyle = '#fff';
        ctx.fillText(o.text, o.x ?? (o.align === 'left' ? PX : o.align === 'right' ? W - PX : W / 2), o.y);
        break;
      case 'rich':
        ctx.textAlign = 'left';
        for (const p of o.pieces) { ctx.font = p.f; ctx.fillText(p.text, o.x0 + p.dx, o.y); }
        break;
      case 'box': ctx.fillRect(PX > 4 ? o.x : 0, o.y, PX > 4 ? o.w : W, o.h); break;
      case 'frame': ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3); break;
      case 'image': ctx.imageSmoothingEnabled = false; ctx.drawImage(o.canvas, o.x, o.y, o.w, o.h); break;
      case 'bar': ctx.fillRect(0, o.y, o.w, o.h); break;
      case 'line': ctx.fillRect(o.x, o.y, o.w, 1); break;
      case 'rule':
        if (o.style === 'dashed') for (let x = x0; x < x1; x += 12) ctx.fillRect(x, o.y, Math.min(7, x1 - x), 2);
        else if (o.style === 'thick') { ctx.fillRect(x0, o.y, x1 - x0, 3); ctx.fillRect(x0, o.y + 6, x1 - x0, 3); }
        else ctx.fillRect(x0, o.y, x1 - x0, o.style === 'thin' ? 1 : 2);
        break;
      case 'bullet': {
        const r = Math.max(2, Math.round(o.size * 0.14));
        ctx.beginPath(); ctx.arc(o.x + Math.round(o.size * 0.45), o.y + Math.round(o.size * 0.55), r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'check': {
        const s = Math.round(o.size * 0.8), x = o.x + 1, yy = o.y + Math.round(o.size * 0.12);
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
  c.broken = BROKE;
  return c;
}

// ---------- frames and fixed-size labels ----------
function drawFrame(c, frame) {
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  const w = c.width, h = c.height;
  if (frame === 'cut') {
    const dash = (x, y, len, horiz) => { for (let i = 0; i < len; i += 12) horiz ? ctx.fillRect(x + i, y, Math.min(7, len - i), 2) : ctx.fillRect(x, y + i, 2, Math.min(7, len - i)); };
    dash(0, 0, w, true); dash(0, h - 2, w, true); dash(0, 0, h, false); dash(w - 2, 0, h, false);
    // solid corner marks so the cut points are easy to find
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) {
      ctx.fillRect(sx > 0 ? x : x - 14, sy > 0 ? y : y - 3, 14, 3);
      ctx.fillRect(sx > 0 ? x : x - 3, sy > 0 ? y : y - 14, 3, 14);
    }
  } else if (frame === 'box') {
    ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4);
  } else if (frame === 'round') {
    ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 6, 22); ctx.stroke();
  }
}

function blank(h) {
  const c = document.createElement('canvas');
  c.width = W; c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, c.height);
  return c;
}

function layout(blocksFor, base0, H, frame, font, grow = true) {
  const pad = FRAME_PAD[frame] ?? 0;
  const padX = frame === 'none' ? 2 : pad + 6;
  if (!H) {
    const c = renderBlocks(blocksFor(base0), { font, padX, padTop: frame === 'none' ? 4 : pad + 8, padBottom: frame === 'none' ? 6 : pad + 8 });
    if (frame !== 'none') drawFrame(c, frame);
    return c;
  }
  const inner = H - (frame === 'none' ? 4 : pad * 2 + 8);
  const draw = s => renderBlocks(blocksFor(s), { font, padX, padTop: 0, padBottom: 0 });
  let base = base0, c = draw(base);
  if (c.height <= inner) { // grow while it still fits
    const max = Math.round(base0 * (grow ? 1.6 : 1));
    for (let s = base + 2; s <= max; s += 2) { const n = draw(s); if (n.height > inner || n.broken > c.broken) break; base = s; c = n; }
  } else {
    while (c.height > inner && base > 10) { base -= 1; c = draw(base); }
  }
  const out = blank(H);
  out.getContext('2d').drawImage(c, 0, Math.max(frame === 'none' ? 2 : pad + 4, Math.round((H - c.height) / 2)));
  if (frame !== 'none') drawFrame(out, frame);
  return out;
}

/** The whole printout for a doc as one white canvas (bin labels are stacked with a gap). */
export function renderDoc(doc, brand, now = new Date()) {
  const font = brand.font || 'sans-serif';
  const frame = FRAME_PAD[doc.frame] !== undefined ? doc.frame : 'none';
  const H = LABEL_SIZES[doc.size] || 0;
  const base0 = Math.round((brand.baseSize || 22) * (TEXT_SIZES[doc.textSize] || 1));
  if (doc.type === 'bins') {
    const lines = binLines(doc);
    const parts = (lines.length ? lines : [doc.title || 'LABEL']).map(l => layout(base => binBlocks(l, doc, brand, base, now), base0, H, frame, font, false));
    const gap = 16;
    const out = blank(parts.reduce((s, c) => s + c.height, 0) + gap * (parts.length - 1));
    let y = 0;
    for (const c of parts) { out.getContext('2d').drawImage(c, 0, y); y += c.height + gap; }
    return out;
  }
  return layout(base => buildBlocks(doc, brand, now, base), base0, H, frame, font);
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
