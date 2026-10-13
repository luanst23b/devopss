# TechZone — cửa hàng công nghệ (MVP)

Mẫu website thương mại điện tử full-stack bằng React, Redux Toolkit, Tailwind CSS, Express và Microsoft SQL Server. Sử dụng SQL Server Management Studio (SSMS) để quản trị database. Đây là giao diện demo độc lập, lấy cảm hứng từ các mô hình bán lẻ điện tử phổ biến; không sử dụng thương hiệu, tài sản hay mã nguồn của Hoàng Hà Mobile.

## Cấu trúc dự án

```text
techzone/
├── start.bat
├── backend/
│   ├── scripts/{init-db,start-local}.js
│   ├── src/
│   │   ├── middleware/auth.js
│   │   ├── routes/{auth,orders,payments,products}.js
│   │   ├── db.js
│   │   └── server.js
│   └── package.json
├── database/
│   ├── schema.sql
│   └── seed.sql
└── frontend/
    ├── src/
    │   ├── components/{Footer,Header,ProductCard}.jsx
    │   ├── pages/{CartPage,HomePage,LoginPage,ProductDetailPage,ProductListPage,RegisterPage}.jsx
    │   ├── store/{authSlice,cartSlice,store}.js
    │   └── App.jsx
    └── .env.example
```

## Khởi động bằng terminal và SQL Server/SSMS

Yêu cầu: Node.js LTS và Microsoft SQL Server Database Engine đã cài, đang chạy. SSMS là chương trình quản lý database, không phải database server. Cấu hình mặc định dùng SQL Server Express instance `SQLEXPRESS`. Trên Windows có thể mở `start.bat` hoặc mở terminal tại thư mục dự án và chạy `npm start`. Chương trình chạy API và website trong cùng cửa sổ terminal; nhấn `Ctrl+C` để dừng cả hai.

Lần đầu chạy, chương trình dùng Windows Authentication của tài khoản đang chạy `start.bat` để tạo database `tech_store`, nạp schema và catalog 25 sản phẩm, rồi tạo tài khoản database riêng cho ứng dụng. Tài khoản Windows cần quyền quản trị trên SQL Server instance. Ứng dụng tạo mật khẩu riêng ngẫu nhiên và JWT secret, lưu cục bộ trong `backend/.env` (file này được Git bỏ qua); không lưu mật khẩu `sa`. Những lần chạy sau không cần cấu hình lại.

Website mở tại `http://localhost:5173` (tự chuyển sang `5174` nếu cổng 5173 đang bận). API health check: `http://localhost:4000/api/health`; kết quả thành công gồm `{"status":"ok","database":"connected"}`. SQL Server phải bật SQL Server Authentication (Mixed Mode) và dịch vụ SQL Server Browser; nếu dùng instance khác, cập nhật `DB_SERVER` và `DB_INSTANCE` trong `backend/.env`.

Để xem dữ liệu trong SSMS, kết nối tới `TEN-MAY\\SQLEXPRESS` bằng tài khoản SQL Server, rồi mở database `tech_store`. Script tạo bảng là `database/schema.sql`, dữ liệu mẫu là `database/seed.sql`. Nếu chưa cài dependencies, chạy `npm install` trong cả thư mục `backend` và `frontend`, sau đó chạy lại `start.bat`. Không cần Docker hay MySQL.

## Deploy lên Render

Backend này dùng Microsoft SQL Server; Render không cung cấp SQL Server managed database. Hãy chuẩn bị một SQL Server có thể truy cập từ Internet (ví dụ Azure SQL) và tạo database `tech_store` trước. Với Azure SQL Database, kết nối SSMS trực tiếp tới database đó, chạy `database/schema.sql` sau khi bỏ phần đầu tạo database/chuyển database (`IF DB_ID...` và `USE [tech_store]`), rồi chạy `database/seed.sql` sau khi bỏ dòng `USE [tech_store]` đầu tiên. Cấu hình firewall của SQL Server để cho phép kết nối từ Render. Không dùng `localhost`, `SQLEXPRESS` hay Windows Authentication trên Render; tiến trình Render chạy trên Linux và không thể truy cập SQL Server trên máy cá nhân. PostgreSQL của Render không tương thích với các truy vấn và schema T-SQL của dự án.

Tạo một **Web Service** trên Render, chọn thư mục gốc `backend`, build command `npm install` và start command `npm start`. Trong **Environment**, khai báo:

- `DB_SERVER`: hostname của SQL Server, ví dụ hostname Azure SQL (không kèm `tcp:` hoặc `,1433`)
- `DB_PORT`: `1433` (không khai báo `DB_INSTANCE`)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`: database đã tạo và thông tin đăng nhập SQL
- `DB_ENCRYPT`: `true`
- `DB_TRUST_SERVER_CERTIFICATE`: `false`
- `JWT_SECRET`: một chuỗi bí mật ngẫu nhiên dài, không dùng giá trị mẫu trong `.env.example`
- `CLIENT_ORIGIN`: URL HTTPS chính xác của frontend đã deploy, không có dấu `/` cuối

Render cấp `PORT` tự động; không cần đặt biến này. Có thể đặt health check path là `/api/health`. Endpoint báo khỏe khi SQL Server cũng đã kết nối được. Deploy frontend riêng dưới dạng **Static Site** với thư mục gốc `frontend`, build command `npm install && npm run build`, publish directory `dist`, và biến build-time `VITE_API_URL=https://<URL-backend-render>/api`. Sau khi Static Site được tạo, đặt `CLIENT_ORIGIN` của backend bằng URL frontend rồi deploy lại backend.

Không chép toàn bộ `.env.example` vào Render: các giá trị `localhost`/`SQLEXPRESS` chỉ dành cho máy Windows cục bộ. `DB_PORT` được dùng thay cho `DB_INSTANCE` khi kết nối SQL Server được host bên ngoài; TLS được bật mặc định trong cấu hình kiểu host/port.

Seed kèm sản phẩm minh họa trải đều theo điện thoại, laptop, tablet, đồng hồ và phụ kiện. Trang danh sách có tìm kiếm, lọc danh mục/hãng/khoảng giá, sắp xếp và xem thêm; trang chi tiết trình bày mô tả, thông số, điểm nổi bật và phiên bản mẫu. Khách cần đăng nhập hoặc đăng ký trước khi mua/thêm giỏ; sản phẩm vừa chọn được giữ lại để tiếp tục sau khi xác thực.

## REST API mẫu

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/products?q=&category=&brand=&minPrice=&maxPrice=&sort=&page=&limit=`
- `GET /api/products/suggestions?q=`, `GET /api/products/:id`
- `POST /api/orders` (JWT; khóa tồn kho và ghi đơn trong một transaction), `GET /api/orders/mine` (lịch sử đơn và chi tiết sản phẩm), `PATCH /api/orders/:id/cancel` (chủ đơn chỉ hủy khi đang chờ xác nhận/đã xác nhận; tồn kho được hoàn lại trong transaction)
- `POST /api/payments/mock/:orderId/confirm` (chỉ mô phỏng)
- API quản trị cần JWT của tài khoản có role `admin`: `GET /api/admin/summary?period=7d` (hoặc `period=30d`, có chuỗi số liệu theo ngày), `/products`, `/orders`, `/catalog-options`; `POST`/`PUT`/`DELETE /api/admin/products`; `PATCH /api/admin/orders/:id/status`.

## Trang quản trị

Đăng ký tài khoản trên website trước, sau đó trong SSMS kết nối tới database `tech_store` bằng tài khoản quản trị SQL Server và cấp role cho chính email vừa đăng ký:

```sql
UPDATE dbo.users
SET role = 'admin'
WHERE email = N'email-cua-ban@example.com';
```

Đăng xuất rồi đăng nhập lại. Tài khoản admin sẽ được đưa tới `/admin`; có thể vào trang này từ liên kết **Quản trị** trên header. Bảng điều khiển cho phép lọc số liệu và biểu đồ doanh thu/đơn hàng theo 7 hoặc 30 ngày, thêm/sửa/ẩn sản phẩm và cập nhật trạng thái đơn hàng. API kiểm tra role hiện tại trong database cho mọi yêu cầu quản trị; không thể tự cấp quyền admin bằng form đăng ký.

Khách đã đăng nhập có thể mở **Đơn hàng** trên thanh đầu trang, hoặc vào **Tài khoản → Theo dõi đơn hàng**, để xem trạng thái, mặt hàng, địa chỉ giao và tổng tiền. Có thể hủy đơn khi đơn đang chờ xác nhận hoặc đã xác nhận; khi đơn bắt đầu giao, thao tác hủy trực tuyến sẽ bị khóa. Nếu đơn đã thanh toán trước, hệ thống demo báo khách liên hệ cửa hàng để xử lý hoàn tiền.

## Lưu ý production

- Tích hợp VNPay/MoMo thật cần ký/kiểm tra callback theo tài liệu của cổng thanh toán; tuyệt đối không tin trạng thái thanh toán do trình duyệt gửi.
- Bổ sung xác minh email, giới hạn tốc độ đăng nhập, CSRF nếu dùng cookie, quản lý refresh token, logging/audit, kiểm thử, phân quyền API quản trị và chính sách xóa dữ liệu.
- JWT hiện lưu ở localStorage nhằm đơn giản hóa MVP; ứng dụng production nên đánh giá cookie `HttpOnly; Secure; SameSite` và chiến lược refresh/token rotation.
- Seed dữ liệu danh mục/sản phẩm riêng theo catalog thực tế. Trong checkout cần chỉ nhận product/variant ID và quantity từ client; giá được truy xuất và tính lại từ database.
