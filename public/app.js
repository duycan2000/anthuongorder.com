// An Thuong Order — internal app (vanilla JS SPA)
import { renderQuoteImages, ensureFonts, canvasToBlob } from './quote-image.js';

const CLIENT_VERSION = '0.1.0';
const $app = document.getElementById('app');

// ---------------- utils ----------------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('en-US');
function parseMoney(v) {
  let s = String(v == null ? '' : v).trim().toLowerCase().replace(/\s/g, '');
  if (!s) return 0;
  let mult = 1;
  if (s.endsWith('tr')) { mult = 1e6; s = s.slice(0, -2); } else if (s.endsWith('k')) { mult = 1e3; s = s.slice(0, -1); }
  if (mult > 1) { s = s.replace(',', '.'); const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * mult) : 0; }
  const d = s.replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = (iso) => { const [y, m, d] = String(iso || '').split('-'); return y ? `${d}/${m}/${y}` : ''; };
const daysSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const waDigits = (phone) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = '84' + d.slice(1);
  return d;
};

const STATUS = {
  quoted: 'Đã báo giá', paid: 'Đã thanh toán', ordered: 'Đã đặt hàng', arrived: 'Hàng về quán',
  received: 'Khách đã lấy', cancelled: 'Hủy', returned: 'Trả hàng',
};
const PAYMENT = { unpaid: 'Chưa trả', cash: 'Tiền mặt', wise: 'Wise', bank: 'Chuyển khoản' };
const PLATFORMS = { shopee: 'Shopee', lazada: 'Lazada', tiki: 'Tiki', other: 'Khác' };
const PERM_LABEL = { quotes: 'Tạo/sửa báo giá', orders: 'Đơn hàng & tra cứu hàng về', settings: 'Cài đặt phí', users: 'Quản lý user (admin)' };

const I = {
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>',
  dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
};

function toast(msg, type = '', ms = 3200) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (res.status === 401 && path !== '/login') {
    state.me = null;
    location.hash = '#/login';
    throw new Error((data && data.error) || 'Chưa đăng nhập');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Lỗi ' + res.status);
  return data;
}

// ---------------- state & routing ----------------
const state = { me: null, settings: null, serverVersion: null, waitingCount: 0 };
const can = (p) => state.me && state.me.perms.includes(p);

function platformFromLink(link) {
  const s = String(link || '').toLowerCase();
  if (/shopee\.|shp\.ee/.test(s)) return 'shopee';
  if (/lazada\.|lzd\.co/.test(s)) return 'lazada';
  if (/tiki\.vn/.test(s)) return 'tiki';
  if (/^https?:\/\//.test(s)) return 'other';
  return null;
}
function nameFromLink(link) {
  try {
    const u = new URL(link);
    let slug = '';
    if (/shopee\./.test(u.hostname)) {
      const m = u.pathname.match(/^\/([^/]+)-i\.\d+\.\d+/);
      if (m) slug = m[1];
    } else if (/lazada\./.test(u.hostname)) {
      const m = u.pathname.match(/\/products\/(?:pdp-)?(.+?)-i\d+/);
      if (m) slug = m[1];
    } else if (/tiki\.vn/.test(u.hostname)) {
      const m = u.pathname.match(/^\/(.+?)-p\d+/);
      if (m) slug = m[1];
    }
    if (!slug) return '';
    slug = decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  } catch (_) { return ''; }
}

const routes = [
  [/^#\/login$/, viewLogin, null],
  [/^#\/quote\/new$/, () => viewQuote(null), 'quotes'],
  [/^#\/quote\/(\d+)$/, (m) => viewQuote(+m[1]), null],
  [/^#\/orders$/, viewOrders, null],
  [/^#\/lookup$/, viewLookup, 'orders'],
  [/^#\/settings$/, viewSettings, 'settings'],
  [/^#\/users$/, viewUsers, 'users'],
  [/^#\/account$/, viewAccount, null],
];

let leaveGuard = null;
async function router() {
  let hash = location.hash || '';
  if (!state.me && hash !== '#/login') {
    try {
      const r = await api('GET', '/me');
      state.me = r.user; state.serverVersion = r.version;
    } catch (_) { location.hash = '#/login'; return; }
  }
  if (state.me && (!hash || hash === '#/' || hash === '#/login')) {
    hash = can('quotes') ? '#/quote/new' : can('orders') ? '#/lookup' : '#/orders';
    history.replaceState(null, '', hash);
  }
  if (state.me && !state.settings) {
    try { state.settings = await api('GET', '/settings'); } catch (_) {}
  }
  for (const [re, fn, perm] of routes) {
    const m = hash.match(re);
    if (m) {
      if (perm && !can(perm)) { shell('<div class="empty">Bạn không có quyền xem trang này.</div>'); return; }
      leaveGuard = null;
      await fn(m);
      return;
    }
  }
  location.hash = state.me ? '#/quote/new' : '#/login';
}
window.addEventListener('hashchange', (e) => {
  if (leaveGuard && leaveGuard() && !confirm('Báo giá chưa lưu. Rời trang?')) {
    history.replaceState(null, '', e.oldURL.slice(e.oldURL.indexOf('#')));
    return;
  }
  router();
});
window.addEventListener('beforeunload', (e) => { if (leaveGuard && leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });

// ---------------- shell ----------------
function navItems() {
  const items = [];
  if (can('quotes')) items.push(['#/quote/new', 'Tạo báo giá', I.quote, 'Báo giá']);
  if (can('orders')) items.push(['#/lookup', 'Tra cứu hàng về', I.box, 'Hàng về', state.waitingCount]);
  if (can('orders') || can('quotes')) items.push(['#/orders', 'Đơn hàng', I.list, 'Đơn']);
  if (can('settings')) items.push(['#/settings', 'Cài đặt', I.gear, 'Cài đặt']);
  if (can('users')) items.push(['#/users', 'User & quyền', I.users, 'User']);
  return items;
}
function shell(content) {
  const hash = location.hash;
  const active = (h) => (hash === h || (h === '#/quote/new' && hash.startsWith('#/quote/')) ? 'on' : '');
  const nav = navItems();
  const banner = state.me && !state.me.pw_changed
    ? `<div class="banner">Bạn đang dùng mật khẩu mặc định / do admin đặt. <a href="#/account">Đổi mật khẩu ngay</a> để bảo vệ dữ liệu.</div>` : '';
  $app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand">An Thuong Order<small>Linz Coffee · nội bộ</small></div>
      <nav>${nav.map(([h, l, ic, , b]) => `<a href="${h}" class="${active(h)}">${ic}<span>${l}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`).join('')}</nav>
      <div class="me"><b>${esc(state.me.display_name)}</b><span class="muted" style="color:#A9C9BC">@${esc(state.me.username)} · ${state.me.role === 'admin' ? 'Admin' : 'Nhân viên'}</span>
        <div style="margin-top:6px"><a href="#/account">Tài khoản</a><a href="#" data-logout>Đăng xuất</a></div>
        <div class="ver">Phiên bản ${esc(state.serverVersion || CLIENT_VERSION)}</div></div>
    </aside>
    <main class="main">${banner}<div id="view">${content}</div></main>
    <nav class="bnav">${nav.slice(0, 4).map(([h, , ic, s, b]) => `<a href="${h}" class="${active(h)}">${ic}<span>${s}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`).join('')}
      <a href="#/account" class="${active('#/account')}">${I.users}<span>Tôi</span></a></nav>
  </div>`;
  $app.querySelectorAll('[data-logout]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    await api('POST', '/logout').catch(() => {});
    state.me = null; state.settings = null;
    location.hash = '#/login';
  }));
  return document.getElementById('view');
}
async function refreshWaiting() {
  if (!can('orders')) return;
  try {
    const r = await api('GET', '/items?status=waiting');
    state.waitingCount = r.items.length;
    document.querySelectorAll('a[href="#/lookup"]').forEach((a) => {
      let b = a.querySelector('.badge');
      if (!state.waitingCount) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'badge'; a.appendChild(b); }
      b.textContent = state.waitingCount;
    });
  } catch (_) {}
}

// ---------------- login ----------------
async function viewLogin() {
  if (!state.serverVersion) {
    try { state.serverVersion = (await (await fetch('/api/version')).json()).version; } catch (_) {}
  }
  $app.innerHTML = `
  <div class="login"><form class="box" autocomplete="on">
    <div class="logo">AT</div>
    <h1>An Thuong Order</h1>
    <p class="sub">Đăng nhập app quản lý báo giá &amp; đơn hàng</p>
    <div class="err hidden"></div>
    <div class="field"><label class="l" for="u">Tên đăng nhập</label><input class="in" id="u" name="username" autocomplete="username" required autofocus></div>
    <div class="field"><label class="l" for="p">Mật khẩu</label><input class="in" id="p" name="password" type="password" autocomplete="current-password" required></div>
    <button class="btn p" type="submit">Đăng nhập</button>
    <div class="ver"><span>© An Thuong Order @ Linz Coffee</span><span>Phiên bản <b>v${esc(state.serverVersion || CLIENT_VERSION)}</b></span></div>
  </form></div>`;
  const form = $app.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.err');
    const btn = form.querySelector('button');
    btn.disabled = true; err.classList.add('hidden');
    try {
      const r = await api('POST', '/login', { username: form.username.value, password: form.password.value });
      state.me = r.user; state.serverVersion = r.version; state.settings = null;
      location.hash = '#/';
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove('hidden');
    } finally { btn.disabled = false; }
  });
}

// ---------------- quote editor ----------------
function newItem(platform = 'shopee') {
  const f = (state.settings && state.settings.fees[platform]) || { ship: 0 };
  return { id: null, link: '', platform, name: '', name_vi: '', variation: '', qty: 1, unit_price: 0, shipping: f.ship || 0, fee: 0, fee_manual: 0, status: null, platform_order_id: '', cost: null };
}
function recalcFees(q) {
  const fees = state.settings ? state.settings.fees : { shopee: { first: 25000, add: 15000 }, lazada: { first: 35000, add: 15000 }, tiki: { first: 35000, add: 15000 }, other: { first: 35000, add: 15000 } };
  let k = 0;
  for (const it of q.items) {
    if (['cancelled', 'returned'].includes(it.status)) continue;
    if (!it.fee_manual) { const r = fees[it.platform] || fees.other; it.fee = k === 0 ? r.first : r.add; }
    k++;
  }
}
function totalsOf(q) {
  const act = q.items.filter((i) => !['cancelled', 'returned'].includes(i.status));
  const p = act.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const s = act.reduce((t, i) => t + i.shipping, 0);
  const f = act.reduce((t, i) => t + i.fee, 0);
  return { p, s, f, g: p + s + f, n: act.length };
}
function feeFormulaText(q) {
  const act = q.items.filter((i) => !['cancelled', 'returned'].includes(i.status));
  if (act.length < 2) return '';
  const first = act[0].fee;
  const rest = new Map();
  act.slice(1).forEach((i) => rest.set(i.fee, (rest.get(i.fee) || 0) + 1));
  return [money(first), ...[...rest].map(([f, n]) => (n > 1 ? `${n} × ${money(f)}` : money(f)))].join(' + ');
}
function publicUrl(q) {
  const base = (state.settings && state.settings.shop.public_base) || location.origin;
  return q.public_id ? base.replace(/\/+$/, '') + '/q/' + q.public_id : '';
}
function waMessage(q) {
  const t = totalsOf(q);
  const link = publicUrl(q);
  return `Hi ${q.customer_name}! Here is your quote #${q.code}.\nTotal: ${money(t.g)} ₫ (${t.n} item${t.n === 1 ? '' : 's'})${link ? `\nDetails: ${link}` : ''}\n\nYou can pay cash at Linz Coffee or via Wise. We'll order right after payment.`;
}

async function viewQuote(id) {
  const view = shell('<div class="empty">Đang tải…</div>');
  let q;
  if (id) {
    try {
      const r = await api('GET', '/orders/' + id);
      q = { ...r.order, items: r.items.map((i) => ({ ...i })) };
    } catch (ex) { view.innerHTML = `<div class="empty">${esc(ex.message)}</div>`; return; }
  } else {
    q = { id: null, code: '', public_id: '', order_date: todayISO(), customer_id: null, customer_name: '', customer_phone: '', payment_status: 'unpaid', note: '', items: [newItem()] };
  }
  let dirty = false;
  leaveGuard = () => dirty && (q.items.some((i) => i.name || i.link || i.unit_price) || q.customer_name);
  const editable = can('quotes');
  const isExisting = () => !!q.id;
  recalcFees(q);

  view.innerHTML = `
  <div class="page-h"><h1>${id ? 'Báo giá' : 'Báo giá mới'} <small id="qcode">${q.code ? '#' + esc(q.code) : ''}</small></h1>
    <div class="muted">${id ? `Tạo ${fmtDate(q.order_date)}` : 'Ngày: <b style="color:var(--ink)">hôm nay</b>'}</div></div>
  <div class="qe">
    <div>
      <div class="card">
        <div class="cust-grid">
          <div class="ac"><label class="l">Tên khách</label><input class="in" id="c-name" placeholder="Gõ tên để tìm khách cũ…" autocomplete="off" value="${esc(q.customer_name)}"><div class="ac-list hidden"></div></div>
          <div><label class="l">WhatsApp / Phone</label><input class="in" id="c-phone" placeholder="+1 262 277 9077" value="${esc(q.customer_phone)}"></div>
          <div><label class="l">Ngày báo giá</label><input class="in" id="c-date" type="date" value="${esc(q.order_date)}"></div>
          <div><label class="l">Thanh toán</label><select class="in" id="c-pay">${Object.entries(PAYMENT).map(([k, v]) => `<option value="${k}" ${q.payment_status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="items-h"><div>#</div><div>Tên tiếng Anh (in trên ảnh)</div><div>Phân loại</div><div class="num">SL</div><div class="num">Đơn giá</div><div class="num">Ship</div><div class="num">Phí DV</div><div class="num">Cộng</div></div>
        <div id="rows"></div>
        <div class="items-f"><button class="btn" id="add">${I.quote} Thêm món <span class="kbd">Ctrl+Enter</span></button>
          <span class="muted" id="next-fee"></span></div>
      </div>
      <div class="qe-bottom">
        <div class="card pad"><label class="l">Ghi chú cho khách (in trên ảnh &amp; trang báo giá)</label><textarea class="in" id="c-note" placeholder="VD: Price increased from 2,158,200 ₫ to 2,320,000 ₫">${esc(q.note || '')}</textarea></div>
        <div class="totals" id="totals"></div>
      </div>
      <div class="actions" id="actions"></div>
      <div id="share"></div>
    </div>
    <div class="preview"><div class="pg-h"><span>XEM TRƯỚC ẢNH GỬI KHÁCH</span><span id="pg-count"></span></div><div class="pages" id="pages"></div></div>
  </div>`;

  const $rows = view.querySelector('#rows');
  const $totals = view.querySelector('#totals');

  function rowHtml(it, i) {
    const total = it.qty * it.unit_price + it.shipping + it.fee;
    const off = ['cancelled', 'returned'].includes(it.status);
    return `<div class="row-it" data-i="${i}" style="${off ? 'opacity:.55' : ''}">
      <div class="r1">
        <div class="idx">${i + 1}</div>
        <div class="lnk"><input class="in" data-f="link" placeholder="Dán link Shopee / Lazada…" value="${esc(it.link)}"></div>
        <div class="vi" style="display:flex;gap:6px;min-width:0"><input class="in" data-f="name_vi" placeholder="Tên gốc tiếng Việt (tự lấy từ link nếu có)" value="${esc(it.name_vi)}">
          <button class="btn sm" type="button" data-act="translate" title="Mở Google Dịch">Dịch ↗</button></div>
        <select class="in" data-f="platform">${Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}" ${it.platform === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="acts">${it.link ? `<a class="ic" href="${esc(it.link)}" target="_blank" rel="noopener" title="Mở link">${I.ext}</a>` : ''}
          <button class="ic" type="button" data-act="dup" title="Nhân đôi (Ctrl+D)">${I.dup}</button>
          <button class="ic" type="button" data-act="del" title="Xoá món">${I.trash}</button></div>
      </div>
      <div class="r2">
        <div class="idx"></div>
        <div class="c-name" data-lbl="Tên tiếng Anh"><input class="in" data-f="name" placeholder="Product name in English" value="${esc(it.name)}"></div>
        <div class="c-var" data-lbl="Phân loại"><input class="in" data-f="variation" placeholder="Màu, size…" value="${esc(it.variation)}"></div>
        <div data-lbl="SL"><input class="in money" data-f="qty" inputmode="numeric" value="${it.qty}"></div>
        <div data-lbl="Đơn giá"><input class="in money" data-f="unit_price" inputmode="numeric" placeholder="0" value="${it.unit_price ? money(it.unit_price) : ''}"></div>
        <div data-lbl="Ship"><input class="in money" data-f="shipping" inputmode="numeric" value="${money(it.shipping)}"></div>
        <div data-lbl="Phí DV" class="fee-wrap"><input class="in money ${it.fee_manual ? '' : 'auto'}" data-f="fee" inputmode="numeric" value="${money(it.fee)}" title="${it.fee_manual ? 'Phí sửa tay' : 'Phí tự tính'}">${it.fee_manual ? '<button class="reset" type="button" data-act="fee-auto" title="Về phí tự động">↺</button>' : ''}</div>
        <div class="tot c-tot" data-tot>${money(total)}</div>
      </div>
      ${isExisting() ? `<div class="r3">
        <div class="idx"></div>
        <div data-lbl="Trạng thái"><select class="in" data-f="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${it.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div data-lbl="Mã đơn Shopee/Lazada"><input class="in" data-f="platform_order_id" placeholder="Mã đơn sàn (dán khi đặt hàng)" value="${esc(it.platform_order_id || '')}"></div>
        <div data-lbl="Giá thực mua"><input class="in money" data-f="cost" inputmode="numeric" placeholder="Giá thực mua" value="${it.cost != null ? money(it.cost) : ''}"></div>
        <div data-lbl="Kệ / túi"><input class="in" data-f="shelf" placeholder="Kệ (VD: B3)" value="${esc(it.shelf || '')}"></div>
      </div>` : ''}
    </div>`;
  }
  function renderRows(focusIdx, focusField) {
    $rows.innerHTML = q.items.map(rowHtml).join('');
    if (focusIdx != null) {
      const el = $rows.querySelector(`.row-it[data-i="${focusIdx}"] [data-f="${focusField || 'link'}"]`);
      if (el) el.focus();
    }
    updateComputed();
  }
  function updateComputed() {
    recalcFees(q);
    q.items.forEach((it, i) => {
      const row = $rows.querySelector(`.row-it[data-i="${i}"]`);
      if (!row) return;
      const feeIn = row.querySelector('[data-f="fee"]');
      if (feeIn && document.activeElement !== feeIn) feeIn.value = money(it.fee);
      row.querySelector('[data-tot]').textContent = money(it.qty * it.unit_price + it.shipping + it.fee);
    });
    const t = totalsOf(q);
    const formula = feeFormulaText(q);
    $totals.innerHTML = `
      <div class="r"><span>Tiền hàng (${t.n} món)</span><span>${money(t.p)} ₫</span></div>
      <div class="r"><span>Ship</span><span>${money(t.s)} ₫</span></div>
      <div class="r"><span>Phí dịch vụ ${formula ? `<em>(${formula})</em>` : ''}</span><span>${money(t.f)} ₫</span></div>
      <div class="r g"><span>TỔNG</span><span>${money(t.g)} ₫</span></div>`;
    const fees = state.settings ? state.settings.fees : null;
    const nf = view.querySelector('#next-fee');
    if (fees) nf.innerHTML = `Món tiếp theo: phí <b>${money(t.n === 0 ? fees.shopee.first : fees.shopee.add)}</b> (Shopee)`;
    schedulePreview();
  }

  // preview
  let canvases = [];
  const doPreview = async () => {
    await ensureFonts();
    const shop = state.settings ? state.settings.shop : {};
    canvases = renderQuoteImages({
      shop,
      order: { code: q.code, order_date: q.order_date, customer_name: q.customer_name, customer_phone: q.customer_phone, note: q.note },
      items: q.items.map((i) => ({ ...i, price: i.qty * i.unit_price })),
    });
    const pages = view.querySelector('#pages');
    pages.innerHTML = '';
    canvases.forEach((cv, i) => {
      const wrap = document.createElement('div');
      if (canvases.length > 1) wrap.innerHTML = `<div class="pg-h"><span>Ảnh ${i + 1}/${canvases.length}</span>
        <span><button class="btn sm" data-copy="${i}">${I.copy} Copy</button> <button class="btn sm" data-dl="${i}">${I.dl}</button></span></div>`;
      wrap.appendChild(cv);
      pages.appendChild(wrap);
    });
    view.querySelector('#pg-count').textContent = canvases.length > 1 ? `${canvases.length} ảnh` : '';
  };
  const schedulePreview = debounce(doPreview, 200);

  // ---- events: header fields ----
  const $name = view.querySelector('#c-name');
  const $phone = view.querySelector('#c-phone');
  const $ac = view.querySelector('.ac-list');
  let acItems = [], acIdx = -1;
  const searchCust = debounce(async () => {
    const term = $name.value.trim();
    if (!editable || term.length < 1) { $ac.classList.add('hidden'); return; }
    try {
      const r = await api('GET', '/customers?q=' + encodeURIComponent(term));
      acItems = r.customers;
      acIdx = acItems.length ? 0 : -1;
      if (!acItems.length) { $ac.classList.add('hidden'); return; }
      $ac.innerHTML = acItems.map((c, i) => `<div data-ac="${i}" class="${i === acIdx ? 'on' : ''}"><span><b>${esc(c.name)}</b> <small>${esc(c.phone || '')}</small></span><small>${c.orders} đơn</small></div>`).join('');
      $ac.classList.remove('hidden');
    } catch (_) {}
  }, 180);
  function pickCustomer(c) {
    q.customer_id = c.id; q.customer_name = c.name; q.customer_phone = c.phone || '';
    $name.value = c.name; $phone.value = c.phone || '';
    $ac.classList.add('hidden'); dirty = true; schedulePreview();
    const first = $rows.querySelector('[data-f="link"]');
    if (first && !first.value) first.focus(); else $phone.focus();
  }
  $name.addEventListener('input', () => { q.customer_name = $name.value; q.customer_id = null; dirty = true; searchCust(); schedulePreview(); });
  $name.addEventListener('keydown', (e) => {
    if ($ac.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      acIdx = (acIdx + (e.key === 'ArrowDown' ? 1 : -1) + acItems.length) % acItems.length;
      $ac.querySelectorAll('[data-ac]').forEach((d, i) => d.classList.toggle('on', i === acIdx));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && acIdx >= 0) {
      e.preventDefault(); pickCustomer(acItems[acIdx]);
    } else if (e.key === 'Escape') $ac.classList.add('hidden');
  });
  $name.addEventListener('blur', () => setTimeout(() => $ac.classList.add('hidden'), 150));
  $ac.addEventListener('mousedown', (e) => { const d = e.target.closest('[data-ac]'); if (d) { e.preventDefault(); pickCustomer(acItems[+d.dataset.ac]); } });
  $phone.addEventListener('input', () => { q.customer_phone = $phone.value; dirty = true; schedulePreview(); });
  view.querySelector('#c-date').addEventListener('change', (e) => { q.order_date = e.target.value || todayISO(); dirty = true; schedulePreview(); });
  view.querySelector('#c-pay').addEventListener('change', (e) => { q.payment_status = e.target.value; dirty = true; });
  view.querySelector('#c-note').addEventListener('input', (e) => { q.note = e.target.value; dirty = true; schedulePreview(); });

  // ---- events: item rows ----
  $rows.addEventListener('input', (e) => {
    const f = e.target.dataset.f; if (!f) return;
    const i = +e.target.closest('.row-it').dataset.i;
    const it = q.items[i];
    dirty = true;
    if (f === 'link') {
      it.link = e.target.value.trim();
      const p = platformFromLink(it.link);
      const row = e.target.closest('.row-it');
      if (p && p !== it.platform) {
        it.platform = p;
        row.querySelector('[data-f="platform"]').value = p;
        const def = state.settings && state.settings.fees[p];
        if (def && !it.shipping) { it.shipping = def.ship || 0; row.querySelector('[data-f="shipping"]').value = money(it.shipping); }
      }
      const guess = nameFromLink(it.link);
      if (guess && !it.name_vi) { it.name_vi = guess; row.querySelector('[data-f="name_vi"]').value = guess; }
    } else if (['qty', 'unit_price', 'shipping', 'fee', 'cost'].includes(f)) {
      const v = f === 'qty' ? Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1) : parseMoney(e.target.value);
      if (f === 'cost') it.cost = e.target.value.trim() === '' ? null : v; else it[f] = v;
      if (f === 'fee') {
        if (!it.fee_manual) { it.fee_manual = 1; e.target.classList.remove('auto'); }
      }
    } else it[f] = e.target.value;
    updateComputed();
  });
  $rows.addEventListener('change', (e) => {
    const f = e.target.dataset.f; if (!f) return;
    const i = +e.target.closest('.row-it').dataset.i;
    const it = q.items[i];
    if (f === 'platform') {
      it.platform = e.target.value;
      dirty = true;
      updateComputed();
    } else if (f === 'status') {
      it.status = e.target.value; dirty = true; renderRows();
    } else if (f === 'fee') {
      // show reset button after manual edit
      renderRows();
    }
  });
  $rows.addEventListener('focusout', (e) => {
    const f = e.target.dataset && e.target.dataset.f;
    if (['unit_price', 'shipping', 'fee', 'cost'].includes(f)) {
      const it = q.items[+e.target.closest('.row-it').dataset.i];
      if (f === 'cost') e.target.value = it.cost != null ? money(it.cost) : '';
      else e.target.value = it[f] || f !== 'unit_price' ? money(it[f]) : '';
    }
  });
  $rows.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = +b.closest('.row-it').dataset.i;
    const act = b.dataset.act;
    if (act === 'del') {
      if (q.items.length === 1) { q.items = [newItem()]; } else q.items.splice(i, 1);
      dirty = true; renderRows();
    } else if (act === 'dup') {
      const c = { ...q.items[i], id: null, status: null, platform_order_id: '', cost: null, shelf: '', variation: '' };
      q.items.splice(i + 1, 0, c); dirty = true; renderRows(i + 1, 'variation');
    } else if (act === 'fee-auto') {
      q.items[i].fee_manual = 0; dirty = true; renderRows();
    } else if (act === 'translate') {
      const it = q.items[i];
      const text = it.name_vi || it.name;
      if (!text) { toast('Nhập tên tiếng Việt trước'); return; }
      window.open('https://translate.google.com/?sl=vi&tl=en&op=translate&text=' + encodeURIComponent(text), '_blank', 'noopener');
    }
  });
  function addItem() {
    const last = q.items[q.items.length - 1];
    q.items.push(newItem(last ? last.platform : 'shopee'));
    dirty = true; renderRows(q.items.length - 1, 'link');
  }
  view.querySelector('#add').addEventListener('click', addItem);

  // ---- save / share ----
  function payload() {
    return {
      customer_id: q.customer_id, customer_name: q.customer_name.trim(), customer_phone: q.customer_phone.trim(), order_date: q.order_date,
      payment_status: q.payment_status, note: q.note,
      items: q.items.map((it) => ({ ...it, unit_price: it.unit_price, qty: it.qty })),
    };
  }
  let saving = null;
  async function save(silent) {
    if (!editable) return q;
    if (saving) return saving;
    if (!q.customer_name.trim()) { toast('Nhập tên khách', 'err'); $name.focus(); throw new Error('no name'); }
    saving = (async () => {
      const r = q.id ? await api('PUT', '/orders/' + q.id, payload()) : await api('POST', '/orders', payload());
      const wasNew = !q.id;
      q = { ...r.order, items: r.items.map((i) => ({ ...i })) };
      dirty = false;
      if (wasNew) history.replaceState(null, '', '#/quote/' + q.id);
      view.querySelector('#qcode').textContent = '#' + q.code;
      renderRows();
      renderActions();
      await doPreview();
      if (!silent) toast(`Đã lưu báo giá <b>#${esc(q.code)}</b>`, 'ok');
      refreshWaiting();
      return q;
    })();
    try { return await saving; } finally { saving = null; }
  }
  async function copyImage(idx = 0, then) {
    // ClipboardItem with a promise keeps the user-gesture permission while we save
    const blobP = (async () => { if (dirty || !q.id) await save(true); else await doPreview(); return canvasToBlob(canvases[idx]); })();
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('clipboard');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
      toast(canvases.length > 1 ? `Đã copy ảnh ${idx + 1}/${canvases.length}. Dán vào WhatsApp bằng Ctrl+V` : 'Đã copy ảnh. Dán vào WhatsApp bằng Ctrl+V', 'ok');
      if (then) then();
    } catch (_) {
      await blobP.catch(() => {});
      downloadImage(idx);
      toast('Trình duyệt không cho copy ảnh — đã tải ảnh xuống');
    }
  }
  function downloadImage(idx = 0) {
    const cv = canvases[idx]; if (!cv) return;
    const a = document.createElement('a');
    a.download = `${q.code || 'quote'}${canvases.length > 1 ? `-${idx + 1}` : ''}.png`;
    a.href = cv.toDataURL('image/png'); a.click();
  }
  async function shareNative() {
    if (dirty || !q.id) await save(true);
    const files = await Promise.all(canvases.map(async (cv, i) => new File([await canvasToBlob(cv)], `${q.code}${canvases.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' })));
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, text: waMessage(q) }); } catch (_) {}
    } else { canvases.forEach((_, i) => downloadImage(i)); }
  }
  function openWhatsApp(win) {
    const d = waDigits(q.customer_phone);
    const url = (d ? `https://wa.me/${d}` : 'https://wa.me/') + '?text=' + encodeURIComponent(waMessage(q));
    if (win) win.location.href = url; else window.open(url, '_blank', 'noopener');
  }
  function renderActions() {
    const el = view.querySelector('#actions');
    const mobile = matchMedia('(max-width:960px)').matches;
    el.innerHTML = editable ? `
      <button class="btn" id="b-save">Lưu <span class="kbd">Ctrl+S</span></button>
      <button class="btn" id="b-dl">${I.dl} Tải ảnh</button>
      ${mobile && navigator.share ? `<button class="btn wa" id="b-share">${I.share} Chia sẻ ảnh</button>` : `<button class="btn p" id="b-copy">${I.copy} Copy ảnh</button>
      <button class="btn wa" id="b-wa">${I.wa} Copy ảnh + WhatsApp</button>`}` : '';
    const share = view.querySelector('#share');
    if (q.public_id) {
      const url = publicUrl(q);
      share.innerHTML = `<div class="share-box"><b>Link báo giá cho khách</b> <span class="muted">· khách mở trên điện thoại, tự cập nhật khi hàng về</span>
        <div class="link"><input class="in" readonly value="${esc(url)}" id="pub-url"><button class="btn" id="b-cplink">${I.copy} Copy</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${I.ext} Mở</a></div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="b-cpmsg">Copy tin nhắn kèm link</button><button class="btn sm wa" id="b-walink">${I.wa} Gửi link qua WhatsApp</button>
        ${can('users') ? '<button class="btn sm danger ghost" id="b-del" style="margin-left:auto">Xoá đơn</button>' : ''}</div></div>`;
      share.querySelector('#b-cplink').onclick = async () => { await navigator.clipboard.writeText(url).catch(() => {}); toast('Đã copy link', 'ok'); };
      share.querySelector('#b-cpmsg').onclick = async () => { await navigator.clipboard.writeText(waMessage(q)).catch(() => {}); toast('Đã copy tin nhắn', 'ok'); };
      share.querySelector('#b-walink').onclick = async () => { if (dirty) await save(true); openWhatsApp(); };
      const del = share.querySelector('#b-del');
      if (del) del.onclick = async () => {
        if (!confirm(`Xoá đơn #${q.code}? Không thể hoàn tác.`)) return;
        await api('DELETE', '/orders/' + q.id); dirty = false; toast('Đã xoá đơn'); location.hash = '#/orders';
      };
    } else share.innerHTML = '';
    if (!editable) return;
    el.querySelector('#b-save').onclick = () => save().catch(() => {});
    el.querySelector('#b-dl').onclick = async () => { if (dirty || !q.id) await save(true); canvases.forEach((_, i) => downloadImage(i)); };
    const bc = el.querySelector('#b-copy'); if (bc) bc.onclick = () => copyImage(0);
    const bw = el.querySelector('#b-wa');
    if (bw) bw.onclick = () => {
      const win = window.open('about:blank', '_blank');
      copyImage(0, () => openWhatsApp(win)).catch(() => { if (win) win.close(); });
    };
    const bs = el.querySelector('#b-share'); if (bs) bs.onclick = () => shareNative().catch((e) => toast(e.message, 'err'));
  }
  view.querySelector('#pages').addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]'); if (c) copyImage(+c.dataset.copy);
    const d = e.target.closest('[data-dl]'); if (d) downloadImage(+d.dataset.dl);
  });

  // shortcuts
  const onKey = (e) => {
    if (!document.body.contains(view)) { document.removeEventListener('keydown', onKey); return; }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save().catch(() => {}); }
    else if (mod && e.key === 'Enter') { e.preventDefault(); addItem(); }
    else if (mod && e.key.toLowerCase() === 'd') {
      const row = document.activeElement && document.activeElement.closest && document.activeElement.closest('.row-it');
      if (row) { e.preventDefault(); row.querySelector('[data-act="dup"]').click(); }
    }
  };
  document.addEventListener('keydown', onKey);

  if (!editable) view.querySelectorAll('input,select,textarea,#add').forEach((el) => { el.disabled = true; });
  renderRows();
  renderActions();
  if (!id) $name.focus();
}

// ---------------- orders ----------------
function progressOf(statuses) {
  const list = String(statuses || '').split(',').filter(Boolean);
  const act = list.filter((s) => !['cancelled', 'returned'].includes(s));
  if (!act.length) return list.length ? '<span class="pill s-cancelled">Hủy</span>' : '';
  const order = ['quoted', 'paid', 'ordered', 'arrived', 'received'];
  const min = Math.min(...act.map((s) => order.indexOf(s)));
  const st = order[min];
  const arrived = act.filter((s) => s === 'arrived' || s === 'received').length;
  if (arrived && arrived < act.length) return `<span class="pill s-arrived">Về ${arrived}/${act.length}</span>`;
  return `<span class="pill s-${st}">${STATUS[st]}${act.length > 1 ? ` ${act.length}/${act.length}` : ''}</span>`;
}
async function viewOrders() {
  const view = shell('');
  const month = sessionStorage.getItem('at.month') || todayISO().slice(0, 7);
  view.innerHTML = `
    <div class="page-h"><h1>Đơn hàng</h1>${can('quotes') ? '<a class="btn p" href="#/quote/new">+ Báo giá mới</a>' : ''}</div>
    <div class="toolbar">
      <input class="in" type="month" id="o-month" value="${month}" style="max-width:170px">
      <div class="search">${I.search}<input class="in" id="o-q" placeholder="Tìm khách, mã đơn, tên hàng… (mọi tháng)"></div>
    </div>
    <div class="stats" id="o-stats"></div>
    <div class="card"><div class="tbl-wrap d-table" id="o-table"></div></div>
    <div class="m-cards" id="o-cards"></div>`;
  const load = async () => {
    const m = view.querySelector('#o-month').value;
    const term = view.querySelector('#o-q').value.trim();
    sessionStorage.setItem('at.month', m);
    const r = await api('GET', `/orders?month=${encodeURIComponent(m)}&q=${encodeURIComponent(term)}`);
    const os = r.orders;
    const sum = (k) => os.reduce((s, o) => s + (o[k] || 0), 0);
    view.querySelector('#o-stats').innerHTML = `
      <div class="card stat"><div class="l">Đơn</div><div class="v">${os.length}</div></div>
      <div class="card stat"><div class="l">Tiền hàng</div><div class="v">${money(sum('products_total'))}</div></div>
      <div class="card stat"><div class="l">Phí dịch vụ</div><div class="v" style="color:var(--g)">${money(sum('fee_total'))}</div></div>
      <div class="card stat"><div class="l">Chưa thu tiền</div><div class="v" style="color:var(--warn)">${os.filter((o) => o.payment_status === 'unpaid').length} đơn</div></div>`;
    if (!os.length) {
      view.querySelector('#o-table').innerHTML = '<div class="empty">Chưa có đơn nào.</div>';
      view.querySelector('#o-cards').innerHTML = '<div class="empty card">Chưa có đơn nào.</div>';
      return;
    }
    view.querySelector('#o-table').innerHTML = `<table class="t"><thead><tr><th>Mã · ngày</th><th>Khách</th><th class="num">Món</th><th class="num">Tổng</th><th>Thanh toán</th><th>Tiến độ</th></tr></thead><tbody>
      ${os.map((o) => `<tr class="click" data-id="${o.id}"><td><b>${esc(o.code)}</b><div class="muted">${fmtDate(o.order_date)}</div></td>
        <td><b>${esc(o.customer_name)}</b><div class="muted">${esc(o.customer_phone || '')}</div></td>
        <td class="num">${o.item_count}</td><td class="num"><b>${money(o.grand_total)}</b></td>
        <td><span class="pill pay-${o.payment_status}">${PAYMENT[o.payment_status]}</span></td><td>${progressOf(o.statuses)}</td></tr>`).join('')}
      </tbody></table>`;
    view.querySelector('#o-cards').innerHTML = os.map((o) => `<div class="card mc click" data-id="${o.id}">
      <div class="top"><div><b>${esc(o.customer_name)}</b><div class="muted">${esc(o.code)} · ${fmtDate(o.order_date)} · ${o.item_count} món</div></div><b>${money(o.grand_total)}</b></div>
      <div style="display:flex;gap:6px;margin-top:8px"><span class="pill pay-${o.payment_status}">${PAYMENT[o.payment_status]}</span>${progressOf(o.statuses)}</div></div>`).join('');
  };
  view.addEventListener('click', (e) => { const r = e.target.closest('[data-id]'); if (r) location.hash = '#/quote/' + r.dataset.id; });
  view.querySelector('#o-month').addEventListener('change', load);
  view.querySelector('#o-q').addEventListener('input', debounce(load, 250));
  await load().catch((e) => toast(e.message, 'err'));
}

// ---------------- lookup (hàng về) ----------------
async function viewLookup() {
  const view = shell('');
  let filter = sessionStorage.getItem('at.lf') || 'waiting';
  let items = [], counts = {};
  const sel = new Set();
  view.innerHTML = `
    <div class="page-h"><h1>Tra cứu hàng về</h1><span class="muted">Mỗi dòng là 1 món · tìm trên mọi tháng</span></div>
    <div class="toolbar"><div class="search">${I.search}<input class="in" id="l-q" placeholder="Gõ tên hàng (có dấu/không dấu), mã đơn Shopee, tên hoặc số khách…" autofocus></div></div>
    <div class="chips" id="l-chips" style="margin-bottom:12px"></div>
    <div class="card d-table"><div class="tbl-wrap" id="l-table"></div></div>
    <div class="m-cards" id="l-cards"></div>
    <div id="l-bulk"></div>`;
  const chips = () => {
    const w = (counts.paid || 0) + (counts.ordered || 0);
    const list = [['waiting', 'Đang chờ hàng', w], ['quoted', STATUS.quoted, counts.quoted], ['paid', STATUS.paid, counts.paid], ['ordered', STATUS.ordered, counts.ordered], ['arrived', STATUS.arrived, counts.arrived], ['received', STATUS.received, counts.received], ['cancelled', 'Hủy', counts.cancelled], ['all', 'Tất cả', null]];
    view.querySelector('#l-chips').innerHTML = list.map(([k, l, n]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${l}${n ? `<b>${n}</b>` : ''}</button>`).join('');
  };
  const statusBtns = (cls = 'btn') => ['ordered', 'arrived', 'received'].map((s) => `<button class="${cls}" data-set="${s}">${STATUS[s]}${s === 'arrived' ? ' <span class="kbd">A</span>' : s === 'received' ? ' <span class="kbd">R</span>' : ''}</button>`).join('');
  const render = () => {
    chips();
    if (!items.length) {
      view.querySelector('#l-table').innerHTML = '<div class="empty">Không có món nào.</div>';
      view.querySelector('#l-cards').innerHTML = '<div class="empty card">Không có món nào.</div>';
    } else {
      view.querySelector('#l-table').innerHTML = `<table class="t"><thead><tr><th style="width:34px"><input type="checkbox" class="cb" id="l-all"></th><th>Món hàng</th><th>Khách · đơn</th><th>Mã đơn sàn</th><th>Ngày</th><th>Trạng thái</th><th class="num">Chờ</th></tr></thead><tbody>
        ${items.map((it) => `<tr class="${sel.has(it.id) ? 'sel' : ''}" data-row="${it.id}">
          <td><input type="checkbox" class="cb" data-cb="${it.id}" ${sel.has(it.id) ? 'checked' : ''}></td>
          <td><b>${esc(it.name || it.name_vi || '—')}</b>${it.variation ? ` <span class="muted">· ${esc(it.variation)}</span>` : ''}<div class="muted" style="font-size:12.5px">${it.name_vi && it.name ? esc(it.name_vi) + ' · ' : ''}<span class="pill p-${it.platform}" style="font-size:11px">${PLATFORMS[it.platform]}</span> x${it.qty}${it.shelf ? ` · Kệ <b>${esc(it.shelf)}</b>` : ''}</div></td>
          <td><a href="#/quote/${it.order_id}"><b>${esc(it.customer_name)}</b></a><div class="muted" style="font-size:12.5px">${esc(it.code)} · về ${it.order_arrived}/${it.order_items}</div></td>
          <td><input class="inline-in" data-poi="${it.id}" value="${esc(it.platform_order_id || '')}" placeholder="dán mã…"></td>
          <td class="nowrap">${fmtDate(it.order_date)}</td>
          <td><span class="pill s-${it.status}">${STATUS[it.status]}</span></td>
          <td class="num nowrap">${daysSince(it.status_at)} ngày</td></tr>`).join('')}</tbody></table>`;
      view.querySelector('#l-cards').innerHTML = items.map((it) => `<div class="card mc ${sel.has(it.id) ? 'sel' : ''}">
        <div class="top"><div style="min-width:0"><b>${esc(it.customer_name)}</b> <span class="muted">· ${esc(it.code)}</span></div><span class="pill s-${it.status}">${STATUS[it.status]}</span></div>
        <div style="margin-top:4px">${esc(it.name || it.name_vi || '—')}${it.variation ? ` <span class="muted">· ${esc(it.variation)}</span>` : ''}</div>
        <div class="muted" style="font-size:12.5px">${it.name_vi && it.name ? esc(it.name_vi) + ' · ' : ''}${it.platform_order_id ? esc(it.platform_order_id) + ' · ' : ''}${daysSince(it.status_at)} ngày · ${it.order_arrived}/${it.order_items} món đã về</div>
        <div class="acts"><button class="btn" data-one="${it.id}" data-s="arrived" style="color:var(--vio);border-color:#D9C8FA">Hàng về quán</button><button class="btn" data-one="${it.id}" data-s="received" style="color:var(--ok);border-color:#BFE3CF">Khách đã lấy</button></div></div>`).join('');
    }
    const bulk = view.querySelector('#l-bulk');
    bulk.innerHTML = sel.size ? `<div class="bulk"><b>${sel.size} món đã chọn</b><span style="opacity:.8">→ chuyển sang:</span>${statusBtns()}
      <select class="in" id="l-other" style="max-width:150px"><option value="">Khác…</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <input class="in" id="l-shelf" placeholder="Kệ / túi"><button class="btn" data-clear style="margin-left:auto">Bỏ chọn</button></div>` : '';
  };
  const load = async () => {
    const term = view.querySelector('#l-q').value.trim();
    const r = await api('GET', `/items?status=${filter}&q=${encodeURIComponent(term)}`);
    items = r.items; counts = r.counts;
    for (const id of [...sel]) if (!items.find((i) => i.id === id)) sel.delete(id);
    render();
  };
  async function setStatus(ids, status) {
    const shelfEl = view.querySelector('#l-shelf');
    const shelf = shelfEl && shelfEl.value.trim();
    const affected = items.filter((i) => ids.includes(i.id));
    await api('POST', '/items/status', { ids, status, ...(shelf ? { shelf } : {}) });
    sel.clear();
    await load();
    refreshWaiting();
    if (status === 'arrived') {
      const orders = [...new Map(affected.map((i) => [i.order_id, i])).values()];
      for (const o of orders) {
        const fresh = await api('GET', '/orders/' + o.order_id).catch(() => null);
        if (!fresh) continue;
        const act = fresh.items.filter((i) => !['cancelled', 'returned'].includes(i.status));
        const n = act.filter((i) => ['arrived', 'received'].includes(i.status)).length;
        const base = (state.settings && state.settings.shop.public_base) || location.origin;
        const link = base.replace(/\/+$/, '') + '/q/' + fresh.order.public_id;
        const msg = n === act.length
          ? `Hi ${fresh.order.customer_name}! Good news: all ${act.length} item${act.length > 1 ? 's' : ''} from your order #${fresh.order.code} ${act.length > 1 ? 'have' : 'has'} arrived. You can pick up at Linz Coffee, 42 An Thuong 2. Details: ${link}`
          : `Hi ${fresh.order.customer_name}! ${n} of ${act.length} items from your order #${fresh.order.code} have arrived at Linz Coffee. We'll message you when the rest arrive. Details: ${link}`;
        const url = `https://wa.me/${waDigits(fresh.order.customer_phone)}?text=${encodeURIComponent(msg)}`;
        toast(`<b>${esc(fresh.order.customer_name)}</b>: ${n}/${act.length} món đã về. <a href="${esc(url)}" target="_blank" rel="noopener">Báo khách qua WhatsApp →</a>`, 'ok', 12000);
      }
    } else toast(`Đã chuyển ${ids.length} món sang “${STATUS[status]}”`, 'ok');
  }
  view.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-f]');
    if (chip && chip.classList.contains('chip')) { filter = chip.dataset.f; sessionStorage.setItem('at.lf', filter); sel.clear(); await load(); return; }
    const one = e.target.closest('[data-one]');
    if (one) { await setStatus([+one.dataset.one], one.dataset.s).catch((x) => toast(x.message, 'err')); return; }
    const set = e.target.closest('[data-set]');
    if (set) { await setStatus([...sel], set.dataset.set).catch((x) => toast(x.message, 'err')); return; }
    if (e.target.closest('[data-clear]')) { sel.clear(); render(); return; }
    const row = e.target.closest('tr[data-row]');
    if (row && !e.target.closest('input,a')) {
      const id = +row.dataset.row; sel.has(id) ? sel.delete(id) : sel.add(id); render();
    }
  });
  view.addEventListener('change', async (e) => {
    if (e.target.dataset.cb) { const id = +e.target.dataset.cb; e.target.checked ? sel.add(id) : sel.delete(id); render(); }
    if (e.target.id === 'l-all') { items.forEach((i) => (e.target.checked ? sel.add(i.id) : sel.delete(i.id))); render(); }
    if (e.target.id === 'l-other' && e.target.value) await setStatus([...sel], e.target.value).catch((x) => toast(x.message, 'err'));
    if (e.target.dataset.poi) {
      await api('PUT', '/items/' + e.target.dataset.poi, { platform_order_id: e.target.value }).then(() => toast('Đã lưu mã đơn sàn', 'ok')).catch((x) => toast(x.message, 'err'));
    }
  });
  const onKey = (e) => {
    if (!document.body.contains(view)) { document.removeEventListener('keydown', onKey); return; }
    if (!sel.size || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'a' || e.key === 'A') setStatus([...sel], 'arrived').catch((x) => toast(x.message, 'err'));
    if (e.key === 'r' || e.key === 'R') setStatus([...sel], 'received').catch((x) => toast(x.message, 'err'));
  };
  document.addEventListener('keydown', onKey);
  view.querySelector('#l-q').addEventListener('input', debounce(() => load().catch((x) => toast(x.message, 'err')), 220));
  await load().catch((x) => toast(x.message, 'err'));
}

// ---------------- settings ----------------
async function viewSettings() {
  const view = shell('');
  const s = await api('GET', '/settings');
  state.settings = s;
  const feeRow = (k, label) => `<tr><td><span class="pill p-${k}">${label}</span></td>
    ${['first', 'add', 'ship'].map((f) => `<td><input class="in money" data-fee="${k}.${f}" value="${money(s.fees[k][f])}" inputmode="numeric"></td>`).join('')}</tr>`;
  const shopField = (k, label, ph = '', ta = false) => `<div><label class="l">${label}</label>${ta ? `<textarea class="in" data-shop="${k}" placeholder="${esc(ph)}">${esc(s.shop[k] || '')}</textarea>` : `<input class="in" data-shop="${k}" placeholder="${esc(ph)}" value="${esc(s.shop[k] || '')}">`}</div>`;
  view.innerHTML = `
    <div class="page-h"><h1>Cài đặt</h1><button class="btn p" id="s-save">Lưu cài đặt</button></div>
    <div class="card pad"><h3 style="margin-bottom:10px">Bảng phí dịch vụ</h3>
      <table class="t"><thead><tr><th>Nền tảng</th><th class="num">Món đầu</th><th class="num">Mỗi món thêm</th><th class="num">Ship mặc định</th></tr></thead><tbody>
      ${feeRow('shopee', 'Shopee')}${feeRow('lazada', 'Lazada')}${feeRow('tiki', 'Tiki')}${feeRow('other', 'Khác / Amazon…')}</tbody></table>
      <p class="muted" style="margin-top:8px">“Món” = 1 loại sản phẩm (số lượng bao nhiêu cũng vậy). Món đầu tiên của đơn tính phí “món đầu”, các món sau tính “mỗi món thêm”. Đổi phí chỉ áp dụng khi tạo/sửa báo giá.</p></div>
    <div class="card pad" style="margin-top:14px"><h3 style="margin-bottom:10px">Thông tin in trên ảnh &amp; trang báo giá</h3>
      <div class="form-grid">
        ${shopField('name', 'Tên shop', 'AN THUONG ORDER')}
        ${shopField('tagline', 'Dòng phụ', 'Your local shopping assistant · Linz Coffee, 42 An Thuong 2')}
        ${shopField('address', 'Địa chỉ nhận hàng', 'Linz Coffee, 42 An Thuong 2, Da Nang')}
        ${shopField('whatsapp', 'WhatsApp của shop', '+84 567 920 087')}
        ${shopField('payment', 'Cách thanh toán (tiếng Anh)', 'Cash at Linz Coffee, or via Wise.')}
        ${shopField('footer', 'Dòng cuối', 'We order after payment and message you when it arrives.')}
        ${shopField('wise', 'Thông tin Wise (hiện trên trang báo giá)', 'Wisetag @… hoặc tên + số tài khoản nhận', true)}
        ${shopField('public_base', 'Tên miền link báo giá (để trống = tên miền app)', 'https://app.anthuongorder.com')}
      </div></div>`;
  view.querySelector('#s-save').onclick = async () => {
    const fees = JSON.parse(JSON.stringify(s.fees));
    view.querySelectorAll('[data-fee]').forEach((el) => { const [k, f] = el.dataset.fee.split('.'); fees[k][f] = parseMoney(el.value); });
    const shop = { ...s.shop };
    view.querySelectorAll('[data-shop]').forEach((el) => { shop[el.dataset.shop] = el.value; });
    try { state.settings = await api('PUT', '/settings', { fees, shop }); toast('Đã lưu cài đặt', 'ok'); viewSettings(); } catch (e) { toast(e.message, 'err'); }
  };
}

// ---------------- users ----------------
function modal(html, onMount) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  onMount(bg.querySelector('.modal'), close);
}
async function viewUsers() {
  const view = shell('');
  const render = (r) => {
    view.innerHTML = `
      <div class="page-h"><h1>User &amp; phân quyền</h1><button class="btn p" id="u-new">+ Tạo user</button></div>
      <div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th>User</th><th>Vai trò</th><th>Quyền</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr></thead><tbody>
      ${r.users.map((u) => `<tr data-u="${u.id}">
        <td><b>${esc(u.display_name)}</b><div class="muted">@${esc(u.username)}</div></td>
        <td><select class="in" data-role style="max-width:130px" ${u.id === state.me.id ? 'disabled' : ''}><option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Nhân viên</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></td>
        <td><div class="perm-grid">${r.all_perms.map((p) => `<label><input type="checkbox" class="cb" data-perm="${p}" ${u.perms.includes(p) ? 'checked' : ''} ${u.role === 'admin' ? 'disabled' : ''}>${PERM_LABEL[p]}</label>`).join('')}</div></td>
        <td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="cb" data-active ${u.active ? 'checked' : ''} ${u.id === state.me.id ? 'disabled' : ''}>${u.active ? 'Hoạt động' : 'Đã khoá'}</label></td>
        <td class="muted nowrap">${u.last_login ? new Date(u.last_login).toLocaleString('vi-VN') : '—'}</td>
        <td><button class="btn sm" data-reset>Đặt lại mật khẩu</button></td></tr>`).join('')}
      </tbody></table></div></div>
      <p class="muted" style="margin-top:10px">Admin có mọi quyền. Nhân viên chỉ có các quyền được tick. Thay đổi được lưu ngay.</p>`;
    view.querySelector('#u-new').onclick = () => modal(`<h3>Tạo user mới</h3>
      <div class="grid"><div><label class="l">Tên đăng nhập</label><input class="in" name="username" placeholder="vd: linh"></div>
      <div><label class="l">Tên hiển thị</label><input class="in" name="display_name" placeholder="vd: Linh"></div>
      <div><label class="l">Mật khẩu (tối thiểu 6 ký tự)</label><input class="in" name="password" type="text"></div>
      <div><label class="l">Vai trò</label><select class="in" name="role"><option value="staff">Nhân viên</option><option value="admin">Admin</option></select></div>
      <div><label class="l">Quyền</label><div class="perm-grid" style="flex-direction:column;gap:6px">${r.all_perms.map((p) => `<label><input type="checkbox" class="cb" value="${p}" ${p === 'quotes' || p === 'orders' ? 'checked' : ''}>${PERM_LABEL[p]}</label>`).join('')}</div></div></div>
      <div class="actions"><button class="btn" data-close>Huỷ</button><button class="btn p" data-ok>Tạo user</button></div>`, (m, close) => {
      m.querySelector('[data-ok]').onclick = async () => {
        try {
          const body = { username: m.querySelector('[name=username]').value, display_name: m.querySelector('[name=display_name]').value, password: m.querySelector('[name=password]').value, role: m.querySelector('[name=role]').value, perms: [...m.querySelectorAll('.cb:checked')].map((c) => c.value) };
          render(await api('POST', '/users', body)); close(); toast('Đã tạo user', 'ok');
        } catch (e) { toast(e.message, 'err'); }
      };
      m.querySelector('[name=username]').focus();
    });
  };
  view.addEventListener('change', async (e) => {
    const tr = e.target.closest('tr[data-u]'); if (!tr) return;
    const id = +tr.dataset.u;
    const perms = [...tr.querySelectorAll('[data-perm]')].filter((c) => c.checked).map((c) => c.dataset.perm);
    const body = { role: tr.querySelector('[data-role]').value, active: tr.querySelector('[data-active]').checked, perms };
    try { render(await api('PUT', '/users/' + id, body)); toast('Đã lưu quyền', 'ok'); } catch (x) { toast(x.message, 'err'); render(await api('GET', '/users')); }
  });
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-reset]'); if (!b) return;
    const id = +b.closest('tr').dataset.u;
    modal(`<h3>Đặt lại mật khẩu</h3><label class="l">Mật khẩu mới</label><input class="in" name="pw" type="text">
      <div class="actions"><button class="btn" data-close>Huỷ</button><button class="btn p" data-ok>Lưu</button></div>`, (m, close) => {
      m.querySelector('[data-ok]').onclick = async () => {
        try { render(await api('PUT', '/users/' + id, { password: m.querySelector('[name=pw]').value })); close(); toast('Đã đặt lại mật khẩu', 'ok'); } catch (x) { toast(x.message, 'err'); }
      };
      m.querySelector('input').focus();
    });
  });
  render(await api('GET', '/users'));
}

// ---------------- account ----------------
async function viewAccount() {
  const view = shell('');
  view.innerHTML = `
    <div class="page-h"><h1>Tài khoản</h1><a class="btn" href="#" data-logout2>Đăng xuất</a></div>
    <div class="card pad" style="max-width:460px">
      <div style="margin-bottom:14px"><b style="font-size:16px">${esc(state.me.display_name)}</b><div class="muted">@${esc(state.me.username)} · ${state.me.role === 'admin' ? 'Admin' : 'Nhân viên'}</div></div>
      <h3 style="margin-bottom:10px">Đổi mật khẩu</h3>
      <div class="grid"><div><label class="l">Mật khẩu hiện tại</label><input class="in" type="password" id="pw-cur" autocomplete="current-password"></div>
      <div><label class="l">Mật khẩu mới (tối thiểu 6 ký tự)</label><input class="in" type="password" id="pw-new" autocomplete="new-password"></div>
      <button class="btn p" id="pw-save" style="justify-self:start">Đổi mật khẩu</button></div>
      <p class="muted" style="margin-top:16px;font-size:12px">Phiên bản app: <b>v${esc(state.serverVersion || CLIENT_VERSION)}</b></p></div>`;
  view.querySelector('#pw-save').onclick = async () => {
    try {
      await api('POST', '/me/password', { current: view.querySelector('#pw-cur').value, next: view.querySelector('#pw-new').value });
      state.me.pw_changed = true; toast('Đã đổi mật khẩu', 'ok'); viewAccount();
    } catch (e) { toast(e.message, 'err'); }
  };
  view.querySelector('[data-logout2]').onclick = async (e) => {
    e.preventDefault(); await api('POST', '/logout').catch(() => {}); state.me = null; location.hash = '#/login';
  };
}

// ---------------- boot ----------------
router().then(refreshWaiting);
