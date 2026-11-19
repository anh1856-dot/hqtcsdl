# App khách hàng – bản tham khảo (HTML/JS)

> ⚠️ **Đây không phải sản phẩm cuối.** App khách hàng chính thức làm bằng **Flutter** trong thư mục `mobile-app/`.
> Thư mục này giữ lại làm **bản mẫu tham khảo** cho nhóm app: luồng màn hình, cách gọi API, cách xử lý lỗi.
> Không sửa tiếp để nộp; khi app Flutter hoàn thiện có thể xoá thư mục này.

## Chạy thử

**Với backend thật** (nên dùng, dữ liệu từ SQL Server):

1. Chạy backend (`backend/README.md`), API ở `http://localhost:3000/api`.
2. Phục vụ thư mục này bằng một server tĩnh ở cổng **khác 3001**, ví dụ VS Code Live Server (cổng 5500) hoặc:
   `python -m http.server 5500 --directory app-customer` (chạy ở thư mục gốc repo)
3. Mở `http://localhost:5500`, đăng nhập tài khoản khách mẫu, ví dụ `an.le@example.test` / `Mushroom@123`.

**Với dữ liệu giả** (không cần backend): trong thư mục này chạy `node mock-server.js`, mở `http://localhost:3001`,
đăng nhập `an.le@example.test` / `123456`. Dữ liệu nằm trong RAM, tắt server là mất. Hoặc mở `index.html?demo=1`.

App tự chọn API: mở từ cổng 3001 thì dùng mock server, còn lại gọi `http://localhost:3000/api`
(đổi được ở màn hình đăng nhập).

## Màn hình và API tương ứng (dùng khi làm app Flutter)

| Màn hình | API (xem `backend/API.md`) |
|---|---|
| Đăng nhập / đăng ký | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` |
| Khay của tôi, chi tiết khay | `GET /my/trays`, `GET /my/trays/:id`, `POST /rentals/link` (nhập mã khay) |
| Môi trường, biểu đồ | `GET /environment`, `GET /environment/:roomId/history?hours=&groupBy=` |
| Thuê khay | `GET /packages`, `GET /trays/available?packageId=`, `POST /rentals` |
| Thu hoạch, giao nhận | `GET /my/harvests`, `POST /deliveries`, `PATCH /deliveries/:id/cancel` |
| Thông báo | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:id`, `GET/PUT /notifications/preferences` |
| Tài khoản | `PUT /auth/me`, `PUT /auth/me/password`, `GET /my/transactions`, `GET /rentals` |

## Bản này còn thiếu / sai (app Flutter cần làm đúng)

- **Giờ hiển thị sớm 7 tiếng:** `fmtDateTime` và biểu đồ (`js/app.js` dòng ~62 và ~421) dùng `getUTCHours()`.
  Backend trả thời điểm (`CreatedAt`, `PaidAt`, `RecordedAt`…) dạng ISO có `Z` → cần đổi sang **giờ máy**
  (Flutter: `DateTime.parse(v).toLocal()`).
- **Ngày** (`StartDate`, `EndDate`, `ScheduledDate`, `ExpectedHarvestDate`…) backend trả chuỗi `YYYY-MM-DD`:
  hiển thị thẳng, **không** đổi múi giờ.
- **Chưa có gia hạn đơn thuê** (BR14 / UC22): `POST /rentals/:id/extend { terms, paymentMethod }`.
  Đơn quá hạn mà khay còn đang trồng vẫn `Active` đến khi thu hoạch, nên hiện ghi chú cho khách.
- **Thuê gói quá ngắn so với loại nấm** → backend trả lỗi `DB_50009`. Hiện `error.message` cho người dùng,
  và nên gọi `/trays/available?packageId=` để chỉ hiện số khay thuê được với gói đã chọn.
- **Camera:** chỉ ở mức tham khảo (phòng có `CameraUrl` trong `/my/trays`), không cần màn hình phát video.
- Mock server (`mock-server.js`, `js/mock-api.js`) là dữ liệu giả, **không** dùng trong app thật.
