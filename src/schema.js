// Database schema for Cloudflare D1 (SQLite).
// Each statement runs on its own; all are idempotent (IF NOT EXISTS).
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    perms TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    pw_changed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    first_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    note TEXT,
    search TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    public_id TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    customer_name TEXT,
    customer_phone TEXT,
    order_date TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    note TEXT,
    products_total INTEGER NOT NULL DEFAULT 0,
    shipping_total INTEGER NOT NULL DEFAULT 0,
    fee_total INTEGER NOT NULL DEFAULT 0,
    grand_total INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    link TEXT,
    platform TEXT NOT NULL DEFAULT 'shopee',
    name TEXT,
    name_vi TEXT,
    variation TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL DEFAULT 0,
    shipping INTEGER NOT NULL DEFAULT 0,
    fee INTEGER NOT NULL DEFAULT 0,
    fee_manual INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'quoted',
    status_at TEXT,
    platform_order_id TEXT,
    cost INTEGER,
    shelf TEXT,
    search TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    user_id INTEGER,
    at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    received_at TEXT NOT NULL,
    note TEXT,
    user_id INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    platform TEXT,
    platform_order_id TEXT,
    purchased_at TEXT NOT NULL,
    quoted_amount INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    user_id INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    prev_status TEXT,
    return_fee INTEGER NOT NULL DEFAULT 0,
    refund_amount INTEGER NOT NULL DEFAULT 0,
    refund_method TEXT NOT NULL DEFAULT 'cash',
    platform_refund INTEGER NOT NULL DEFAULT 0,
    refunded_at TEXT NOT NULL,
    note TEXT,
    user_id INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cash_closings (
    date TEXT PRIMARY KEY,
    expected INTEGER NOT NULL DEFAULT 0,
    counted INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    user_id INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(received_at)`,
  `CREATE INDEX IF NOT EXISTS idx_items_order ON items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchased_at)`,
  `CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date)`,
  `CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`,
];

// Column additions for databases created by older versions (errors = already applied).
export const MIGRATIONS = [
  `ALTER TABLE items ADD COLUMN purchase_id INTEGER`,
  `CREATE INDEX IF NOT EXISTS idx_items_purchase ON items(purchase_id)`,
  `ALTER TABLE customers ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE purchases ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE items ADD COLUMN variation2 TEXT`,
];
// bump when SCHEMA or MIGRATIONS change, so the schema check is skipped on normal requests
export const SCHEMA_VERSION = '5';

export const DEFAULT_SETTINGS = {
  fees: {
    shopee: { first: 25000, add: 15000, ship: 0, ret: 15000 },
    lazada: { first: 35000, add: 15000, ship: 0, ret: 15000 },
    tiki: { first: 35000, add: 15000, ship: 0, ret: 15000 },
    other: { first: 35000, add: 15000, ship: 0, ret: 15000 },
  },
  reminders: { unpaid_days: 2, order_days: 7, pickup_days: 3 },
  shop: {
    name: 'AN THUONG ORDER',
    tagline: 'Your local shopping assistant · Linz Coffee, 42 An Thuong 2',
    address: 'Linz Coffee, 42 An Thuong 2, Da Nang',
    whatsapp: '+84 567 920 087',
    payment: 'Cash at Linz Coffee, or via Wise.',
    wise: '',
    footer: 'We order after payment and message you when it arrives.',
    public_base: '',
    map_url: 'https://www.google.com/maps/place/An+Thuong+Order+-+Shopping+assistant+for+expats,+An+Th%C6%B0%E1%BB%A3ng+2,+Ngu+Hanh+Son,+Da+Nang/@16.0502557,108.2496147,15z/data=!4m2!3m1!1s0x3142177dcc0d9ccf:0xdfea7641997af543',
  },
};
