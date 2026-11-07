// An Thuong Order — internal app on Cloudflare Workers + D1.
import { SCHEMA, MIGRATIONS, SCHEMA_VERSION, DEFAULT_SETTINGS } from './schema.js';
import { DEMO_COUNT, planDemoCustomer, shiftDate } from './demo.js';
import { renderPublicQuote, renderNotFound } from './public-quote.js';

export const APP_VERSION = '0.5.3';

const PERMS = ['quotes', 'orders', 'settings', 'users'];
const STATUSES = ['quoted', 'paid', 'ordered', 'arrived', 'received', 'cancelled', 'returned'];
const PAYMENT = ['unpaid', 'cash', 'wise', 'bank'];
const SESSION_DAYS = 30;
const COOKIE = 'atos';
const INITIAL_ADMIN = { username: 'duycan2000', password: '123456', display_name: 'Duy' };

let schemaReady = null;

export default {
  async fetch(request, env, ctx) {
    try {
      if (!schemaReady) schemaReady = ensureSchema(env).catch((e) => { schemaReady = null; throw e; });
      await schemaReady;
      const url = new URL(request.url);
      const path = url.pathname;
      if (path.startsWith('/api/')) return await handleApi(request, env, url);
      const m = path.match(/^\/q\/([A-Za-z0-9]{4,12})\/?$/);
      if (m) return await publicQuote(env, m[1].toUpperCase(), url);
      if (path === '/q' || path.startsWith('/q/')) return html(renderNotFound(), 404);
      if (path.startsWith('/download/')) {
        const res = await env.ASSETS.fetch(request);
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || ct.includes('text/html')) return new Response('Not found', { status: 404 });
        if (path.endsWith('.apk')) {
          const h = new Headers(res.headers);
          h.set('content-type', 'application/vnd.android.package-archive');
          h.set('content-disposition', 'attachment; filename="AnThuongOrder.apk"');
          h.set('cache-control', 'no-cache');
          return new Response(res.body, { status: res.status, headers: h });
        }
        return res;
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      return json({ error: 'Lỗi máy chủ: ' + (err && err.message ? err.message : String(err)) }, 500);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

// ---------- helpers ----------
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
}
const nowIso = () => new Date().toISOString();
// today's date in Vietnam (UTC+7), YYYY-MM-DD
const todayVN = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const int = (v, d = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : d;
};
const str = (v, max = 2000) => (v == null ? '' : String(v)).trim().slice(0, max);

export function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function randomId(len, alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ') {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`;
}
async function verifyPassword(password, stored) {
  const parts = (stored || '').split('$');
  if (parts.length !== 4) return false;
  const again = await hashPassword(password, parts[2]);
  // constant-time-ish compare
  if (again.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < again.length; i++) diff |= again.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

// ---------- schema & settings ----------
async function ensureSchema(env) {
  try {
    const v = await env.DB.prepare("SELECT value FROM settings WHERE key = 'schema_version'").first();
    if (v && v.value === SCHEMA_VERSION) return;
  } catch (_) { /* first run: tables do not exist yet */ }
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  for (const m of MIGRATIONS) {
    try { await env.DB.prepare(m).run(); } catch (_) { /* already applied */ }
  }
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  if (!row || !row.n) {
    const hash = await hashPassword(INITIAL_ADMIN.password);
    await env.DB.prepare(
      `INSERT INTO users (username, display_name, pass_hash, role, perms, active, pw_changed, created_at)
       VALUES (?, ?, ?, 'admin', ?, 1, 0, ?)`
    ).bind(INITIAL_ADMIN.username, INITIAL_ADMIN.display_name, hash, JSON.stringify(PERMS), nowIso()).run();
  }
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").bind(SCHEMA_VERSION).run();
}

async function getSettings(env) {
  const rows = (await env.DB.prepare('SELECT key, value FROM settings').all()).results || [];
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const r of rows) {
    try {
      const v = JSON.parse(r.value);
      if (r.key === 'fees') {
        for (const p of Object.keys(out.fees)) if (v[p]) out.fees[p] = { ...out.fees[p], ...v[p] };
      } else if (r.key === 'shop') out.shop = { ...out.shop, ...v };
      else if (r.key === 'reminders') out.reminders = { ...out.reminders, ...v };
    } catch (_) { /* ignore corrupt value */ }
  }
  return out;
}

// ---------- auth ----------
function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function sessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function publicUser(u) {
  let perms = [];
  try { perms = JSON.parse(u.perms || '[]'); } catch (_) {}
  if (u.role === 'admin') perms = [...PERMS];
  return {
    id: u.id, username: u.username, display_name: u.display_name || u.username, role: u.role,
    perms, active: !!u.active, pw_changed: !!u.pw_changed, created_at: u.created_at, last_login: u.last_login,
  };
}
async function currentUser(request, env) {
  const token = getCookie(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?`
  ).bind(token, nowIso()).first();
  if (!row || !row.active) return null;
  return publicUser(row);
}
function need(user, perm) {
  if (!user) throw new HttpError(401, 'Chưa đăng nhập');
  if (perm && !user.perms.includes(perm)) throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này');
}

async function login(request, env) {
  const body = await readJson(request);
  const username = str(body.username, 64);
  const password = String(body.password || '');
  if (!username || !password) throw bad('Nhập tên đăng nhập và mật khẩu');
  const key = 'u:' + username.toLowerCase();
  const windowMs = 15 * 60 * 1000;
  const att = await env.DB.prepare('SELECT * FROM login_attempts WHERE key = ?').bind(key).first();
  if (att && att.count >= 5 && Date.now() - att.first_at < windowMs) {
    throw new HttpError(429, 'Sai quá 5 lần. Vui lòng thử lại sau 15 phút.');
  }
  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  const ok = user && user.active && (await verifyPassword(password, user.pass_hash));
  if (!ok) {
    if (!att || Date.now() - att.first_at >= windowMs) {
      await env.DB.prepare('INSERT OR REPLACE INTO login_attempts (key, count, first_at) VALUES (?, 1, ?)').bind(key, Date.now()).run();
    } else {
      await env.DB.prepare('UPDATE login_attempts SET count = count + 1 WHERE key = ?').bind(key).run();
    }
    throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu');
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(token, user.id, nowIso(), expires),
    env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(nowIso(), user.id),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()),
  ]);
  return json({ user: publicUser(user), version: APP_VERSION }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

async function readJson(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw bad('Yêu cầu phải là JSON');
  try { return await request.json(); } catch (_) { throw bad('JSON không hợp lệ'); }
}

// ---------- API router ----------
async function handleApi(request, env, url) {
  const method = request.method;
  const path = url.pathname.replace(/\/+$/, '');
  const seg = path.split('/').slice(2); // after /api

  if (path === '/api/version') return json({ version: APP_VERSION });
  if (path === '/api/login' && method === 'POST') return login(request, env);
  if (path === '/api/logout' && method === 'POST') {
    const token = getCookie(request, COOKIE);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }

  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, 'Chưa đăng nhập');

  // me
  if (path === '/api/me' && method === 'GET') return json({ user, version: APP_VERSION });
  if (path === '/api/me/password' && method === 'POST') return changeOwnPassword(request, env, user);

  // settings
  if (path === '/api/settings' && method === 'GET') return json(await getSettings(env));
  if (path === '/api/settings' && method === 'PUT') { need(user, 'settings'); return saveSettings(request, env); }

  // users
  if (seg[0] === 'users') {
    need(user, 'users');
    if (seg.length === 1 && method === 'GET') return listUsers(env);
    if (seg.length === 1 && method === 'POST') return createUser(request, env);
    if (seg.length === 2 && method === 'PUT') return updateUser(request, env, int(seg[1]), user);
  }

  // customers
  if (path === '/api/customers' && method === 'GET') { needAny(user, ['quotes', 'orders']); return searchCustomers(env, url); }
  if (seg[0] === 'customers') {
    needAny(user, ['quotes', 'orders']);
    if (seg.length === 2 && seg[1] === 'list' && method === 'GET') return listCustomers(env, url);
    if (seg.length === 1 && method === 'POST') return createCustomer(request, env);
    if (seg.length === 2 && method === 'GET') return getCustomer(env, int(seg[1]));
    if (seg.length === 2 && method === 'PUT') return updateCustomer(request, env, int(seg[1]));
  }

  // dashboard, reports, cash
  if (path === '/api/today' && method === 'GET') { needAny(user, ['quotes', 'orders']); return todayBoard(env); }
  if (path === '/api/reports' && method === 'GET') { need(user, 'orders'); return reports(env, url); }
  if (path === '/api/cash' && method === 'GET') { need(user, 'orders'); return cashDay(env, url); }
  if (path === '/api/cash' && method === 'POST') { need(user, 'orders'); return saveCash(request, env, user); }
  if (seg[0] === 'returns' && seg.length === 2 && method === 'DELETE') { need(user, 'orders'); return deleteReturn(env, user, int(seg[1])); }

  // demo data (admin)
  if (seg[0] === 'demo') {
    need(user, 'users');
    if (method === 'GET') return json({ count: (await env.DB.prepare('SELECT COUNT(*) AS n FROM orders WHERE is_demo = 1').first()).n, total: DEMO_COUNT });
    if (method === 'POST') return createDemo(request, env, user);
    if (method === 'DELETE') return deleteDemo(env);
  }

  // orders
  if (seg[0] === 'orders') {
    if (seg.length === 1 && method === 'GET') { needAny(user, ['quotes', 'orders']); return listOrders(env, url); }
    if (seg.length === 1 && method === 'POST') { need(user, 'quotes'); return saveOrder(request, env, user, null); }
    const id = int(seg[1]);
    if (seg.length === 2 && method === 'GET') { needAny(user, ['quotes', 'orders']); return json(await loadOrder(env, id)); }
    if (seg.length === 2 && method === 'PUT') { need(user, 'quotes'); return saveOrder(request, env, user, id); }
    if (seg.length === 2 && method === 'DELETE') { need(user, 'users'); return deleteOrder(env, id); }
    if (seg.length === 3 && seg[2] === 'payment' && method === 'POST') { need(user, 'orders'); return setPayment(request, env, user, id); }
    if (seg.length === 3 && seg[2] === 'payments' && method === 'POST') { need(user, 'orders'); return addPayment(request, env, user, id); }
  }

  if (seg[0] === 'payments' && seg.length === 2 && method === 'DELETE') { need(user, 'orders'); return deletePayment(env, user, int(seg[1])); }

  if (seg[0] === 'purchasable' && method === 'GET') { need(user, 'orders'); return listPurchasable(env, url); }
  if (seg[0] === 'purchases') {
    need(user, 'orders');
    if (seg.length === 1 && method === 'GET') return listPurchases(env, url);
    if (seg.length === 1 && method === 'POST') return createPurchase(request, env, user);
    if (seg.length === 2 && method === 'DELETE') return deletePurchase(env, user, int(seg[1]));
  }

  // items
  if (seg[0] === 'items') {
    need(user, 'orders');
    if (seg.length === 1 && method === 'GET') return listItems(env, url);
    if (seg.length === 2 && seg[1] === 'status' && method === 'POST') return bulkStatus(request, env, user);
    if (seg.length === 2 && method === 'PUT') return updateItem(request, env, user, int(seg[1]));
    if (seg.length === 3 && seg[2] === 'return' && method === 'POST') return createReturn(request, env, user, int(seg[1]));
  }

  throw new HttpError(404, 'Không tìm thấy');
}
function needAny(user, perms) {
  if (!perms.some((p) => user.perms.includes(p))) throw new HttpError(403, 'Bạn không có quyền xem mục này');
}

// ---------- me ----------
async function changeOwnPassword(request, env, user) {
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  if (!(await verifyPassword(String(body.current || ''), row.pass_hash))) throw bad('Mật khẩu hiện tại không đúng');
  const next = String(body.next || '');
  if (next.length < 6) throw bad('Mật khẩu mới tối thiểu 6 ký tự');
  await env.DB.prepare('UPDATE users SET pass_hash = ?, pw_changed = 1 WHERE id = ?').bind(await hashPassword(next), user.id).run();
  return json({ ok: true });
}

// ---------- settings ----------
async function saveSettings(request, env) {
  const body = await readJson(request);
  const cur = await getSettings(env);
  const fees = {};
  for (const p of Object.keys(cur.fees)) {
    const f = (body.fees && body.fees[p]) || cur.fees[p];
    fees[p] = { first: Math.max(0, int(f.first)), add: Math.max(0, int(f.add)), ship: Math.max(0, int(f.ship)), ret: Math.max(0, int(f.ret != null ? f.ret : cur.fees[p].ret)) };
  }
  const shop = {};
  for (const k of Object.keys(cur.shop)) shop[k] = str(body.shop && body.shop[k] != null ? body.shop[k] : cur.shop[k], 600);
  await env.DB.batch([
    env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind('fees', JSON.stringify(fees)),
    env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind('shop', JSON.stringify(shop)),
    env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind('reminders', JSON.stringify({
      unpaid_days: Math.max(1, int((body.reminders || cur.reminders).unpaid_days, 2)),
      order_days: Math.max(1, int((body.reminders || cur.reminders).order_days, 7)),
      pickup_days: Math.max(1, int((body.reminders || cur.reminders).pickup_days, 3)),
    })),
  ]);
  return json(await getSettings(env));
}

// ---------- users ----------
async function listUsers(env) {
  const rows = (await env.DB.prepare('SELECT * FROM users ORDER BY id').all()).results || [];
  return json({ users: rows.map(publicUser), all_perms: PERMS });
}
function cleanPerms(arr) {
  return Array.isArray(arr) ? PERMS.filter((p) => arr.includes(p)) : [];
}
async function createUser(request, env) {
  const b = await readJson(request);
  const username = str(b.username, 64);
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) throw bad('Tên đăng nhập 3–64 ký tự: chữ, số, dấu . _ -');
  const password = String(b.password || '');
  if (password.length < 6) throw bad('Mật khẩu tối thiểu 6 ký tự');
  const role = b.role === 'admin' ? 'admin' : 'staff';
  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) throw bad('Tên đăng nhập đã tồn tại');
  await env.DB.prepare(
    `INSERT INTO users (username, display_name, pass_hash, role, perms, active, pw_changed, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?)`
  ).bind(username, str(b.display_name, 80) || username, await hashPassword(password), role, JSON.stringify(cleanPerms(b.perms)), nowIso()).run();
  return listUsers(env);
}
async function updateUser(request, env, id, me) {
  const b = await readJson(request);
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!u) throw new HttpError(404, 'Không tìm thấy user');
  const role = b.role === undefined ? u.role : b.role === 'admin' ? 'admin' : 'staff';
  const active = b.active === undefined ? u.active : b.active ? 1 : 0;
  if (id === me.id && (role !== 'admin' || !active)) throw bad('Không thể tự gỡ quyền admin hoặc khoá chính mình');
  const perms = b.perms === undefined ? u.perms : JSON.stringify(cleanPerms(b.perms));
  const display = b.display_name === undefined ? u.display_name : str(b.display_name, 80);
  const stmts = [env.DB.prepare('UPDATE users SET role = ?, active = ?, perms = ?, display_name = ? WHERE id = ?').bind(role, active, perms, display, id)];
  if (b.password) {
    if (String(b.password).length < 6) throw bad('Mật khẩu tối thiểu 6 ký tự');
    stmts.push(env.DB.prepare('UPDATE users SET pass_hash = ?, pw_changed = 0 WHERE id = ?').bind(await hashPassword(String(b.password)), id));
    stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  }
  if (!active) stmts.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  await env.DB.batch(stmts);
  return listUsers(env);
}

// ---------- customers ----------
const PHONE_LIKE = "OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone,' ',''),'(',''),')',''),'-',''),'+','') LIKE ?";
async function searchCustomers(env, url) {
  const q = normalize(url.searchParams.get('q') || '');
  const digits = q.replace(/\D/g, '');
  let rows;
  if (!q) {
    rows = (await env.DB.prepare('SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders FROM customers c ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 8').all()).results;
  } else {
    rows = (await env.DB.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders FROM customers c
       WHERE c.search LIKE ? ${digits.length >= 3 ? PHONE_LIKE : ''}
       ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 8`
    ).bind(...(digits.length >= 3 ? [`%${q}%`, `%${digits}%`] : [`%${q}%`])).all()).results;
  }
  return json({ customers: rows || [] });
}

async function listCustomers(env, url) {
  const q = normalize(url.searchParams.get('q') || '');
  const digits = q.replace(/\D/g, '');
  const args = [];
  let where = '';
  if (q) {
    where = 'WHERE (c.search LIKE ?' + (digits.length >= 3 ? ' ' + PHONE_LIKE : '') + ' OR LOWER(c.note) LIKE ?)';
    args.push(`%${q}%`);
    if (digits.length >= 3) args.push(`%${digits}%`);
    args.push(`%${q}%`);
  }
  const rows = (await env.DB.prepare(
    `SELECT c.*, COUNT(o.id) AS orders, COALESCE(SUM(o.grand_total),0) AS total, MAX(o.order_date) AS last_order,
       (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o2 ON o2.id = p.order_id WHERE o2.customer_id = c.id) AS received
     FROM customers c LEFT JOIN orders o ON o.customer_id = c.id ${where}
     GROUP BY c.id ORDER BY COALESCE(MAX(o.order_date), substr(c.created_at,1,10)) DESC, c.id DESC LIMIT 500`
  ).bind(...args).all()).results || [];
  return json({ customers: rows });
}
async function getCustomer(env, id) {
  const c = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
  if (!c) throw new HttpError(404, 'Không tìm thấy khách');
  const orders = (await env.DB.prepare(
    `SELECT o.*,
      (SELECT COUNT(*) FROM items i WHERE i.order_id = o.id) AS item_count,
      (SELECT GROUP_CONCAT(status) FROM items i WHERE i.order_id = o.id) AS statuses,
      (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.order_id = o.id) AS received,
      (SELECT COALESCE(SUM(cost),0) FROM items i WHERE i.order_id = o.id AND i.status <> 'cancelled') AS cost_total,
      (SELECT COUNT(*) FROM items i WHERE i.order_id = o.id AND i.status <> 'cancelled') AS active_count,
      (SELECT COUNT(*) FROM items i WHERE i.order_id = o.id AND i.status <> 'cancelled' AND i.cost IS NOT NULL) AS costed_count,
      (SELECT COALESCE(SUM(refund_amount),0) FROM returns r WHERE r.order_id = o.id) AS refunded,
      (SELECT COALESCE(SUM(platform_refund),0) FROM returns r WHERE r.order_id = o.id) AS platform_refunded
     FROM orders o WHERE o.customer_id = ? ORDER BY o.order_date DESC, o.id DESC`
  ).bind(id).all()).results || [];
  return json({ customer: c, orders });
}
async function createCustomer(request, env) {
  const b = await readJson(request);
  const name = str(b.name, 120);
  if (!name) throw bad('Nhập tên khách');
  const phone = str(b.phone, 40);
  const now = nowIso();
  const r = await env.DB.prepare('INSERT INTO customers (name, phone, note, search, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, phone, str(b.note, 1000), normalize(name + ' ' + phone), now, now).run();
  return getCustomer(env, r.meta.last_row_id);
}
async function updateCustomer(request, env, id) {
  const b = await readJson(request);
  const c = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
  if (!c) throw new HttpError(404, 'Không tìm thấy khách');
  const name = b.name !== undefined ? str(b.name, 120) : c.name;
  if (!name) throw bad('Tên khách không được trống');
  const phone = b.phone !== undefined ? str(b.phone, 40) : c.phone;
  const note = b.note !== undefined ? str(b.note, 1000) : c.note;
  const stmts = [
    env.DB.prepare('UPDATE customers SET name = ?, phone = ?, note = ?, search = ?, updated_at = ? WHERE id = ?').bind(name, phone, note, normalize(name + ' ' + phone), nowIso(), id),
  ];
  if (name !== c.name || phone !== c.phone) {
    stmts.push(env.DB.prepare('UPDATE orders SET customer_name = ?, customer_phone = ? WHERE customer_id = ?').bind(name, phone, id));
  }
  await env.DB.batch(stmts);
  if (name !== c.name || phone !== c.phone) {
    // refresh item search text so lookup finds the new name / phone
    const its = (await env.DB.prepare('SELECT i.*, o.code FROM items i JOIN orders o ON o.id = i.order_id WHERE o.customer_id = ?').bind(id).all()).results || [];
    if (its.length) await env.DB.batch(its.map((it) => env.DB.prepare('UPDATE items SET search = ? WHERE id = ?').bind(itemSearch(it, name, phone, it.code), it.id)));
  }
  return getCustomer(env, id);
}

// ---------- returns / refunds ----------
async function createReturn(request, env, user, itemId) {
  const b = await readJson(request);
  const it = await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(itemId).first();
  if (!it) throw new HttpError(404, 'Không tìm thấy món');
  if (['cancelled', 'returned'].includes(it.status)) throw bad('Món này đã huỷ hoặc đã trả');
  const now = nowIso();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.refunded_at || '') ? b.refunded_at : todayVN();
  const method = ['cash', 'wise', 'bank'].includes(b.refund_method) ? b.refund_method : 'cash';
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO returns (order_id, item_id, prev_status, return_fee, refund_amount, refund_method, platform_refund, refunded_at, note, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(it.order_id, it.id, it.status, Math.max(0, int(b.return_fee)), Math.max(0, int(b.refund_amount)), method,
      Math.max(0, int(b.platform_refund)), date, str(b.note, 300), user.id, now),
    env.DB.prepare("UPDATE items SET status = 'returned', status_at = ? WHERE id = ?").bind(now, it.id),
    env.DB.prepare('INSERT INTO status_log (item_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)').bind(it.id, it.status, 'returned', user.id, now),
  ]);
  return json(await loadOrder(env, it.order_id), 201);
}
async function deleteReturn(env, user, id) {
  const r = await env.DB.prepare('SELECT * FROM returns WHERE id = ?').bind(id).first();
  if (!r) throw new HttpError(404, 'Không tìm thấy');
  const to = r.prev_status && r.prev_status !== 'returned' ? r.prev_status : 'received';
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM returns WHERE id = ?').bind(id),
    env.DB.prepare("UPDATE items SET status = ?, status_at = ? WHERE id = ? AND status = 'returned'").bind(to, now, r.item_id),
    env.DB.prepare('INSERT INTO status_log (item_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)').bind(r.item_id, 'returned', to, user.id, now),
  ]);
  return json(await loadOrder(env, r.order_id));
}

// ---------- today board ----------
async function todayBoard(env) {
  const s = await getSettings(env);
  const rm = s.reminders;
  const t = todayVN();
  const unpaid = (await env.DB.prepare(
    `SELECT o.id, o.code, o.public_id, o.customer_name, o.customer_phone, o.order_date, o.grand_total,
       (SELECT COUNT(*) FROM items i WHERE i.order_id = o.id AND i.status <> 'cancelled') AS n
     FROM orders o WHERE o.payment_status = 'unpaid' AND o.order_date <= ?
       AND EXISTS (SELECT 1 FROM items i WHERE i.order_id = o.id AND i.status = 'quoted')
     ORDER BY o.order_date LIMIT 100`
  ).bind(shiftDate(t, -rm.unpaid_days)).all()).results || [];
  const toOrder = (await env.DB.prepare(
    `SELECT o.id, o.code, o.customer_name, o.order_date, COUNT(*) AS n, SUM(i.price + i.shipping) AS value, MIN(i.status_at) AS since,
       (SELECT COUNT(*) FROM items x WHERE x.order_id = o.id AND x.status <> 'cancelled') AS total
     FROM items i JOIN orders o ON o.id = i.order_id WHERE i.status = 'paid'
     GROUP BY o.id ORDER BY since LIMIT 100`
  ).all()).results || [];
  const late = (await env.DB.prepare(
    `SELECT i.id, i.order_id, i.name, i.name_vi, i.variation, i.variation2, i.platform, i.platform_order_id, i.status_at, o.code, o.customer_name, p.code AS purchase_code
     FROM items i JOIN orders o ON o.id = i.order_id LEFT JOIN purchases p ON p.id = i.purchase_id
     WHERE i.status = 'ordered' AND substr(i.status_at, 1, 10) <= ? ORDER BY i.status_at LIMIT 200`
  ).bind(shiftDate(t, -rm.order_days)).all()).results || [];
  const pickup = (await env.DB.prepare(
    `SELECT o.id, o.code, o.public_id, o.customer_name, o.customer_phone, COUNT(*) AS n, MIN(i.status_at) AS since,
       GROUP_CONCAT(NULLIF(i.shelf, '')) AS shelves, GROUP_CONCAT(i.id) AS ids,
       (SELECT COUNT(*) FROM items x WHERE x.order_id = o.id AND x.status NOT IN ('cancelled','returned')) AS total,
       (SELECT COUNT(*) FROM items x WHERE x.order_id = o.id AND x.status IN ('arrived','received')) AS here
     FROM items i JOIN orders o ON o.id = i.order_id WHERE i.status = 'arrived'
     GROUP BY o.id HAVING substr(MIN(i.status_at), 1, 10) <= ? ORDER BY since LIMIT 100`
  ).bind(shiftDate(t, -rm.pickup_days)).all()).results || [];
  const atCafe = await env.DB.prepare("SELECT COUNT(*) AS n, COUNT(DISTINCT order_id) AS o FROM items WHERE status = 'arrived'").first();
  const stats = {
    quotes: (await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(grand_total),0) AS v FROM orders WHERE order_date = ?').bind(t).first()),
    received: (await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS v FROM payments WHERE received_at = ?').bind(t).first()),
    purchases: (await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(paid_amount),0) AS v, COALESCE(SUM(quoted_amount - paid_amount),0) AS saved FROM purchases WHERE purchased_at = ?').bind(t).first()),
    at_cafe: atCafe,
  };
  return json({ today: t, reminders: rm, unpaid, to_order: toOrder, late, pickup, stats });
}

// ---------- reports ----------
async function reports(env, url) {
  const months = Math.max(1, Math.min(24, int(url.searchParams.get('months'), 12)));
  const t = todayVN();
  const list = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 - i, 1));
    list.push(d.toISOString().slice(0, 7));
  }
  const from = list[0] + '-01';
  const byMonth = (rows) => Object.fromEntries((rows.results || []).map((r) => [r.m, r]));
  const orders = byMonth(await env.DB.prepare(
    `SELECT substr(order_date,1,7) AS m, COUNT(*) AS orders, COUNT(DISTINCT customer_id) AS customers, COALESCE(SUM(grand_total),0) AS grand, COALESCE(SUM(fee_total),0) AS fee
     FROM orders WHERE order_date >= ? GROUP BY m`).bind(from).all());
  const items = byMonth(await env.DB.prepare(
    `SELECT substr(o.order_date,1,7) AS m, COUNT(*) AS items, COALESCE(SUM(i.cost),0) AS cost,
       COALESCE(SUM(i.fee),0) AS fee_done, COALESCE(SUM(i.price + i.shipping - i.cost),0) AS voucher
     FROM items i JOIN orders o ON o.id = i.order_id
     WHERE o.order_date >= ? AND i.status <> 'cancelled' AND i.cost IS NOT NULL GROUP BY m`).bind(from).all());
  const rets = byMonth(await env.DB.prepare(
    `SELECT substr(o.order_date,1,7) AS m, COUNT(*) AS returns, COALESCE(SUM(r.refund_amount),0) AS refunds, COALESCE(SUM(r.platform_refund),0) AS platform_refunds
     FROM returns r JOIN orders o ON o.id = r.order_id WHERE o.order_date >= ? GROUP BY m`).bind(from).all());
  const pays = byMonth(await env.DB.prepare(
    `SELECT substr(received_at,1,7) AS m, COALESCE(SUM(amount),0) AS received,
       COALESCE(SUM(CASE WHEN method='cash' THEN amount END),0) AS cash, COALESCE(SUM(CASE WHEN method='wise' THEN amount END),0) AS wise,
       COALESCE(SUM(CASE WHEN method='bank' THEN amount END),0) AS bank
     FROM payments WHERE received_at >= ? GROUP BY m`).bind(from).all());
  const buys = byMonth(await env.DB.prepare(
    `SELECT substr(purchased_at,1,7) AS m, COUNT(*) AS purchases, COALESCE(SUM(paid_amount),0) AS paid, COALESCE(SUM(quoted_amount - paid_amount),0) AS saved,
       COALESCE(SUM(quoted_amount),0) AS quoted FROM purchases WHERE purchased_at >= ? GROUP BY m`).bind(from).all());
  const newc = byMonth(await env.DB.prepare(
    `SELECT m, COUNT(*) AS new_customers FROM (SELECT substr(MIN(order_date),1,7) AS m FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id) WHERE m >= ? GROUP BY m`).bind(list[0]).all());
  const rows = list.map((m) => {
    const o = orders[m] || {}, it = items[m] || {}, r = rets[m] || {}, p = pays[m] || {}, b = buys[m] || {}, n = newc[m] || {};
    const profit = (it.fee_done || 0) + (it.voucher || 0) - (r.refunds || 0) + (r.platform_refunds || 0);
    return {
      month: m, orders: o.orders || 0, customers: o.customers || 0, new_customers: n.new_customers || 0, grand: o.grand || 0, fee: o.fee || 0,
      items_done: it.items || 0, cost: it.cost || 0, fee_done: it.fee_done || 0, voucher: it.voucher || 0,
      returns: r.returns || 0, refunds: r.refunds || 0, platform_refunds: r.platform_refunds || 0, profit,
      received: p.received || 0, cash: p.cash || 0, wise: p.wise || 0, bank: p.bank || 0,
      purchases: b.purchases || 0, purchase_paid: b.paid || 0, purchase_quoted: b.quoted || 0, saved: b.saved || 0,
    };
  });
  const focus = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '') ? url.searchParams.get('month') : list[list.length - 1];
  const top = (await env.DB.prepare(
    `SELECT o.customer_id, o.customer_name, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(i.price + i.shipping + i.fee),0) AS total,
       COALESCE(SUM(CASE WHEN i.cost IS NOT NULL THEN i.price + i.shipping + i.fee - i.cost END),0) AS profit
     FROM orders o JOIN items i ON i.order_id = o.id AND i.status <> 'cancelled'
     WHERE substr(o.order_date,1,7) = ? GROUP BY o.customer_id, o.customer_name ORDER BY total DESC LIMIT 10`).bind(focus).all()).results || [];
  return json({ months: rows, focus, top });
}

// ---------- cash closing ----------
async function cashDay(env, url) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') || '') ? url.searchParams.get('date') : todayVN();
  const payments = (await env.DB.prepare(
    `SELECT p.*, o.code, o.customer_name FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.received_at = ? ORDER BY p.id`).bind(date).all()).results || [];
  const refunds = (await env.DB.prepare(
    `SELECT r.*, o.code, o.customer_name, i.name FROM returns r JOIN orders o ON o.id = r.order_id JOIN items i ON i.id = r.item_id WHERE r.refunded_at = ? ORDER BY r.id`).bind(date).all()).results || [];
  const purchases = (await env.DB.prepare('SELECT * FROM purchases WHERE purchased_at = ? ORDER BY id').bind(date).all()).results || [];
  const closing = await env.DB.prepare('SELECT * FROM cash_closings WHERE date = ?').bind(date).first();
  const history = (await env.DB.prepare('SELECT * FROM cash_closings ORDER BY date DESC LIMIT 14').all()).results || [];
  const sum = (arr, f) => arr.filter(f).reduce((a, x) => a + (x.amount != null ? x.amount : x.refund_amount), 0);
  const totals = {
    cash_in: sum(payments, (p) => p.method === 'cash'), wise_in: sum(payments, (p) => p.method === 'wise'), bank_in: sum(payments, (p) => p.method === 'bank'),
    cash_out: sum(refunds, (r) => r.refund_method === 'cash'), other_out: sum(refunds, (r) => r.refund_method !== 'cash'),
    purchases: purchases.reduce((a, p) => a + p.paid_amount, 0),
  };
  totals.expected_cash = totals.cash_in - totals.cash_out;
  return json({ date, payments, refunds, purchases, totals, closing, history });
}
async function saveCash(request, env, user) {
  const b = await readJson(request);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : todayVN();
  const day = await (await cashDay(env, new URL('http://x/?date=' + date))).json();
  await env.DB.prepare('INSERT OR REPLACE INTO cash_closings (date, expected, counted, note, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(date, day.totals.expected_cash, Math.max(0, int(b.counted)), str(b.note, 300), user.id, nowIso()).run();
  return cashDay(env, new URL('http://x/?date=' + date));
}

// ---------- demo data ----------
async function createDemo(request, env, user) {
  const b = await readJson(request);
  const idx = Math.max(0, Math.min(DEMO_COUNT - 1, int(b.index)));
  const seed = int(b.seed, 1) || 1;
  const settings = await getSettings(env);
  const today = todayVN();
  const plan = planDemoCustomer(idx, seed, settings.fees, today);
  const now = nowIso();
  const cr = await env.DB.prepare('INSERT INTO customers (name, phone, note, search, created_at, updated_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .bind(plan.name, plan.phone, plan.note, normalize(plan.name + ' ' + plan.phone), now, now).run();
  const customerId = cr.meta.last_row_id;
  const code = await nextCode(env, plan.date);
  const publicId = randomId(7);
  const products = plan.items.reduce((a, i) => a + i.price, 0);
  const shipping = plan.items.reduce((a, i) => a + i.shipping, 0);
  const fees = plan.items.reduce((a, i) => a + i.fee, 0);
  const payStatus = plan.payment ? plan.payment.method : 'unpaid';
  const orr = await env.DB.prepare(
    `INSERT INTO orders (code, public_id, customer_id, customer_name, customer_phone, order_date, payment_status, note,
      products_total, shipping_total, fee_total, grand_total, created_by, created_at, updated_at, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(code, publicId, customerId, plan.name, plan.phone, plan.date, payStatus, products, shipping, fees, products + shipping + fees, user.id, now, now).run();
  const orderId = orr.meta.last_row_id;
  const purchaseOf = new Map();
  const costOf = new Map();
  for (const bl of plan.blocks) {
    const pcode = await nextPurchaseCode(env, bl.purchased_at);
    const pr = await env.DB.prepare(
      `INSERT INTO purchases (code, platform, platform_order_id, purchased_at, quoted_amount, paid_amount, item_count, note, user_id, created_at, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(pcode, plan.items[bl.idxs[0]].platform, bl.platform_order_id, bl.purchased_at, bl.quoted, bl.paid, bl.idxs.length, bl.note, user.id, now).run();
    const costs = allocate(bl.paid, bl.idxs.map((k) => plan.items[k].price + plan.items[k].shipping));
    bl.idxs.forEach((k, j) => { purchaseOf.set(k, { id: pr.meta.last_row_id, poi: bl.platform_order_id }); costOf.set(k, costs[j]); });
  }
  const stmts = plan.items.map((it, k) => {
    const pu = purchaseOf.get(k);
    const poi = pu ? pu.poi : '';
    return env.DB.prepare(
      `INSERT INTO items (order_id, position, link, platform, name, name_vi, variation, qty, unit_price, price, shipping, fee, fee_manual,
        status, status_at, platform_order_id, cost, shelf, search, purchase_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?)`
    ).bind(orderId, k, it.link, it.platform, it.name, it.name_vi, it.variation, it.qty, it.unit_price, it.price, it.shipping, it.fee,
      plan.statusOf[k], plan.statusAt[k] + 'T09:00:00.000Z', poi, costOf.has(k) ? costOf.get(k) : null,
      plan.statusOf[k] === 'arrived' ? 'D' + (1 + (k % 6)) : '', itemSearch({ ...it, platform_order_id: poi }, plan.name, plan.phone, code), pu ? pu.id : null);
  });
  if (plan.payment) {
    stmts.push(env.DB.prepare('INSERT INTO payments (order_id, amount, method, received_at, note, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(orderId, plan.payment.amount, plan.payment.method, plan.payment.received_at, plan.payment.amount > products + shipping + fees ? 'làm tròn' : '', user.id, now));
  }
  await env.DB.batch(stmts);
  // a few demo returns so refunds show up in reports
  if ([5, 13, 20].includes(idx) && plan.statusOf[0] === 'received') {
    const it = await env.DB.prepare('SELECT * FROM items WHERE order_id = ? ORDER BY position LIMIT 1').bind(orderId).first();
    const ret = (settings.fees[it.platform] || settings.fees.other).ret || 15000;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO returns (order_id, item_id, prev_status, return_fee, refund_amount, refund_method, platform_refund, refunded_at, note, user_id, created_at)
        VALUES (?, ?, 'received', ?, ?, 'cash', ?, ?, 'demo: sai size', ?, ?)`).bind(orderId, it.id, ret, Math.max(0, it.price + it.shipping - ret), it.cost || 0, shiftDate(plan.statusAt[0], 1) > today ? today : shiftDate(plan.statusAt[0], 1), user.id, now),
      env.DB.prepare("UPDATE items SET status = 'returned' WHERE id = ?").bind(it.id),
    ]);
  }
  return json({ ok: true, index: idx, customer: plan.name, code, items: plan.items.length });
}

async function deleteDemo(env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM status_log WHERE item_id IN (SELECT i.id FROM items i JOIN orders o ON o.id = i.order_id WHERE o.is_demo = 1)'),
    env.DB.prepare('DELETE FROM items WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)'),
    env.DB.prepare('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)'),
    env.DB.prepare('DELETE FROM returns WHERE order_id IN (SELECT id FROM orders WHERE is_demo = 1)'),
    env.DB.prepare('DELETE FROM orders WHERE is_demo = 1'),
    env.DB.prepare('DELETE FROM purchases WHERE is_demo = 1'),
    env.DB.prepare('DELETE FROM customers WHERE is_demo = 1 AND id NOT IN (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL)'),
  ]);
  return json({ ok: true });
}

// ---------- orders ----------
async function loadOrder(env, id) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) throw new HttpError(404, 'Không tìm thấy đơn');
  const items = (await env.DB.prepare(
    'SELECT i.*, p.code AS purchase_code, p.purchased_at AS purchased_at FROM items i LEFT JOIN purchases p ON p.id = i.purchase_id WHERE i.order_id = ? ORDER BY i.position, i.id'
  ).bind(id).all()).results || [];
  const payments = (await env.DB.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY received_at, id').bind(id).all()).results || [];
  order.returns = (await env.DB.prepare('SELECT * FROM returns WHERE order_id = ? ORDER BY refunded_at, id').bind(id).all()).results || [];
  if (order.customer_id) {
    const c = await env.DB.prepare('SELECT note FROM customers WHERE id = ?').bind(order.customer_id).first();
    order.customer_note = c ? c.note || '' : '';
  }
  return { order, items, payments };
}

async function listOrders(env, url) {
  const month = url.searchParams.get('month') || '';
  const q = normalize(url.searchParams.get('q') || '');
  const where = [];
  const args = [];
  if (/^\d{4}-\d{2}$/.test(month) && !q) { where.push('o.order_date LIKE ?'); args.push(month + '%'); }
  if (q) {
    where.push(`(LOWER(o.code) LIKE ? OR o.id IN (SELECT order_id FROM items WHERE search LIKE ?) OR o.customer_id IN (SELECT id FROM customers WHERE search LIKE ?))`);
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const sql = `SELECT o.*,
      (SELECT COUNT(*) FROM items i WHERE i.order_id = o.id) AS item_count,
      (SELECT GROUP_CONCAT(status) FROM items i WHERE i.order_id = o.id) AS statuses,
      (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.order_id = o.id) AS received,
      (SELECT COALESCE(SUM(cost),0) FROM items i WHERE i.order_id = o.id AND i.status <> 'cancelled') AS cost_total,
      (SELECT COUNT(*) FROM items i WHERE i.order_id = o.id AND i.status <> 'cancelled') AS active_count,
      (SELECT COUNT(*) FROM items i WHERE i.order_id = o.id AND i.status <> 'cancelled' AND i.cost IS NOT NULL) AS costed_count,
      (SELECT COALESCE(SUM(refund_amount),0) FROM returns r WHERE r.order_id = o.id) AS refunded,
      (SELECT COALESCE(SUM(platform_refund),0) FROM returns r WHERE r.order_id = o.id) AS platform_refunded
    FROM orders o ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY o.order_date DESC, o.id DESC LIMIT 300`;
  const rows = (await env.DB.prepare(sql).bind(...args).all()).results || [];
  return json({ orders: rows });
}

function cleanItem(raw, i) {
  const qty = Math.max(1, int(raw.qty, 1));
  const unit = Math.max(0, int(raw.unit_price));
  const platform = ['shopee', 'lazada', 'tiki', 'other'].includes(raw.platform) ? raw.platform : 'other';
  return {
    id: raw.id ? int(raw.id) : null,
    position: i,
    link: str(raw.link, 1500),
    platform,
    name: str(raw.name, 400),
    name_vi: str(raw.name_vi, 400),
    variation: str(raw.variation, 200),
    variation2: str(raw.variation2, 200),
    qty,
    unit_price: unit,
    price: unit * qty,
    shipping: Math.max(0, int(raw.shipping)),
    fee: Math.max(0, int(raw.fee)),
    fee_manual: raw.fee_manual ? 1 : 0,
    status: STATUSES.includes(raw.status) ? raw.status : null,
    platform_order_id: str(raw.platform_order_id, 80),
    cost: raw.cost === '' || raw.cost == null ? null : Math.max(0, int(raw.cost)),
    shelf: str(raw.shelf, 30),
  };
}
const itemSearch = (it, customerName, phone, code) =>
  normalize([it.name, it.name_vi, it.variation, it.variation2, it.platform_order_id, it.platform, customerName, phone, code].filter(Boolean).join(' | '));

async function nextCode(env, date) {
  const mmdd = date.slice(5, 7) + date.slice(8, 10);
  const yy = date.slice(2, 4);
  const prefix = `Q-${mmdd}-`;
  const rows = (await env.DB.prepare('SELECT code FROM orders WHERE order_date = ? AND code LIKE ?').bind(date, prefix + '%').all()).results || [];
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.code.slice(prefix.length), 10);
    if (n > max) max = n;
  }
  let code = `${prefix}${String(max + 1).padStart(2, '0')}`;
  // same MMDD in a different year: add the year to keep codes unique
  const clash = await env.DB.prepare('SELECT id FROM orders WHERE code = ?').bind(code).first();
  if (clash) code = `Q-${yy}${mmdd}-${String(max + 1).padStart(2, '0')}`;
  return code;
}

async function upsertCustomer(env, id, name, phone) {
  const now = nowIso();
  const search = normalize(name + ' ' + phone);
  if (id) {
    const c = await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first();
    if (c) {
      await env.DB.prepare('UPDATE customers SET name = ?, phone = ?, search = ?, updated_at = ? WHERE id = ?').bind(name, phone, search, now, id).run();
      return id;
    }
  }
  // match by exact name + phone to avoid duplicates
  const found = await env.DB.prepare("SELECT id FROM customers WHERE LOWER(name) = LOWER(?) AND COALESCE(phone, '') = ?").bind(name, phone).first();
  if (found) {
    await env.DB.prepare('UPDATE customers SET updated_at = ? WHERE id = ?').bind(now, found.id).run();
    return found.id;
  }
  const r = await env.DB.prepare('INSERT INTO customers (name, phone, search, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(name, phone, search, now, now).run();
  return r.meta.last_row_id;
}

async function saveOrder(request, env, user, id) {
  const b = await readJson(request);
  const name = str(b.customer_name, 120);
  const phone = str(b.customer_phone, 40);
  if (!name) throw bad('Nhập tên khách');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.order_date || '') ? b.order_date : todayVN();
  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items = rawItems.map(cleanItem).filter((it) => it.name || it.link || it.unit_price);
  if (!items.length) throw bad('Đơn cần ít nhất 1 sản phẩm');
  if (items.length > 200) throw bad('Tối đa 200 món mỗi đơn');
  const note = str(b.note, 1000);
  const now = nowIso();

  let existing = null;
  let oldItems = [];
  if (id) {
    const loaded = await loadOrder(env, id);
    existing = loaded.order;
    oldItems = loaded.items;
  }
  const payment = existing ? existing.payment_status : (PAYMENT.includes(b.payment_status) ? b.payment_status : 'unpaid');
  const customerId = await upsertCustomer(env, int(b.customer_id) || (existing && existing.customer_id), name, phone);

  const active = items.filter((it) => (it.status || '') !== 'cancelled');
  const products = active.reduce((s, it) => s + it.price, 0);
  const shipping = active.reduce((s, it) => s + it.shipping, 0);
  const fees = active.reduce((s, it) => s + it.fee, 0);
  const grand = products + shipping + fees;

  let orderId = id;
  let code = existing ? existing.code : null;
  if (!existing) {
    code = await nextCode(env, date);
    let publicId = randomId(6);
    for (let i = 0; i < 5; i++) {
      const c = await env.DB.prepare('SELECT id FROM orders WHERE public_id = ?').bind(publicId).first();
      if (!c) break;
      publicId = randomId(7);
    }
    const r = await env.DB.prepare(
      `INSERT INTO orders (code, public_id, customer_id, customer_name, customer_phone, order_date, payment_status, note,
        products_total, shipping_total, fee_total, grand_total, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(code, publicId, customerId, name, phone, date, payment, note, products, shipping, fees, grand, user.id, now, now).run();
    orderId = r.meta.last_row_id;
  } else {
    await env.DB.prepare(
      `UPDATE orders SET customer_id = ?, customer_name = ?, customer_phone = ?, order_date = ?, payment_status = ?, note = ?,
        products_total = ?, shipping_total = ?, fee_total = ?, grand_total = ?, updated_at = ? WHERE id = ?`
    ).bind(customerId, name, phone, date, payment, note, products, shipping, fees, grand, now, orderId).run();
  }

  // items: update by id, insert new, delete removed
  const oldById = new Map(oldItems.map((it) => [it.id, it]));
  const keep = new Set();
  const stmts = [];
  const paidLike = payment !== 'unpaid';
  for (const it of items) {
    const old = it.id ? oldById.get(it.id) : null;
    let status = it.status || (old ? old.status : 'quoted');
    if (paidLike && status === 'quoted') status = 'paid';
    if (!paidLike && status === 'paid') status = 'quoted';
    const search = itemSearch(it, name, phone, code);
    if (old) {
      keep.add(old.id);
      const statusAt = old.status !== status ? now : old.status_at;
      stmts.push(env.DB.prepare(
        `UPDATE items SET position=?, link=?, platform=?, name=?, name_vi=?, variation=?, variation2=?, qty=?, unit_price=?, price=?, shipping=?, fee=?, fee_manual=?,
          status=?, status_at=?, platform_order_id=?, cost=?, shelf=?, search=? WHERE id=? AND order_id=?`
      ).bind(it.position, it.link, it.platform, it.name, it.name_vi, it.variation, it.variation2, it.qty, it.unit_price, it.price, it.shipping, it.fee, it.fee_manual,
        status, statusAt, it.platform_order_id, old.purchase_id ? old.cost : it.cost, it.shelf, search, old.id, orderId));
      if (old.status !== status) stmts.push(env.DB.prepare('INSERT INTO status_log (item_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)').bind(old.id, old.status, status, user.id, now));
    } else {
      stmts.push(env.DB.prepare(
        `INSERT INTO items (order_id, position, link, platform, name, name_vi, variation, variation2, qty, unit_price, price, shipping, fee, fee_manual,
          status, status_at, platform_order_id, cost, shelf, search) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(orderId, it.position, it.link, it.platform, it.name, it.name_vi, it.variation, it.variation2, it.qty, it.unit_price, it.price, it.shipping, it.fee, it.fee_manual,
        status, now, it.platform_order_id, it.cost, it.shelf, search));
    }
  }
  for (const old of oldItems) if (!keep.has(old.id)) stmts.push(env.DB.prepare('DELETE FROM items WHERE id = ?').bind(old.id));
  if (stmts.length) await env.DB.batch(stmts);
  return json(await loadOrder(env, orderId), existing ? 200 : 201);
}

async function deleteOrder(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM status_log WHERE item_id IN (SELECT id FROM items WHERE order_id = ?)').bind(id),
    env.DB.prepare('DELETE FROM items WHERE order_id = ?').bind(id),
    env.DB.prepare('DELETE FROM payments WHERE order_id = ?').bind(id),
    env.DB.prepare('DELETE FROM returns WHERE order_id = ?').bind(id),
    env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

async function setPayment(request, env, user, id) {
  const b = await readJson(request);
  const payment = PAYMENT.includes(b.payment_status) ? b.payment_status : 'unpaid';
  await applyPayment(env, user, id, payment);
  return json(await loadOrder(env, id));
}

async function applyPayment(env, user, id, payment) {
  const { items } = await loadOrder(env, id);
  const now = nowIso();
  const stmts = [env.DB.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').bind(payment, now, id)];
  for (const it of items) {
    let to = it.status;
    if (payment !== 'unpaid' && it.status === 'quoted') to = 'paid';
    if (payment === 'unpaid' && it.status === 'paid') to = 'quoted';
    if (to !== it.status) {
      stmts.push(env.DB.prepare('UPDATE items SET status = ?, status_at = ? WHERE id = ?').bind(to, now, it.id));
      stmts.push(env.DB.prepare('INSERT INTO status_log (item_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)').bind(it.id, it.status, to, user.id, now));
    }
  }
  await env.DB.batch(stmts);
}

// ---------- payments (money received from customer) ----------
async function syncPaymentStatus(env, user, orderId) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount),0) AS total,
       (SELECT method FROM payments WHERE order_id = ? ORDER BY received_at DESC, id DESC LIMIT 1) AS method
     FROM payments WHERE order_id = ?`
  ).bind(orderId, orderId).first();
  const status = row.total > 0 ? (PAYMENT.includes(row.method) ? row.method : 'cash') : 'unpaid';
  await applyPayment(env, user, orderId, status);
}

async function addPayment(request, env, user, orderId) {
  const b = await readJson(request);
  const order = await env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError(404, 'Không tìm thấy đơn');
  const amount = int(b.amount);
  if (!amount || amount < 0) throw bad('Nhập số tiền đã nhận');
  const method = ['cash', 'wise', 'bank'].includes(b.method) ? b.method : 'cash';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.received_at || '') ? b.received_at : todayVN();
  await env.DB.prepare('INSERT INTO payments (order_id, amount, method, received_at, note, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(orderId, amount, method, date, str(b.note, 300), user.id, nowIso()).run();
  await syncPaymentStatus(env, user, orderId);
  return json(await loadOrder(env, orderId), 201);
}

async function deletePayment(env, user, id) {
  const p = await env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError(404, 'Không tìm thấy khoản thanh toán');
  await env.DB.prepare('DELETE FROM payments WHERE id = ?').bind(id).run();
  await syncPaymentStatus(env, user, p.order_id);
  return json(await loadOrder(env, p.order_id));
}

// ---------- purchases (one checkout on Shopee/Lazada, may cover many items) ----------
async function listPurchasable(env, url) {
  const q = normalize(url.searchParams.get('q') || '');
  const withUnpaid = url.searchParams.get('unpaid') === '1';
  const args = [];
  let where = `i.purchase_id IS NULL AND i.status IN (${withUnpaid ? "'quoted','paid'" : "'paid'"})`;
  if (q) { where += ' AND i.search LIKE ?'; args.push(`%${q}%`); }
  const rows = (await env.DB.prepare(
    `SELECT i.*, o.code, o.customer_id, o.customer_name, o.customer_phone, o.order_date, o.payment_status,
       (SELECT COUNT(*) FROM items x WHERE x.order_id = o.id AND x.status NOT IN ('cancelled','returned')) AS order_items,
       (SELECT COUNT(*) FROM items x WHERE x.order_id = o.id AND x.purchase_id IS NOT NULL) AS order_purchased
     FROM items i JOIN orders o ON o.id = i.order_id WHERE ${where}
     ORDER BY o.order_date, o.id, i.position LIMIT 400`
  ).bind(...args).all()).results || [];
  return json({ items: rows });
}

export function allocate(total, weights) {
  const W = weights.reduce((a, b) => a + b, 0);
  const n = weights.length;
  const out = weights.map((w) => (W > 0 ? Math.floor((total * w) / W) : Math.floor(total / n)));
  let rest = total - out.reduce((a, b) => a + b, 0);
  // give rounding remainder to the largest items first
  const order = weights.map((w, i) => i).sort((a, b) => weights[b] - weights[a]);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) out[order[k]] += 1;
  return out;
}

async function nextPurchaseCode(env, date) {
  const prefix = `P-${date.slice(5, 7)}${date.slice(8, 10)}-`;
  const rows = (await env.DB.prepare('SELECT code FROM purchases WHERE code LIKE ?').bind(prefix + '%').all()).results || [];
  let max = 0;
  for (const r of rows) { const n = parseInt(r.code.slice(prefix.length), 10); if (n > max) max = n; }
  let code = `${prefix}${String(max + 1).padStart(2, '0')}`;
  if (rows.some((r) => r.code === code)) code = `P-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${String(max + 1).padStart(2, '0')}`;
  return code;
}

async function createPurchase(request, env, user) {
  const b = await readJson(request);
  const ids = [...new Set((Array.isArray(b.item_ids) ? b.item_ids : []).map((x) => int(x)).filter(Boolean))].slice(0, 100);
  if (!ids.length) throw bad('Chọn ít nhất 1 món');
  const paid = int(b.paid_amount);
  if (!(paid > 0)) throw bad('Nhập số tiền thực trả');
  const marks = ids.map(() => '?').join(',');
  const rows = (await env.DB.prepare(
    `SELECT i.*, o.customer_id, o.customer_name, o.customer_phone, o.code AS order_code, o.is_demo FROM items i JOIN orders o ON o.id = i.order_id WHERE i.id IN (${marks})`
  ).bind(...ids).all()).results || [];
  if (rows.length !== ids.length) throw bad('Một số món không còn tồn tại');
  if (new Set(rows.map((r) => r.customer_id || 'o' + r.order_id)).size > 1) throw bad('Mỗi lượt đặt chỉ gồm món của 1 khách');
  if (rows.some((r) => r.purchase_id)) throw bad('Một số món đã nằm trong lượt đặt khác');
  if (rows.some((r) => ['cancelled', 'returned'].includes(r.status))) throw bad('Không thể đặt món đã huỷ / trả hàng');
  // keep the order the user sees
  rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const weights = rows.map((r) => (r.price || 0) + (r.shipping || 0));
  const quoted = weights.reduce((a, c) => a + c, 0);
  const costs = allocate(paid, weights);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.purchased_at || '') ? b.purchased_at : todayVN();
  const platforms = [...new Set(rows.map((r) => r.platform))];
  const poi = str(b.platform_order_id, 80);
  const code = await nextPurchaseCode(env, date);
  const now = nowIso();
  const r = await env.DB.prepare(
    `INSERT INTO purchases (code, platform, platform_order_id, purchased_at, quoted_amount, paid_amount, item_count, note, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(code, platforms.length === 1 ? platforms[0] : 'mixed', poi, date, quoted, paid, rows.length, str(b.note, 300), user.id, now).run();
  const pid = r.meta.last_row_id;
  const stmts = [];
  rows.forEach((it, k) => {
    const to = ['quoted', 'paid'].includes(it.status) ? 'ordered' : it.status;
    const newPoi = it.platform_order_id || poi;
    const search = itemSearch({ ...it, platform_order_id: newPoi }, it.customer_name, it.customer_phone, it.order_code);
    stmts.push(env.DB.prepare('UPDATE items SET cost = ?, purchase_id = ?, status = ?, status_at = ?, platform_order_id = ?, search = ? WHERE id = ?')
      .bind(costs[k], pid, to, to !== it.status ? now : it.status_at, newPoi, search, it.id));
    if (to !== it.status) stmts.push(env.DB.prepare('INSERT INTO status_log (item_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)').bind(it.id, it.status, to, user.id, now));
  });
  await env.DB.batch(stmts);
  return json(await getPurchase(env, pid), 201);
}

async function getPurchase(env, id) {
  const p = await env.DB.prepare('SELECT * FROM purchases WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError(404, 'Không tìm thấy lượt đặt');
  p.items = (await env.DB.prepare(
    `SELECT i.id, i.order_id, i.name, i.name_vi, i.variation, i.variation2, i.qty, i.price, i.shipping, i.cost, i.platform, i.status, o.code AS order_code, o.customer_name
     FROM items i JOIN orders o ON o.id = i.order_id WHERE i.purchase_id = ? ORDER BY o.id, i.position`
  ).bind(id).all()).results || [];
  return p;
}

async function listPurchases(env, url) {
  const month = url.searchParams.get('month') || '';
  const args = [];
  let where = '';
  if (/^\d{4}-\d{2}$/.test(month)) { where = 'WHERE purchased_at LIKE ?'; args.push(month + '%'); }
  const ps = (await env.DB.prepare(`SELECT * FROM purchases ${where} ORDER BY purchased_at DESC, id DESC LIMIT 200`).bind(...args).all()).results || [];
  if (ps.length) {
    const marks = ps.map(() => '?').join(',');
    const items = (await env.DB.prepare(
      `SELECT i.id, i.purchase_id, i.order_id, i.name, i.name_vi, i.variation, i.variation2, i.qty, i.price, i.shipping, i.cost, i.platform, i.status, o.code AS order_code, o.customer_name
       FROM items i JOIN orders o ON o.id = i.order_id WHERE i.purchase_id IN (${marks}) ORDER BY o.id, i.position`
    ).bind(...ps.map((p) => p.id)).all()).results || [];
    for (const p of ps) p.items = items.filter((i) => i.purchase_id === p.id);
  }
  return json({ purchases: ps });
}

async function deletePurchase(env, user, id) {
  const p = await getPurchase(env, id);
  const now = nowIso();
  const stmts = [];
  for (const it of p.items) {
    let to = it.status;
    if (it.status === 'ordered') {
      const o = await env.DB.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(it.order_id).first();
      to = o && o.payment_status !== 'unpaid' ? 'paid' : 'quoted';
    }
    stmts.push(env.DB.prepare('UPDATE items SET cost = NULL, purchase_id = NULL, status = ?, status_at = ? WHERE id = ?').bind(to, to !== it.status ? now : null, it.id));
    if (to !== it.status) stmts.push(env.DB.prepare('INSERT INTO status_log (item_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)').bind(it.id, it.status, to, user.id, now));
  }
  stmts.push(env.DB.prepare('DELETE FROM purchases WHERE id = ?').bind(id));
  await env.DB.batch(stmts);
  return json({ ok: true });
}

// ---------- items ----------
async function listItems(env, url) {
  const q = normalize(url.searchParams.get('q') || '');
  const status = url.searchParams.get('status') || 'waiting';
  const where = [];
  const args = [];
  if (status === 'waiting') where.push(`i.status IN ('paid','ordered')`);
  else if (STATUSES.includes(status)) { where.push('i.status = ?'); args.push(status); }
  if (q) { where.push('i.search LIKE ?'); args.push(`%${q}%`); }
  const rows = (await env.DB.prepare(
    `SELECT i.*, o.code, o.customer_name, o.customer_phone, o.order_date, o.public_id, o.payment_status,
       (SELECT COUNT(*) FROM items x WHERE x.order_id = i.order_id) AS order_items,
       (SELECT COUNT(*) FROM items x WHERE x.order_id = i.order_id AND x.status IN ('arrived','received')) AS order_arrived
     FROM items i JOIN orders o ON o.id = i.order_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY o.order_date DESC, o.id DESC, i.position LIMIT 300`
  ).bind(...args).all()).results || [];
  const counts = (await env.DB.prepare('SELECT status, COUNT(*) AS n FROM items GROUP BY status').all()).results || [];
  return json({ items: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) });
}

async function bulkStatus(request, env, user) {
  const b = await readJson(request);
  const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => int(x)).filter(Boolean).slice(0, 300);
  if (!ids.length) throw bad('Chưa chọn món nào');
  if (!STATUSES.includes(b.status)) throw bad('Trạng thái không hợp lệ');
  const now = nowIso();
  const marks = ids.map(() => '?').join(',');
  const rows = (await env.DB.prepare(`SELECT id, status, order_id FROM items WHERE id IN (${marks})`).bind(...ids).all()).results || [];
  const stmts = [];
  for (const r of rows) {
    if (r.status === b.status) continue;
    stmts.push(env.DB.prepare('UPDATE items SET status = ?, status_at = ? WHERE id = ?').bind(b.status, now, r.id));
    stmts.push(env.DB.prepare('INSERT INTO status_log (item_id, from_status, to_status, user_id, at) VALUES (?, ?, ?, ?, ?)').bind(r.id, r.status, b.status, user.id, now));
  }
  if (b.shelf !== undefined) stmts.push(env.DB.prepare(`UPDATE items SET shelf = ? WHERE id IN (${marks})`).bind(str(b.shelf, 30), ...ids));
  if (stmts.length) await env.DB.batch(stmts);
  // recompute totals for affected orders (cancel/return changes totals)
  for (const oid of [...new Set(rows.map((r) => r.order_id))]) await recomputeTotals(env, oid);
  return json({ ok: true, changed: rows.length });
}

async function recomputeTotals(env, orderId) {
  const t = await env.DB.prepare(
    `SELECT COALESCE(SUM(price),0) AS p, COALESCE(SUM(shipping),0) AS s, COALESCE(SUM(fee),0) AS f
     FROM items WHERE order_id = ? AND status <> 'cancelled'`
  ).bind(orderId).first();
  await env.DB.prepare('UPDATE orders SET products_total=?, shipping_total=?, fee_total=?, grand_total=?, updated_at=? WHERE id=?')
    .bind(t.p, t.s, t.f, t.p + t.s + t.f, nowIso(), orderId).run();
}

async function updateItem(request, env, user, id) {
  const b = await readJson(request);
  const it = await env.DB.prepare('SELECT i.*, o.customer_name, o.customer_phone, o.code FROM items i JOIN orders o ON o.id = i.order_id WHERE i.id = ?').bind(id).first();
  if (!it) throw new HttpError(404, 'Không tìm thấy món');
  const next = {
    platform_order_id: b.platform_order_id !== undefined ? str(b.platform_order_id, 80) : it.platform_order_id,
    cost: b.cost !== undefined ? (b.cost === '' || b.cost == null ? null : Math.max(0, int(b.cost))) : it.cost,
    shelf: b.shelf !== undefined ? str(b.shelf, 30) : it.shelf,
  };
  const search = itemSearch({ ...it, ...next }, it.customer_name, it.customer_phone, it.code);
  await env.DB.prepare('UPDATE items SET platform_order_id = ?, cost = ?, shelf = ?, search = ? WHERE id = ?')
    .bind(next.platform_order_id, next.cost, next.shelf, search, id).run();
  if (b.status && STATUSES.includes(b.status) && b.status !== it.status) {
    const fake = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [id], status: b.status }) });
    await bulkStatus(fake, env, user);
  }
  return json({ ok: true });
}

// ---------- public quote page ----------
async function publicQuote(env, publicId, url) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE public_id = ?').bind(publicId).first();
  if (!order) return html(renderNotFound(), 404);
  const items = (await env.DB.prepare('SELECT * FROM items WHERE order_id = ? ORDER BY position, id').bind(order.id).all()).results || [];
  const settings = await getSettings(env);
  const returns = (await env.DB.prepare('SELECT * FROM returns WHERE order_id = ?').bind(order.id).all()).results || [];
  return html(renderPublicQuote({ order, items, settings, url: url.href, returns }));
}
