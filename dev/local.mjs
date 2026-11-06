// Local test server: runs src/worker.js on Node with a D1-compatible wrapper over node:sqlite.
// Usage: node dev/local.mjs [port]   (data in dev/local.sqlite)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const db = new DatabaseSync(process.env.DB_FILE || path.join(root, 'dev', 'local.sqlite'));

class Stmt {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.sql, args.map((a) => (a === undefined ? null : a))); }
  _s() { return db.prepare(this.sql); }
  async first(col) { const r = this._s().get(...this.args); if (!r) return null; return col ? r[col] : { ...r }; }
  async all() { return { success: true, results: this._s().all(...this.args).map((r) => ({ ...r })), meta: {} }; }
  async run() { const r = this._s().run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
  _exec() {
    if (/^\s*(select|with)/i.test(this.sql)) return { success: true, results: this._s().all(...this.args) };
    const r = this._s().run(...this.args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}
const DB = {
  prepare: (sql) => new Stmt(sql),
  async batch(stmts) {
    db.exec('BEGIN');
    try { const out = stmts.map((s) => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
  async exec(sql) { db.exec(sql); return { count: 1 }; },
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const ASSETS = {
  async fetch(req) {
    let p = new URL(req.url).pathname;
    if (p === '/') p = '/index.html';
    try {
      const body = await readFile(path.join(root, 'public', path.normalize(p)));
      return new Response(body, { headers: { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' } });
    } catch (_) {
      return new Response(await readFile(path.join(root, 'public', 'index.html')), { headers: { 'content-type': TYPES['.html'] } });
    }
  },
};
const env = { DB, ASSETS };
const port = +(process.argv[2] || 8787);
http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  const r = await worker.fetch(request, env, {});
  const headers = {};
  r.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(r.status, headers);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`An Thuong Order local: http://localhost:${port}`));
