# An Thuong Order — App quản lý báo giá & đơn hàng

App nội bộ cho **An Thuong Order @ Linz Coffee**. Chạy trên **Cloudflare Workers + D1**, không cần build, không có dependency.

**Phiên bản:** 0.5.3 (hiện ở màn đăng nhập)

## Tính năng bản 0.1.0
- Đăng nhập bằng username/mật khẩu (PBKDF2, khoá 15 phút sau 5 lần sai), phiên 30 ngày.
- **Admin**: tạo user, đặt lại mật khẩu, khoá user, phân quyền (`Tạo/sửa báo giá`, `Đơn hàng & tra cứu`, `Cài đặt phí`, `Quản lý user`).
- **Tạo báo giá**: gợi ý khách cũ, dán link → tự nhận Shopee/Lazada/Tiki và tự lấy tên tiếng Việt từ link, phí dịch vụ tự tính theo từng sàn (Shopee: 25k món đầu, Lazada: 35k món đầu; +15k mỗi món thêm cùng sàn), nhập giá kiểu `892k`, `1.5tr`.
  Phím tắt: `Ctrl+Enter` thêm món, `Ctrl+S` lưu, `Ctrl+D` nhân đôi món.
- **Ảnh báo giá dọc** (2 dòng/món, 1080px): 11 món/ảnh, đơn dài tự chia ảnh 1/2, 2/2. Nút Copy ảnh, Tải ảnh, Copy ảnh + mở WhatsApp, Chia sẻ (mobile).
- **Link báo giá cho khách** `/q/XXXXXX`: trang mobile-first tiếng Anh, hiện tiến độ từng món (Paid → Ordered → Arrived → Picked up), cách trả tiền (tiền mặt, Wise).
- **Tra cứu hàng về**: tìm theo tên hàng (có/không dấu), mã đơn Shopee, tên/số khách; đổi trạng thái nhiều món (`A` = về quán, `R` = khách lấy); nhắn báo khách qua WhatsApp.
- **Đơn hàng** theo tháng, **Cài đặt** phí & thông tin in trên ảnh.
- **Tiền khách trả** (tiền mặt / Wise / chuyển khoản), **Đặt hàng** theo lượt (mỗi lượt 1 khách, chia tiền thực trả theo tỉ lệ giá báo), **lãi lỗ** theo đơn, khách, tháng.
- **Khách hàng**: số điện thoại, ghi chú nội bộ (hiện khi tạo báo giá), lịch sử đơn, tổng mua, lãi.
- **Việc hôm nay** (màn hình mở đầu): nhắc khách trả tiền, đơn cần đặt, hàng đặt lâu chưa về, hàng về khách chưa lấy — kèm nút nhắn WhatsApp.
- **Báo cáo lãi**: biểu đồ lãi theo tháng (phí dịch vụ + chênh lệch voucher), tiền nhận theo hình thức, top khách, bảng từng tháng.
- **Thu tiền & đối soát**: tiền mặt / Wise / chuyển khoản theo ngày, tiền mặt phải có trong két, chốt sổ và lịch sử chênh lệch.
- **Trả hàng / hoàn tiền**: phí trả hàng (mặc định 15k), tiền hoàn khách, tiền sàn hoàn lại; lãi lỗ tự trừ đúng.
- **Dữ liệu demo**: Cài đặt → Tạo dữ liệu demo (30 khách) / Xoá dữ liệu demo.

## Deploy lên Cloudflare (làm 1 lần)
1. GitHub → repo → **Settings → General → Danger Zone → Change visibility → Private**.
2. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → chọn `duycan2000/anthuongorder.com`.
   Giữ mặc định: Build command để trống, Deploy command `npx wrangler deploy`. Bấm **Deploy**.
3. Database D1 `anthuongorder-db` được Wrangler tự tạo khi deploy lần đầu. Bảng dữ liệu và user admin được tạo tự động ở lần mở app đầu tiên.
   Nếu deploy báo lỗi thiếu `database_id`: vào **Storage & Databases → D1 → Create** tên `anthuongorder-db`, copy ID và thêm `"database_id": "<ID>"` vào `wrangler.jsonc`.
4. Tên miền: Worker → **Settings → Domains & Routes → Add → Custom domain** → `app.anthuongorder.com` (tên miền `anthuongorder.com` cần dùng DNS của Cloudflare).
5. Mở app, đăng nhập `duycan2000` / `123456` → **đổi mật khẩu ngay** (Tài khoản → Đổi mật khẩu).
6. Vào **Cài đặt**: điền thông tin Wise, và "Tên miền link báo giá" = `https://app.anthuongorder.com`.

Mỗi lần push lên nhánh `main`, Cloudflare tự build và deploy lại.

## App Android (APK)
- Thư mục `android/`: app Android mở `https://app.anthuongorder.com` toàn màn hình, giữ đăng nhập, mở link WhatsApp / Shopee / Maps bằng app tương ứng, nút **Gửi ảnh qua WhatsApp** gửi thẳng ảnh báo giá vào chat của khách, **Lưu ảnh** vào Thư viện.
- Mỗi lần sửa `android/**` và push, GitHub Actions (`.github/workflows/android.yml`) tự build APK đã ký và đưa vào `public/download/anthuongorder.apk` → Cloudflare deploy → link **Tải app Android** ở trang đăng nhập.
- Có thể chạy tay: GitHub → Actions → *Android APK* → *Run workflow*.
- Khoá ký: `android/signing/release.jks` (alias `atorder`). Giữ repo ở chế độ **Private**. Có thể đặt secret `ANDROID_KEYSTORE_PASSWORD` để không dùng mật khẩu mặc định trong workflow.
- Cài lần đầu: Android sẽ hỏi cho phép "Cài ứng dụng không rõ nguồn gốc" cho trình duyệt — chọn Cho phép.

## Chạy thử trên máy
```bash
node dev/local.mjs        # http://localhost:8787  (Node 22.5+, dữ liệu ở dev/local.sqlite)
```

## Cấu trúc
```
src/worker.js        API, đăng nhập, phân quyền, router
src/schema.js        bảng D1 + cài đặt mặc định
src/public-quote.js  trang báo giá cho khách /q/:id
public/              app (index.html, app.js, app.css, quote-image.js vẽ ảnh báo giá)
dev/local.mjs        server chạy thử với SQLite của Node
```
