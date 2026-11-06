// Draws the vertical WhatsApp quote image (2-line items) on <canvas>.
// 1080px wide. Up to 11 items on a single/last page, 15 on continuation pages.

const W = 1080;
const PAD = 64;
const CW = W - PAD * 2; // 952
const C = {
  g: '#2E5E4E', gl: '#E7F1ED', ink: '#1B2420', mut: '#66736E', line: '#EEF2F0', dash: '#D3DBD7', soft: '#F6F8F7',
  sh: '#EE4D2D', shl: '#FDECE8', lz: '#1A3BA0', lzl: '#E6EBFA', tk: '#0B74E5', tkl: '#E6F3FF', ot: '#4B5753', otl: '#EEF1F0',
};
const ITEM_H = 126;
const LAST_MAX = 11;
const MID_MAX = 15;
const FONT = 'Inter, "Segoe UI", Roboto, Arial, sans-serif';
const PLATFORM = { shopee: ['Shopee', C.sh, C.shl], lazada: ['Lazada', C.lz, C.lzl], tiki: ['Tiki', C.tk, C.tkl], other: ['Online', C.ot, C.otl] };

const money = (n) => Number(n || 0).toLocaleString('en-US');
const font = (w, s) => `${w} ${s}px ${FONT}`;

export async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all(['400', '500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 30px Inter`, 'AĐđ₫')));
  } catch (_) { /* fall back to system fonts */ }
}

export function fmtDateEn(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid).trimEnd() + '…').width <= maxW) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + '…';
}
function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function txt(ctx, s, x, y, f, color, align = 'left') {
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

export function paginate(n) {
  if (n <= LAST_MAX) return [n];
  let p = 2;
  while (MID_MAX * (p - 1) + LAST_MAX < n) p++;
  const last = Math.min(LAST_MAX, Math.ceil(n / p));
  const rest = n - last;
  const out = [];
  for (let i = 0; i < p - 1; i++) out.push(Math.ceil((rest - out.reduce((a, b) => a + b, 0)) / (p - 1 - i)));
  out.push(last);
  return out;
}

function feeFormula(items) {
  const groups = new Map();
  for (const it of items) groups.set(it.fee, (groups.get(it.fee) || 0) + 1);
  if (items.length <= 1) return '';
  // keep first-item fee first, then the rest
  const first = items[0].fee;
  const parts = [];
  const g = new Map(groups);
  parts.push(money(first));
  g.set(first, g.get(first) - 1);
  for (const [fee, n] of g) if (n > 0) parts.push(n > 1 ? `${n} × ${money(fee)}` : money(fee));
  return parts.join(' + ');
}

/**
 * data = { shop:{name,tagline,payment,footer}, order:{code,order_date,customer_name,customer_phone,note},
 *          items:[{name,name_vi,variation,qty,platform,price,shipping,fee,status}] }
 * returns array of canvases
 */
export function renderQuoteImages(data) {
  const shop = data.shop || {};
  const order = data.order || {};
  const items = (data.items || []).filter((i) => !['cancelled', 'returned'].includes(i.status));
  const pages = paginate(Math.max(items.length, 1));
  const canvases = [];
  const totals = items.reduce((t, i) => ({ p: t.p + (i.price || 0), s: t.s + (i.shipping || 0), f: t.f + (i.fee || 0) }), { p: 0, s: 0, f: 0 });
  let offset = 0;

  pages.forEach((count, pi) => {
    const isLast = pi === pages.length - 1;
    const pageItems = items.slice(offset, offset + count);
    const startIndex = offset;
    offset += count;

    // measure payment block height first
    const m = document.createElement('canvas').getContext('2d');
    m.font = font(400, 28);
    const payLines = [];
    const payText = (shop.payment || 'Cash at Linz Coffee, or via Wise.');
    payLines.push(...wrap(m, 'How to pay: ' + payText, CW));
    if (shop.footer) payLines.push(...wrap(m, shop.footer, CW));
    const noteLines = order.note ? wrap(m, 'Note: ' + order.note, CW) : [];
    const headerH = 190, custH = 194;
    const itemsH = Math.max(pageItems.length, items.length ? 0 : 1) * ITEM_H;
    const sumH = 180, totH = 146;
    const payH = 26 + (payLines.length + noteLines.length) * 42 + 36;
    const contH = 104;
    const H = headerH + custH + itemsH + (isLast ? sumH + totH + payH : contH);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    // header
    ctx.fillStyle = C.g; ctx.fillRect(0, 0, W, headerH);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    txt(ctx, fit(ctx, (shop.name || 'AN THUONG ORDER').toUpperCase(), CW), PAD, 46, font(800, 58), '#fff');
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.globalAlpha = 0.8;
    ctx.font = font(400, 30);
    txt(ctx, fit(ctx, shop.tagline || '', CW), PAD, 120, font(400, 30), '#fff');
    ctx.globalAlpha = 1;

    // customer block
    let y = headerH + 32;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    txt(ctx, 'CUSTOMER', PAD, y, font(500, 24), C.mut);
    txt(ctx, 'QUOTE', W - PAD, y, font(500, 24), C.mut, 'right');
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = font(800, 34);
    const codeStr = order.code ? '#' + order.code : 'DRAFT';
    const codeW = ctx.measureText(codeStr).width;
    ctx.font = font(800, 46);
    txt(ctx, fit(ctx, order.customer_name || 'Customer', CW - codeW - 40), PAD, y + 31, font(800, 46), C.ink);
    txt(ctx, codeStr, W - PAD, y + 33, font(800, 34), C.ink, 'right');
    ctx.font = font(400, 31);
    if (order.customer_phone) txt(ctx, fit(ctx, 'WhatsApp: ' + order.customer_phone, CW - 300), PAD, y + 93, font(400, 31), C.ink);
    txt(ctx, fmtDateEn(order.order_date), W - PAD, y + 78, font(400, 31), C.ink, 'right');
    if (pages.length > 1) txt(ctx, `Image ${pi + 1} of ${pages.length}`, W - PAD, y + 118, font(600, 25), C.g, 'right');
    // dashed divider
    y = headerH + custH - 3;
    ctx.strokeStyle = C.dash; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(0, y + 1.5); ctx.lineTo(W, y + 1.5); ctx.stroke(); ctx.setLineDash([]);

    // items
    y = headerH + custH;
    if (!items.length) {
      txt(ctx, 'No items yet', PAD, y + 44, font(500, 30), C.mut);
    }
    pageItems.forEach((it, k) => {
      const top = y + k * ITEM_H;
      const n = startIndex + k + 1;
      // line 1: name + variation
      ctx.font = font(400, 30);
      const varText = it.variation ? '· ' + it.variation : '';
      const varW = varText ? Math.min(ctx.measureText(varText).width, CW * 0.42) : 0;
      const varFit = varText ? fit(ctx, varText, CW * 0.42) : '';
      ctx.font = font(700, 33);
      const nameFit = fit(ctx, `${n}. ${it.name || it.name_vi || 'Item'}`, CW - (varText ? varW + 10 : 0));
      const nameW = txt(ctx, nameFit, PAD, top + 22, font(700, 33), C.ink);
      if (varText) txt(ctx, varFit, PAD + nameW + 10, top + 25, font(400, 30), C.mut);
      // line 2
      const ly = top + 72;
      const qw = txt(ctx, `x${it.qty || 1}`, PAD, ly + 1, font(400, 28), C.mut);
      const [pl, pc, pbg] = PLATFORM[it.platform] || PLATFORM.other;
      ctx.font = font(700, 24);
      const tw = ctx.measureText(pl).width + 32;
      ctx.fillStyle = pbg; rrect(ctx, PAD + qw + 12, ly - 1, tw, 36, 18); ctx.fill();
      txt(ctx, pl, PAD + qw + 12 + 16, ly + 4, font(700, 24), pc);
      // Price (col start 254), Ship (centered at 669), Fee (right at 1016)
      const lw = txt(ctx, 'Price', PAD + 190, ly + 3, font(400, 26), C.mut);
      txt(ctx, money(it.price), PAD + 190 + lw + 10, ly, font(600, 30), C.ink);
      const shipVal = it.shipping ? money(it.shipping) : 'Free';
      ctx.font = font(400, 26); const sl = ctx.measureText('Ship').width;
      ctx.font = font(600, 30); const sv = ctx.measureText(shipVal).width;
      const sx = 669 - (sl + 10 + sv) / 2;
      txt(ctx, 'Ship', sx, ly + 3, font(400, 26), C.mut);
      txt(ctx, shipVal, sx + sl + 10, ly, font(600, 30), C.ink);
      ctx.font = font(600, 30); const fv = ctx.measureText(money(it.fee)).width;
      txt(ctx, money(it.fee), W - PAD, ly, font(600, 30), C.ink, 'right');
      txt(ctx, 'Fee', W - PAD - fv - 10, ly + 3, font(400, 26), C.mut, 'right');
      ctx.fillStyle = C.line; ctx.fillRect(0, top + ITEM_H - 2, W, 2);
    });
    y += Math.max(pageItems.length, items.length ? 0 : 1) * ITEM_H;

    if (!isLast) {
      ctx.fillStyle = C.soft; ctx.fillRect(0, y, W, contH);
      txt(ctx, `Continued in image ${pi + 2} of ${pages.length}  →`, W / 2, y + 36, font(600, 30), C.g, 'center');
      canvases.push(cv);
      return;
    }

    // summary
    ctx.fillStyle = C.soft; ctx.fillRect(0, y, W, sumH);
    const rowY = [y + 28, y + 72, y + 116];
    txt(ctx, `Products (${items.length} item${items.length === 1 ? '' : 's'})`, PAD, rowY[0], font(400, 31), C.ink);
    txt(ctx, money(totals.p) + ' ₫', W - PAD, rowY[0], font(400, 31), C.ink, 'right');
    txt(ctx, 'Shipping', PAD, rowY[1], font(400, 31), C.ink);
    txt(ctx, totals.s ? money(totals.s) + ' ₫' : 'Free', W - PAD, rowY[1], font(400, 31), C.ink, 'right');
    const sfw = txt(ctx, 'Service fee', PAD, rowY[2], font(400, 31), C.ink);
    const formula = feeFormula(items);
    if (formula) { ctx.font = font(400, 27); txt(ctx, fit(ctx, `(${formula})`, CW - sfw - 260), PAD + sfw + 10, rowY[2] + 3, font(400, 27), C.mut); }
    txt(ctx, money(totals.f) + ' ₫', W - PAD, rowY[2], font(400, 31), C.ink, 'right');
    y += sumH;

    // total
    ctx.fillStyle = C.gl; ctx.fillRect(0, y, W, totH);
    ctx.fillStyle = C.g; ctx.fillRect(0, y, W, 5);
    txt(ctx, 'TOTAL', PAD, y + 62, font(800, 38), C.g);
    txt(ctx, money(totals.p + totals.s + totals.f) + ' ₫', W - PAD, y + 34, font(800, 70), C.g, 'right');
    y += totH;

    // payment + note
    let py = y + 26;
    for (const line of noteLines) { txt(ctx, line, PAD, py, font(600, 28), '#8A5A00'); py += 42; }
    payLines.forEach((line) => {
      if (line.startsWith('How to pay:')) {
        const w1 = txt(ctx, 'How to pay:', PAD, py, font(700, 28), C.ink);
        txt(ctx, line.slice('How to pay:'.length), PAD + w1, py, font(400, 28), '#3d4a45');
      } else txt(ctx, line, PAD, py, font(400, 28), '#3d4a45');
      py += 42;
    });
    canvases.push(cv);
  });
  return canvases;
}

export function canvasToBlob(cv) {
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}
