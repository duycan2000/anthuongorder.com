// Customer-facing quote page: /q/:publicId  (mobile first, English)

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

function maskPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 4) return '';
  return '••• ' + d.slice(-4);
}
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
:root{--g:#2E5E4E;--g2:#3F7A66;--gl:#E7F1ED;--ink:#17211D;--mut:#66736E;--line:#E3E9E6;--bg:#F3F6F4;--sh:#EE4D2D;--shl:#FDECE8;--lz:#1A3BA0;--lzl:#E6EBFA}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink);line-height:1.45;font-size:15px}
a{color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:0 14px 40px}
.top{background:linear-gradient(160deg,#2E5E4E 0%,#24493D 100%);color:#fff;padding:22px 20px 70px}
.top .in{max-width:560px;margin:0 auto}
.brand{font-weight:800;letter-spacing:.6px;font-size:19px}
.tag{opacity:.75;font-size:13px;margin-top:2px}
.card{background:#fff;border-radius:18px;box-shadow:0 1px 2px rgba(20,40,30,.05),0 8px 24px rgba(20,40,30,.06);margin-top:14px;overflow:hidden}
.hero{margin-top:-52px;padding:18px 18px 16px}
.row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.lbl{font-size:11px;letter-spacing:1.2px;color:var(--mut);text-transform:uppercase;font-weight:600}
.cust{font-size:24px;font-weight:800;margin-top:2px;letter-spacing:-.2px}
.qno{font-weight:800;font-size:16px;text-align:right}
.qdate{color:var(--mut);font-size:13px;text-align:right}
.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:16px}
.st{text-align:center;font-size:10.5px;color:var(--mut);font-weight:600}
.st i{display:block;height:6px;border-radius:6px;background:#E3E9E6;margin-bottom:6px}
.st.on{color:var(--g)} .st.on i{background:var(--g)}
.st.cur i{background:linear-gradient(90deg,var(--g),#5FA38A)}
.sum{margin-top:12px;background:var(--gl);color:var(--g);border-radius:12px;padding:10px 12px;font-weight:600;font-size:14px}
h2{font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700;margin:22px 4px 0}
.it{padding:14px 16px;border-top:1px solid var(--line)}
.it:first-child{border-top:0}
.it .nm{font-weight:700;font-size:15px;line-height:1.35}
.it .nm span{color:var(--mut);font-weight:500}
.it .vr{color:var(--mut);font-size:13.5px;margin-top:2px}
.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}
.p-shopee{background:var(--shl);color:var(--sh)} .p-lazada{background:var(--lzl);color:var(--lz)} .p-tiki{background:#E6F3FF;color:#0B74E5} .p-other{background:#EEF1F0;color:#4B5753}
.s-quoted{background:#EEF0F2;color:#4B5563} .s-paid{background:#FFF4DE;color:#B26B00} .s-ordered{background:#E0EDFF;color:#2563EB}
.s-arrived{background:#DDF3E8;color:#13774C} .s-received{background:#E7F1ED;color:var(--g)} .s-cancelled{background:#FBE5E2;color:#B03A2E}
.pill.s-arrived:before{content:"";width:7px;height:7px;border-radius:50%;background:#1F9D62}
.nums{display:grid;grid-template-columns:1.25fr 1fr 1fr;margin-top:10px;font-variant-numeric:tabular-nums;font-size:14px;background:#F7F9F8;border-radius:10px;padding:8px 10px}
.nums div{display:flex;flex-direction:column}
.nums div:nth-child(2){text-align:center} .nums div:nth-child(3){text-align:right}
.nums small{color:var(--mut);font-size:11px;font-weight:600;letter-spacing:.4px;text-transform:uppercase}
.nums b{font-weight:700}
.it.off{opacity:.55} .it.off .nums b{text-decoration:line-through}
.view{font-size:12.5px;color:var(--g);font-weight:600;text-decoration:none;margin-left:auto}
.tot{padding:16px 18px}
.tot .r{display:flex;justify-content:space-between;padding:4px 0;font-variant-numeric:tabular-nums}
.tot .r span:first-child{color:#3d4a45}
.tot .r{gap:10px}
.tot .r span:last-child{white-space:nowrap}
.tot .r em{font-style:normal;color:var(--mut);font-size:12.5px}
.grand{display:flex;justify-content:space-between;align-items:baseline;background:var(--gl);border-top:3px solid var(--g);padding:16px 18px;color:var(--g)}
.grand span{font-weight:800;letter-spacing:.5px}
.grand b{font-size:30px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.pay{padding:16px 18px}
.pay .opt{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}
.pay .opt:first-of-type{border-top:0}
.ico{flex:none;width:36px;height:36px;border-radius:10px;background:var(--gl);color:var(--g);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
.pay pre{white-space:pre-wrap;font-family:inherit;font-size:14px;margin-top:4px;color:#2b3632;background:#F7F9F8;border-radius:10px;padding:8px 10px}
.paid{display:flex;gap:10px;align-items:center;background:#DDF3E8;color:#13774C;border-radius:12px;padding:12px 14px;font-weight:700;margin-top:4px}
.note{padding:14px 16px;font-size:14px;color:#3d4a45;background:#FFFBF2;border-left:4px solid #E5A93B}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:16px;padding:15px;border-radius:14px;background:#25D366;color:#fff;font-weight:800;text-decoration:none;font-size:16px;box-shadow:0 6px 16px rgba(37,211,102,.28)}
.btn.sec{background:#fff;color:var(--g);box-shadow:none;border:1.5px solid var(--line);margin-top:10px;font-weight:700}
.paged.js .it{display:none}
.paged.js .it.show{display:block}
.paged.js .it.show{border-top:1px solid var(--line)}
.paged.js .it.show.pfirst{border-top:0}
.pager{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;flex-wrap:wrap}
.pg-nums{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.pager button{font:inherit;cursor:pointer;border:1.5px solid var(--g);background:#fff;color:var(--g);font-weight:800;border-radius:12px;min-width:44px;height:44px;padding:0 14px;font-size:15px}
.pager .pg-num.on{background:var(--g);color:#fff;box-shadow:0 4px 12px rgba(46,94,78,.3)}
.pager .pg-nav{background:var(--g);color:#fff}
.pager button:disabled{opacity:.35;cursor:default;background:#fff;color:var(--g)}
.pg-info{text-align:center;color:var(--mut);font-size:13px;margin-top:8px}
.foot{text-align:center;color:var(--mut);font-size:12px;margin-top:22px}
@media (min-width:600px){.top{padding-top:30px}.cust{font-size:28px}}
`;

export function renderPublicQuote({ order, items, settings, url, returns = [] }) {
  const shop = settings.shop || {};
  const active = items.filter((i) => !['cancelled', 'returned'].includes(i.status));
  const counted = items.filter((i) => i.status !== 'cancelled');
  const refunded = returns.reduce((a, r) => a + r.refund_amount, 0);
  let stage = active.length ? Math.min(...active.map((i) => Math.max(0, STAGES.indexOf(i.status)))) : 0;
  if (stage === 0 && order.payment_status !== 'unpaid') stage = 1;
  const arrived = active.filter((i) => ['arrived', 'received'].includes(i.status)).length;
  const picked = active.filter((i) => i.status === 'received').length;

  let summary = 'Please review your quote below. We will order once payment is received.';
  if (order.payment_status !== 'unpaid') summary = 'Payment received — thank you! We are ordering your items.';
  if (stage >= 2) summary = 'Your items have been ordered. We will message you when they arrive.';
  if (arrived > 0 && arrived < active.length) summary = `${arrived} of ${active.length} items have arrived at the cafe.`;
  if (active.length && arrived === active.length) summary = 'All items are ready for pickup at the cafe!';
  if (active.length && picked === active.length) summary = 'All items picked up. Thank you for shopping with us!';

  const steps = STAGE_LABEL.map((l, i) => `<div class="st ${i <= stage ? 'on' : ''} ${i === stage ? 'cur' : ''}"><i></i>${l}</div>`).join('');

  const rows = items.map((it, idx) => {
    const st = STATUS[it.status] || STATUS.quoted;
    const off = ['cancelled', 'returned'].includes(it.status);
    const link = safeLink(it.link);
    return `<div class="it ${off ? 'off' : ''}" data-page="${Math.floor(idx / PER_PAGE) + 1}">
      <div class="nm">${idx + 1}. ${esc(it.name || it.name_vi || 'Item')}</div>
      ${it.variation || it.variation2 ? `<div class="vr">${esc([it.variation, it.variation2].filter(Boolean).join(', '))}</div>` : ''}
      <div class="meta"><span class="pill p-${esc(it.platform)}">${esc(PLATFORM[it.platform] || 'Online')}</span>
        <span class="pill" style="background:#F1F4F2;color:#3d4a45">Qty ${it.qty}</span>
        <span class="pill ${st.cls}">${st.label}</span>
        ${link ? `<a class="view" href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow">View product ↗</a>` : ''}</div>
      <div class="nums"><div><small>Price</small><b>${money(it.price)}</b></div><div><small>Ship</small><b>${it.shipping ? money(it.shipping) : 'Free'}</b></div><div><small>Fee</small><b>${money(it.fee)}</b></div></div>
    </div>`;
  }).join('');

  const feeFormula = (() => {
    const fees = counted.map((i) => i.fee);
    if (!fees.length) return '';
    const groups = {};
    for (const f of fees) groups[f] = (groups[f] || 0) + 1;
    const parts = Object.entries(groups).sort((a, b) => b[0] - a[0]).map(([f, n]) => (n > 1 ? `${n} × ${money(f)}` : money(f)));
    return parts.length > 1 || fees.length > 1 ? parts.join(' + ') : '';
  })();

  const wa = String(shop.whatsapp || '').replace(/\D/g, '');
  const waText = encodeURIComponent(`Hi! About my quote #${order.code}: ${url}`);
  const paidLabel = { cash: 'cash', wise: 'Wise', bank: 'bank transfer' }[order.payment_status];
  const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(shop.address || 'Linz Coffee 42 An Thuong 2 Da Nang');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#2E5E4E">
<title>Quote ${esc(order.code)} · ${esc(shop.name || 'An Thuong Order')}</title>
<meta property="og:title" content="Your quote ${esc(order.code)} — ${money(order.grand_total)} ₫">
<meta property="og:description" content="${esc(active.length)} item(s) · ${esc(shop.name || 'An Thuong Order')} · ${esc(shop.address || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${BASE_CSS}</style></head><body>
<header class="top"><div class="in"><div class="brand">${esc(shop.name || 'AN THUONG ORDER')}</div><div class="tag">${esc(shop.tagline || '')}</div></div></header>
<main class="wrap">
  <section class="card hero">
    <div class="row"><div><div class="lbl">Customer</div><div class="cust">${esc(order.customer_name)}</div>${maskPhone(order.customer_phone) ? `<div class="qdate" style="text-align:left">WhatsApp ${esc(maskPhone(order.customer_phone))}</div>` : ''}</div>
      <div><div class="lbl" style="text-align:right">Quote</div><div class="qno">#${esc(order.code)}</div><div class="qdate">${esc(fmtDate(order.order_date))}</div></div></div>
    <div class="steps">${steps}</div>
    <div class="sum">${esc(summary)}</div>
  </section>

  <h2 id="items">Items (${items.length})</h2>
  <section class="card ${items.length > PER_PAGE ? 'paged' : ''}" id="item-list">${rows}</section>
  ${items.length > PER_PAGE ? (() => {
    const pages = Math.ceil(items.length / PER_PAGE);
    return `<nav class="pager" id="pager" aria-label="Item pages">
      <button type="button" class="pg-nav" data-go="prev" aria-label="Previous page">‹ Prev</button>
      <span class="pg-nums">${Array.from({ length: pages }, (_, k) => `<button type="button" class="pg-num" data-go="${k + 1}">${k + 1}</button>`).join('')}</span>
      <button type="button" class="pg-nav" data-go="next" aria-label="Next page">Next ›</button>
    </nav>
    <div class="pg-info" id="pg-info"></div>`;
  })() : ''}
  ${order.note ? `<section class="card note">${esc(order.note)}</section>` : ''}

  <section class="card">
    <div class="tot">
      <div class="r"><span>Products (${counted.length} item${counted.length === 1 ? '' : 's'})</span><span>${money(order.products_total)} ₫</span></div>
      <div class="r"><span>Shipping</span><span>${order.shipping_total ? money(order.shipping_total) + ' ₫' : 'Free'}</span></div>
      <div class="r"><span>Service fee ${feeFormula ? `<em>(${esc(feeFormula)})</em>` : ''}</span><span>${money(order.fee_total)} ₫</span></div>
    </div>
    <div class="grand"><span>TOTAL</span><b>${money(order.grand_total)} ₫</b></div>
    ${refunded ? `<div class="tot"><div class="r"><span>Refunded to you (${returns.length} return${returns.length > 1 ? 's' : ''})</span><span>−${money(refunded)} ₫</span></div>
      <div class="r" style="font-weight:700"><span>Net</span><span>${money(order.grand_total - refunded)} ₫</span></div></div>` : ''}
  </section>

  <h2>How to pay</h2>
  <section class="card pay">
    ${paidLabel ? `<div class="paid">✓ Paid by ${esc(paidLabel)}. Thank you!</div>` : ''}
    <div class="opt"><div class="ico">₫</div><div><b>Cash at the cafe</b><div style="color:var(--mut);font-size:14px">${esc(shop.address || '')} · <a href="${esc(mapUrl)}" target="_blank" rel="noopener" style="color:var(--g);font-weight:600">Map ↗</a></div></div></div>
    <div class="opt"><div class="ico">W</div><div style="min-width:0;flex:1"><b>Wise transfer</b>${shop.wise ? `<pre>${esc(shop.wise)}</pre>` : `<div style="color:var(--mut);font-size:14px">Message us on WhatsApp for Wise details.</div>`}<div style="color:var(--mut);font-size:13px;margin-top:6px">Please send us a screenshot after transfer.</div></div></div>
    <div style="color:var(--mut);font-size:13.5px;margin-top:8px">${esc(shop.footer || '')}</div>
  </section>

  ${wa ? `<a class="btn" href="https://wa.me/${wa}?text=${waText}" target="_blank" rel="noopener">Message us on WhatsApp</a>` : ''}
  <a class="btn sec" href="${esc(mapUrl)}" target="_blank" rel="noopener">Find us · ${esc((shop.address || '').split(',')[0] || 'Linz Coffee')}</a>
  <div class="foot">${esc(shop.name || 'An Thuong Order')} · anthuongorder.com</div>
</main>
${items.length > PER_PAGE ? `<script>
(function () {
  var list = document.getElementById('item-list'), pager = document.getElementById('pager'), info = document.getElementById('pg-info');
  var rows = list.querySelectorAll('.it'), per = ${PER_PAGE}, pages = Math.ceil(rows.length / per), cur = 1;
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
    var a = (cur - 1) * per + 1, b = Math.min(rows.length, cur * per);
    info.textContent = 'Showing items ' + a + '–' + b + ' of ' + rows.length + ' · page ' + cur + ' of ' + pages;
    if (scroll) document.getElementById('items').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
<main class="wrap"><section class="card hero"><div class="cust" style="font-size:20px">Quote not found</div>
<p style="color:var(--mut);margin-top:6px">This link may be wrong or the quote was removed. Please message us on WhatsApp.</p></section></main></body></html>`;
}
