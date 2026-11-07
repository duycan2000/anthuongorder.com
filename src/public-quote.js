// Customer-facing quote page: /q/:publicId  (mobile first, English)
// Layout: total + status first, compact item rows (all numbers kept), payment info only when needed.

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('en-US');
const PLATFORM = { shopee: 'Shopee', lazada: 'Lazada', tiki: 'Tiki', other: 'Online' };
const STATUS = {
  quoted: { label: 'Awaiting payment', cls: 's-quoted' },
  paid: { label: 'Paid', cls: 's-paid' },
  ordered: { label: 'Ordered', cls: 's-ordered' },
  arrived: { label: 'Ready for pickup', cls: 's-arrived' },
  received: { label: 'Picked up', cls: 's-received' },
  cancelled: { label: 'Cancelled', cls: 's-cancelled' },
  returned: { label: 'Returned', cls: 's-cancelled' },
};
const PER_PAGE = 5;
const STAGES = ['quoted', 'paid', 'ordered', 'arrived', 'received'];
const STAGE_LABEL = ['Quote', 'Paid', 'Ordered', 'Arrived', 'Picked up'];

function fmtDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}
function safeLink(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch (_) { return ''; }
}

const BASE_CSS = `
:root{--g:#2E5E4E;--gl:#E7F1ED;--ink:#17211D;--ink2:#3D4A45;--mut:#6B7873;--line:#E6ECE9;--bg:#F3F6F4;--sh:#EE4D2D;--lz:#1A3BA0;--tk:#0B74E5}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink);line-height:1.4;font-size:15px}
a{color:inherit}
.wrap{max-width:540px;margin:0 auto;padding:0 12px 32px}
.top{background:var(--g);color:#fff;padding:14px 16px 58px}
.top .in{max-width:540px;margin:0 auto;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.brand{font-weight:800;letter-spacing:.6px;font-size:16px}
.top a{font-size:12.5px;opacity:.8;text-decoration:none;white-space:nowrap}
.card{background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(20,40,30,.05),0 6px 20px rgba(20,40,30,.06);margin-top:12px;overflow:hidden}
.hero{margin-top:-46px;padding:16px 16px 14px}
.meta{display:flex;justify-content:space-between;color:var(--mut);font-size:13px}
.meta b{color:var(--ink2);font-weight:700}
.cust{font-size:21px;font-weight:800;margin-top:6px;letter-spacing:-.2px}
.total{display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
.total small{color:var(--mut);font-size:12.5px;display:block}
.total b{font-size:30px;font-weight:800;color:var(--g);letter-spacing:-.6px;font-variant-numeric:tabular-nums;line-height:1.1}
.status{margin-top:12px;display:flex;align-items:center;gap:8px;background:var(--gl);color:var(--g);border-radius:10px;padding:9px 11px;font-size:13.5px;font-weight:600}
.status i{flex:none;width:8px;height:8px;border-radius:50%;background:var(--g)}
.status.wait{background:#FFF4DE;color:#8A5A00} .status.wait i{background:#E5A93B}
.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:10px}
.st{text-align:center;font-size:10px;color:#9AA6A1;font-weight:600}
.st i{display:block;height:4px;border-radius:4px;background:#E3E9E6;margin-bottom:4px}
.st.on{color:var(--g)} .st.on i{background:var(--g)}
h2{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700;margin:18px 4px 0}
h2 span{text-transform:none;letter-spacing:0;font-weight:500}
.it{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:2px 10px;padding:12px 14px;border-top:1px solid var(--line)}
.it.pfirst,.it:first-child{border-top:0}
.no{grid-row:1/4;color:var(--mut);font-weight:700;font-size:13px;padding-top:1px}
.nm{font-weight:700;font-size:14.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nm a{text-decoration:none}
.nm a:after{content:" ↗";color:var(--g);font-weight:600;font-size:12px}
.amt{text-align:right;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.sub{color:var(--mut);font-size:13px;min-width:0}
.sub .pf{font-weight:700}
.pf.shopee{color:var(--sh)} .pf.lazada{color:var(--lz)} .pf.tiki{color:var(--tk)} .pf.other{color:var(--ink2)}
.stt{text-align:right;font-size:12px;font-weight:700;white-space:nowrap}
.s-quoted{color:#6B7280} .s-paid{color:#B26B00} .s-ordered{color:#2563EB} .s-arrived{color:#13774C} .s-received{color:var(--g)} .s-cancelled{color:#B03A2E}
.stt.s-arrived:before{content:"● "}
.calc{grid-column:2/4;color:var(--mut);font-size:12px;font-variant-numeric:tabular-nums}
.it.off{opacity:.55} .it.off .amt{text-decoration:line-through}
.paged.js .it{display:none} .paged.js .it.show{display:grid}
.pager{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-top:1px solid var(--line);background:#FAFBFA;flex-wrap:wrap}
.pg-nums{display:flex;gap:6px}
.pager button{font:inherit;cursor:pointer;border:1.5px solid var(--g);background:#fff;color:var(--g);font-weight:800;border-radius:10px;min-width:42px;height:42px;padding:0 12px;font-size:15px}
.pager .pg-num.on{background:var(--g);color:#fff}
.pager .pg-nav{background:var(--g);color:#fff}
.pager button:disabled{opacity:.3;cursor:default;background:#fff;color:var(--g)}
.sum{padding:12px 16px}
.sum .r{display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-variant-numeric:tabular-nums;color:var(--ink2)}
.sum .r span:last-child{white-space:nowrap}
.sum .f{color:var(--mut);font-size:12px;margin:-2px 0 2px}
.sum .g{border-top:1px solid var(--line);margin-top:6px;padding-top:8px;color:var(--g);font-weight:800;font-size:17px}
.sum .ref{color:#B03A2E}
.note{padding:12px 14px;font-size:14px;color:#5B4300;background:#FFFBF2;border-left:4px solid #E5A93B}
.opt{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:14px}
.opt:first-of-type{border-top:0}
.ico{flex:none;width:30px;height:30px;border-radius:8px;background:var(--gl);color:var(--g);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
.opt small{display:block;color:var(--mut);font-size:12.5px}
.opt pre{white-space:pre-wrap;font-family:inherit;font-size:13.5px;margin-top:4px;background:#F7F9F8;border-radius:8px;padding:7px 9px}
.pay{padding:0}
.pay summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pay summary::-webkit-details-marker{display:none}
.pay .paid{color:#13774C;font-weight:700;font-size:14.5px}
.pay .ptitle{font-weight:700;font-size:15px}
.tg{flex:none;font-size:12.5px;font-weight:700;color:var(--g);background:var(--gl);border-radius:20px;padding:4px 10px;white-space:nowrap}
.pay[open] .tg-closed,.pay:not([open]) .tg-open{display:none}
.tg .arr{display:inline-block;transition:transform .15s}
.pay[open] .tg .arr{transform:rotate(180deg)}
.pay[open] summary{border-bottom:1px solid var(--line)}
.pay-b{padding:6px 16px 14px}
.pay .lnk{color:var(--g);font-weight:600}
.pfoot{display:block;color:var(--mut);font-size:12.5px;margin-top:6px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;padding:14px;border-radius:14px;background:#25D366;color:#fff;font-weight:800;text-decoration:none;font-size:16px;box-shadow:0 6px 16px rgba(37,211,102,.25)}
.foot{text-align:center;color:var(--mut);font-size:12px;margin-top:14px}
.foot a{color:var(--g);font-weight:600;text-decoration:none}
`;

export function renderPublicQuote({ order, items, settings, url, returns = [] }) {
  const shop = settings.shop || {};
  const active = items.filter((i) => !['cancelled', 'returned'].includes(i.status));
  const counted = items.filter((i) => i.status !== 'cancelled');
  const refunded = returns.reduce((a, r) => a + r.refund_amount, 0);
  const paid = order.payment_status !== 'unpaid';

  let stage = active.length ? Math.min(...active.map((i) => Math.max(0, STAGES.indexOf(i.status)))) : 0;
  if (stage === 0 && paid) stage = 1;
  const arrived = active.filter((i) => ['arrived', 'received'].includes(i.status)).length;
  const picked = active.filter((i) => i.status === 'received').length;
  let summary = 'Awaiting payment — we order right after you pay.';
  if (paid) summary = 'Payment received — thank you! We are ordering your items.';
  if (stage >= 2) summary = 'Ordered — we will message you when items arrive.';
  if (arrived > 0 && arrived < active.length) summary = `${arrived} of ${active.length} items have arrived at the cafe.`;
  if (active.length && arrived === active.length) summary = 'All items are ready for pickup at the cafe!';
  if (active.length && picked === active.length) summary = 'All items picked up. Thank you!';
  const steps = STAGE_LABEL.map((l, i) => `<div class="st ${i <= stage ? 'on' : ''}"><i></i>${l}</div>`).join('');

  // per-item status only when items differ (otherwise the status bar above says it)
  const sameStatus = new Set(items.map((i) => i.status)).size <= 1;
  const rows = items.map((it, idx) => {
    const st = STATUS[it.status] || STATUS.quoted;
    const off = ['cancelled', 'returned'].includes(it.status);
    const link = safeLink(it.link);
    const variation = [it.variation, it.variation2].filter(Boolean).join(', ');
    const name = esc(it.name || it.name_vi || 'Item');
    const unit = it.qty > 1 ? `${it.qty} × ${money(Math.round(it.price / it.qty))}` : money(it.price);
    const calc = [unit, it.shipping ? `ship ${money(it.shipping)}` : 'free ship', `fee ${money(it.fee)}`].join(' + ');
    return `<div class="it ${off ? 'off' : ''}" data-page="${Math.floor(idx / PER_PAGE) + 1}">
      <div class="no">${idx + 1}</div>
      <div class="nm">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow">${name}</a>` : name}</div>
      <div class="amt">${money(it.price + it.shipping + it.fee)}</div>
      <div class="sub">${variation ? esc(variation) + ' · ' : ''}x${it.qty} · <span class="pf ${esc(it.platform)}">${esc(PLATFORM[it.platform] || 'Online')}</span></div>
      <div class="stt ${st.cls}">${sameStatus ? '' : st.label}</div>
      <div class="calc">${calc}</div>
    </div>`;
  }).join('');

  const feeFormula = (() => {
    if (counted.length < 2) return '';
    const groups = {};
    for (const f of counted.map((i) => i.fee)) groups[f] = (groups[f] || 0) + 1;
    return Object.entries(groups).sort((a, b) => b[0] - a[0]).map(([f, n]) => (n > 1 ? `${n} × ${money(f)}` : money(f))).join(' + ');
  })();

  const pages = Math.ceil(items.length / PER_PAGE);
  const pager = pages > 1 ? `<nav class="pager" id="pager" aria-label="Item pages">
      <button type="button" class="pg-nav" data-go="prev" aria-label="Previous page">‹</button>
      <span class="pg-nums">${Array.from({ length: pages }, (_, k) => `<button type="button" class="pg-num" data-go="${k + 1}">${k + 1}</button>`).join('')}</span>
      <button type="button" class="pg-nav" data-go="next" aria-label="Next page">›</button>
    </nav>` : '';

  const wa = String(shop.whatsapp || '').replace(/\D/g, '');
  const waText = encodeURIComponent(`Hi! About my quote #${order.code}: ${url}`);
  const paidLabel = { cash: 'cash', wise: 'Wise', bank: 'bank transfer' }[order.payment_status];
  const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(shop.address || 'Linz Coffee 42 An Thuong 2 Da Nang');
  const place = (shop.address || 'Linz Coffee, 42 An Thuong 2').split(',').slice(0, 2).join(',');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#2E5E4E">
<title>Quote ${esc(order.code)} · ${esc(shop.name || 'An Thuong Order')}</title>
<meta property="og:title" content="Your quote ${esc(order.code)} — ${money(order.grand_total)} ₫">
<meta property="og:description" content="${esc(counted.length)} item(s) · ${esc(shop.name || 'An Thuong Order')} · ${esc(shop.address || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${BASE_CSS}</style></head><body>
<header class="top"><div class="in"><div class="brand">${esc(shop.name || 'AN THUONG ORDER')}</div><a href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(place)} ↗</a></div></header>
<main class="wrap">
  <section class="card hero">
    <div class="meta"><span>Quote <b>#${esc(order.code)}</b></span><span>${esc(fmtDate(order.order_date))}</span></div>
    <div class="cust">${esc(order.customer_name)}</div>
    <div class="total"><div><small>Total · ${counted.length} item${counted.length === 1 ? '' : 's'}</small></div><b>${money(order.grand_total - refunded)} ₫</b></div>
    <div class="status ${paid ? '' : 'wait'}"><i></i>${esc(summary)}</div>
    <div class="steps">${steps}</div>
  </section>

  <h2>Items <span>${pages > 1 ? `${PER_PAGE} per page · tap ↗ to view product` : 'tap ↗ to view product'}</span></h2>
  <section class="card">
    <div class="${pages > 1 ? 'paged' : ''}" id="item-list">${rows}</div>
    ${pager}
  </section>
  ${order.note ? `<section class="card note">${esc(order.note)}</section>` : ''}

  <section class="card sum">
    <div class="r"><span>Products</span><span>${money(order.products_total)} ₫</span></div>
    <div class="r"><span>Shipping</span><span>${order.shipping_total ? money(order.shipping_total) + ' ₫' : 'Free'}</span></div>
    <div class="r"><span>Service fee</span><span>${money(order.fee_total)} ₫</span></div>
    ${feeFormula ? `<div class="f">${esc(feeFormula)}</div>` : ''}
    ${refunded ? `<div class="r"><span>Total before refund</span><span>${money(order.grand_total)} ₫</span></div><div class="r ref"><span>Refunded to you</span><span>−${money(refunded)} ₫</span></div>` : ''}
    <div class="r g"><span>TOTAL</span><span>${money(order.grand_total - refunded)} ₫</span></div>
  </section>

  <details class="card pay" ${paid ? '' : 'open'}>
    <summary>${paid ? `<span class="paid">✓ Paid by ${esc(paidLabel || 'transfer')} — thank you!</span>` : '<span class="ptitle">How to pay</span>'}<span class="tg"><span class="tg-open">${paid ? 'Payment info' : 'Hide'}</span><span class="tg-closed">${paid ? 'Payment info' : 'How to pay'}</span> <span class="arr">▾</span></span></summary>
    <div class="pay-b">
      <div class="opt"><div class="ico">₫</div><div><b>Cash at the cafe</b><small>${esc(shop.address || '')} · <a href="${esc(mapUrl)}" target="_blank" rel="noopener" class="lnk">Map ↗</a></small></div></div>
      <div class="opt"><div class="ico">W</div><div style="min-width:0;flex:1"><b>Wise transfer</b>${shop.wise ? `<pre>${esc(shop.wise)}</pre>` : '<small>Message us on WhatsApp for Wise details.</small>'}<small>Please send us a screenshot after transfer.</small></div></div>
      ${shop.footer ? `<small class="pfoot">${esc(shop.footer)}</small>` : ''}
    </div>
  </details>

  ${wa ? `<a class="btn" href="https://wa.me/${wa}?text=${waText}" target="_blank" rel="noopener">Message us on WhatsApp</a>` : ''}
  <div class="foot">${esc(shop.name || 'An Thuong Order')} · <a href="${esc(mapUrl)}" target="_blank" rel="noopener">Find us on Google Maps</a></div>
</main>
${pages > 1 ? `<script>
(function () {
  var list = document.getElementById('item-list'), pager = document.getElementById('pager');
  var rows = list.querySelectorAll('.it'), pages = ${pages}, cur = 1;
  function show(p, scroll) {
    cur = Math.max(1, Math.min(pages, p));
    var first = true;
    for (var i = 0; i < rows.length; i++) {
      var on = +rows[i].getAttribute('data-page') === cur;
      rows[i].classList.toggle('show', on);
      rows[i].classList.toggle('pfirst', on && first);
      if (on) first = false;
    }
    var nums = pager.querySelectorAll('.pg-num');
    for (var j = 0; j < nums.length; j++) nums[j].classList.toggle('on', j + 1 === cur);
    pager.querySelector('[data-go=prev]').disabled = cur === 1;
    pager.querySelector('[data-go=next]').disabled = cur === pages;
    if (scroll) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  pager.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]'); if (!t || t.disabled) return;
    var g = t.getAttribute('data-go');
    show(g === 'prev' ? cur - 1 : g === 'next' ? cur + 1 : +g, true);
  });
  list.classList.add('js');
  show(1, false);
})();
</script>` : ''}
</body></html>`;
}

export function renderNotFound() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Quote not found</title><style>${BASE_CSS}</style></head><body>
<header class="top"><div class="in"><div class="brand">AN THUONG ORDER</div></div></header>
<main class="wrap"><section class="card hero"><div class="cust" style="font-size:19px">Quote not found</div>
<p style="color:var(--mut);margin-top:6px">This link may be wrong or the quote was removed. Please message us on WhatsApp.</p></section></main></body></html>`;
}
