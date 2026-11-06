// Demo data: 30 customers with realistic orders, payments and purchase blocks.
// Generated one customer per request to stay well under D1 per-request query limits.

export const DEMO_COUNT = 30;

const CUSTOMERS = [
  ['An Tran', '+84 905 112 334', 'VIP — đặt nhiều, chia nhiều lượt'],
  ['Emma Wilson', '+44 7700 900 412', ''],
  ['Lucas Martin', '+33 6 12 34 56 78', 'Thích trả bằng Wise'],
  ['Hana Kim', '+82 10 2345 6789', ''],
  ['Oliver Brown', '+61 412 555 019', 'Ở Muong Thanh, phòng 1203'],
  ['Sofia Rossi', '+39 347 123 4567', ''],
  ['Daniel Novak', '+420 601 234 567', 'Hay đổi màu — xác nhận phân loại trước khi đặt'],
  ['Mia Schneider', '+49 1512 3456789', ''],
  ['Noah Johnson', '+1 (415) 555-0136', ''],
  ['Yuki Tanaka', '+81 90 1234 5678', 'Chỉ nói tiếng Anh'],
  ['Liam O\'Connor', '+353 85 123 4567', ''],
  ['Chloe Martin', '+33 7 81 22 33 44', ''],
  ['Ivan Petrov', '+7 916 123 45 67', 'Lấy hàng buổi tối'],
  ['Grace Lee', '+1 (212) 555-0182', ''],
  ['Mateo Garcia', '+34 612 34 56 78', ''],
  ['Ava Thompson', '+61 433 222 118', 'Trả tiền mặt tại quán'],
  ['Felix Bauer', '+43 664 1234567', ''],
  ['Nina Kowalski', '+48 512 345 678', ''],
  ['Ethan Clark', '+1 (646) 555-0199', ''],
  ['Lea Dubois', '+32 470 12 34 56', ''],
  ['Sam Wright', '+44 7911 123456', 'Khách quen, hay mua đồ bếp'],
  ['Anya Ivanova', '+7 925 765 43 21', ''],
  ['Jonas Berg', '+46 70 123 45 67', ''],
  ['Isabella Costa', '+351 912 345 678', ''],
  ['Ryan Murphy', '+1 (310) 555-0147', ''],
  ['Mei Chen', '+886 912 345 678', ''],
  ['Arjun Patel', '+91 98765 43210', ''],
  ['Zoe Taylor', '+64 21 123 4567', 'Dị ứng mùi thơm — tránh sản phẩm có hương liệu'],
  ['Max Fischer', '+49 1520 9876543', ''],
  ['Olga Smirnova', '+7 903 555 12 34', ''],
];

// [name EN, name VI, variations, unit price, platform, shipping]
const PRODUCTS = [
  ['The T10 ergonomic chair, self-adjusting lumbar support', 'Ghế công thái học T10', ['T9-Pro-6d Black', 'T9-Pro White'], 3699000, 'shopee', 14500],
  ['Xpanse F3 gaming desk, flip-top lid, cable management', 'Bàn gaming Xpanse F3', ['[Upgraded] F3, 160×60cm', 'F3, 140×60cm'], 1689000, 'shopee', 11500],
  ['Mishio MK373 Air Fryer with glass inner pot, 7L', 'Nồi chiên không dầu Mishio MK373', ['Black', 'White'], 999000, 'shopee', 0],
  ['Tiross 3-in-1 grilled sandwich & waffle maker TS9655', 'Máy nướng bánh Tiross 3 in 1', ['12-month warranty'], 1139000, 'shopee', 0],
  ['PHILIPS HR2222/00 Blender 700W, crushes ice', 'Máy xay sinh tố Philips HR2222', ['24-month warranty'], 1299000, 'shopee', 0],
  ['Plain paisley bandana with round earrings', 'Khăn bandana hoạ tiết', ['White', 'Black', 'Red'], 29000, 'lazada', 18000],
  ['Sparkle Super Whitening Toothpaste, Thai', 'Kem đánh răng Sparkle Thái Lan', ['Fresh White'], 83000, 'shopee', 0],
  ['Ultra Boost 4.0 sneakers', 'Giày thể thao Ultra Boost 4.0', ['Full Black - 42', 'White - 41', 'Grey - 43'], 517000, 'shopee', 0],
  ['Celimax Toner Pads, pore & dark spot (40 pads)', 'Toner pad Celimax', [''], 308000, 'shopee', 0],
  ['NOW L-Theanine 200mg stress relief tablets', 'Viên uống NOW L-Theanine', ['60 tablets'], 688000, 'shopee', 0],
  ['Fixodent Original Denture Adhesive Cream', 'Kem dán răng giả Fixodent', ['Set of 3 tubes - 68g'], 592000, 'shopee', 0],
  ['KEMEI KM-T86 Wet and Dry Shaver, IPX6', 'Máy cạo râu Kemei KM-T86', [''], 579000, 'shopee', 0],
  ['Omo laundry detergent, large bag', 'Bột giặt Omo túi lớn', ['2.9kg', '4.1kg'], 171514, 'shopee', 0],
  ['80000mAh 120W Power Bank, PD20W fast charging', 'Pin sạc dự phòng 80000mAh', ['Black', 'White'], 351778, 'shopee', 0],
  ['Comfort Pure Fabric Softener, concentrated', 'Nước xả vải Comfort đậm đặc', ['Pure 3.6L'], 292000, 'shopee', 0],
  ['Golf putting mat, premium felt', 'Thảm tập golf tại nhà', ['3m long', '2m long'], 855000, 'shopee', 0],
  ['Super bright flashlight, 300m beam, zoom', 'Đèn pin siêu sáng', [''], 121600, 'shopee', 0],
  ['Satin sleeping bonnet, adjustable band', 'Mũ trùm tóc satin', ['Pink watermelon', 'Black'], 83000, 'shopee', 0],
  ['Nupur henna powder for hair, 150g', 'Bột henna nhuộm tóc Nupur', [''], 95000, 'shopee', 0],
  ['Usborne Phonics Readers, 20 books + mp3', 'Bộ sách Usborne Phonics', ['Full boxset'], 637000, 'shopee', 0],
  ['Magnetic alphabet & number board', 'Bảng chữ cái nam châm', ['Combo 2'], 171000, 'shopee', 0],
  ['Bath toys watering cans for babies', 'Đồ chơi nhà tắm cho bé', ['Blue Elephant', 'Yellow Duck'], 64800, 'shopee', 0],
  ['Kids cooking toy set with smoke & sounds', 'Bộ đồ chơi nấu ăn cho bé', ['Pink 80CM'], 532000, 'shopee', 0],
  ["Men's short-sleeved linen set", 'Bộ đồ linen nam ngắn tay', ['Size L', 'Size XL'], 152500, 'shopee', 0],
  ['Black rubber rain boots, anti-slip', 'Ủng cao su đi mưa', ['42, Black', '40, Black'], 54000, 'lazada', 37000],
  ['LUMABELLA 700W sandwich toaster', 'Máy nướng bánh mì Lumabella', ['White'], 525000, 'lazada', 0],
  ['Silicone bathroom floor drain cover', 'Nắp chặn cống silicone', [''], 21000, 'shopee', 0],
  ['G Hughes Sugar Free BBQ Sauce', 'Sốt BBQ không đường G Hughes', ['Hickory', 'Original'], 663000, 'shopee', 0],
  ['DJI Mic receiver (no box)', 'Bộ thu DJI Mic', [''], 570000, 'shopee', 0],
  ['TELESIN chest strap mount for GoPro & phones', 'Dây đeo ngực Telesin', ['V2 + phone mount'], 194650, 'shopee', 0],
  ['NOW Alpha GPC tablets', 'Viên uống NOW Alpha GPC', ['60 tablets'], 1227000, 'shopee', 0],
  ['Topps Turbo Attax 2026 F1 Mega Tin', 'Hộp thẻ Topps F1 2026', ['Guardian of the Grid', 'Sunshine State'], 836000, 'shopee', 0],
  ['3-tier steel shoe rack', 'Kệ giày 3 tầng', ['Black 3-tier'], 99000, 'lazada', 22000],
  ['NITORI clothes drying rack', 'Giá phơi đồ Nitori', ['BK 2'], 629000, 'tiki', 0],
  ['Celimax Retinal Shot Tightening Booster', 'Serum Celimax Retinal', ['15ml'], 389000, 'shopee', 0],
  ['Lock&Lock glass food containers, set of 5', 'Bộ hộp thuỷ tinh Lock&Lock', ['5 pcs'], 459000, 'shopee', 0],
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plan one demo customer (pure function — no DB). */
export function planDemoCustomer(idx, seed, fees, todayISO) {
  const r = rng(seed * 7919 + idx * 104729 + 1);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const [name, phone, note] = CUSTOMERS[idx % CUSTOMERS.length];
  const fresh = [2, 9, 16, 26].includes(idx); // brand-new quotes, not paid yet
  const daysAgo = idx === 0 ? 3 : fresh ? Math.floor(r() * 2) : Math.floor(r() * 42);
  const date = shiftDate(todayISO, -daysAgo);
  const counts = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7, 8];
  const n = idx === 0 ? 10 : pick(counts);
  const pool = [...PRODUCTS].sort(() => r() - 0.5);
  const items = [];
  for (let k = 0; k < n; k++) {
    const p = pool[k % pool.length];
    const qty = p[3] < 100000 ? 1 + Math.floor(r() * 4) : r() < 0.85 ? 1 : 2;
    const platform = p[4];
    const rule = fees[platform] || fees.other;
    items.push({
      name: p[0], name_vi: p[1], variation: pick(p[2]), qty, unit_price: p[3], price: p[3] * qty, platform,
      shipping: p[5], fee: k === 0 ? rule.first : rule.add,
      link: platform === 'shopee' ? `https://shopee.vn/${encodeURIComponent(p[1].replace(/\s+/g, '-'))}-i.${100000000 + Math.floor(r() * 899999999)}.${10000000000 + Math.floor(r() * 8999999999)}` : '',
    });
  }
  const grand = items.reduce((a, i) => a + i.price + i.shipping + i.fee, 0);

  // lifecycle by age
  let stage; // 0 quoted, 1 paid, 2 partly ordered, 3 ordered, 4 some arrived, 5 all received
  if (fresh) stage = 0;
  else if (daysAgo <= 1) stage = r() < 0.6 ? 0 : 1;
  else if (daysAgo <= 4) stage = idx === 0 ? 2 : r() < 0.5 ? 2 : 3;
  else if (daysAgo <= 10) stage = r() < 0.5 ? 3 : 4;
  else if (daysAgo <= 20) stage = r() < 0.5 ? 4 : 5;
  else stage = 5;

  const payment = stage === 0 ? null : {
    amount: r() < 0.25 ? Math.ceil(grand / 10000) * 10000 : grand,
    method: pick(['cash', 'cash', 'wise', 'bank']),
    received_at: shiftDate(date, r() < 0.7 ? 0 : 1),
  };

  // purchase blocks (one customer per block)
  const blocks = [];
  if (stage >= 2) {
    const sizes = idx === 0 ? [3, 4, 3] : [];
    if (!sizes.length) { let left = n; while (left > 0) { const s = Math.min(left, 1 + Math.floor(r() * 4)); sizes.push(s); left -= s; } }
    let at = 0;
    const blocksToOrder = stage === 2 ? Math.max(1, Math.floor(sizes.length / 2)) : sizes.length;
    sizes.forEach((s, b) => {
      const idxs = []; for (let k = 0; k < s; k++) idxs.push(at + k); at += s;
      if (b >= blocksToOrder) return;
      const quoted = idxs.reduce((a, k) => a + items[k].price + items[k].shipping, 0);
      const discount = 0.03 + r() * 0.12;
      const paid = Math.round((quoted * (1 - discount)) / 1000) * 1000;
      blocks.push({
        idxs, quoted, paid, purchased_at: shiftDate(date, Math.min(daysAgo, Math.floor(r() * 3))),
        platform_order_id: `${todayISO.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}${Math.floor(r() * 9)}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        note: pick(['', '', 'voucher 50k', 'freeship xtra + voucher 10%', 'voucher shop 30k', 'flash sale']),
      });
    });
  }
  // status per item
  const statusOf = new Array(n).fill(stage === 0 ? 'quoted' : 'paid');
  const statusAt = new Array(n).fill(date);
  for (const bl of blocks) for (const k of bl.idxs) { statusOf[k] = 'ordered'; statusAt[k] = bl.purchased_at; }
  if (stage >= 4) {
    blocks.forEach((bl) => {
      const arr = shiftDate(bl.purchased_at, 3 + Math.floor(r() * 4));
      if (arr > todayISO) return;
      const arrived = stage === 5 || r() < 0.6;
      if (!arrived) return;
      for (const k of bl.idxs) {
        statusOf[k] = stage === 5 ? 'received' : 'arrived';
        statusAt[k] = stage === 5 ? shiftDate(arr, 1 + Math.floor(r() * 2)) : arr;
        if (statusAt[k] > todayISO) statusAt[k] = todayISO;
      }
    });
  }
  return { name, phone, note, date, items, payment, blocks, statusOf, statusAt };
}

export function shiftDate(iso, days) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
