# Tài liệu API – Mushroom Farm

Base URL: `http://localhost:3000/api`

## Quy ước chung

**Xác thực:** gọi `POST /auth/login` lấy `token`, các request sau gửi header:

```
Authorization: Bearer <token>
```

**Thành công:**

```json
{ "data": { ... } }
```

Danh sách có phân trang (`?page=1&pageSize=20`):

```json
{ "data": [ ... ], "pagination": { "page": 1, "pageSize": 20, "total": 57 } }
```

**Lỗi:** luôn có `error.message` tiếng Việt để hiển thị thẳng cho người dùng.

```json
{ "error": { "code": "DB_50004", "message": "Không đủ khay trống. Yêu cầu 7, còn 6." } }
```

| HTTP | Ý nghĩa |
|---|---|
| 400 | Dữ liệu gửi lên sai / thiếu |
| 401 | Chưa đăng nhập, token sai/hết hạn, tài khoản bị khoá → chuyển về màn hình đăng nhập |
| 403 | Không có quyền |
| 404 | Không tìm thấy |
| 409 | Xung đột nghiệp vụ (trùng, hết khay, sai trạng thái…) |

**Vai trò:** `Admin`, `Operator` (gọi chung là *Staff*), `Customer`. Cột **Quyền** bên dưới: `Public` = không cần đăng nhập.

**Giá trị cố định (enum):**

| Trường | Giá trị |
|---|---|
| Trạng thái khay | `Available`, `Rented`, `Growing`, `ReadyToHarvest`, `Harvested`, `Maintenance` |
| Giai đoạn | `Inoculation` (cấy giống) → `Incubation` (ủ tơ) → `Pinning` (ra nụ) → `Fruiting` (quả thể) → `Harvest` |
| Phương thức thanh toán | `Cash`, `BankTransfer`, `EWallet`, `Card` |
| Loại thiết bị | `Sensor`, `MistSprayer`, `Fan`, `Heater`, `GrowLight`, `Camera` |
| Loại thông báo | `Alert`, `Progress`, `HarvestReady`, `Rental`, `Delivery`, `System` |
| Giao nhận | `Pickup` / `Delivery`; trạng thái `Pending` → `Confirmed` → `Shipping` → `Completed` (hoặc `Cancelled`) |

Ngày gửi lên dạng `YYYY-MM-DD`. Tên trường trả về theo tên cột trong database (PascalCase, vd `TrayCode`).

---

## 1. Xác thực – `/auth`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| POST | `/auth/register` | Public | `{ fullName, email, password, phone?, address? }` → `{ token, user }` (tạo tài khoản Customer) |
| POST | `/auth/login` | Public | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Đã đăng nhập | Hồ sơ của tôi (`Role` để hiện menu theo vai trò) |
| PUT | `/auth/me` | Đã đăng nhập | `{ fullName?, phone?, address?, avatarUrl? }` |
| PUT | `/auth/me/password` | Đã đăng nhập | `{ currentPassword, newPassword }` |

## 2. Tài khoản – `/users`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/users?role=&status=&q=&page=` | Admin, Operator | Operator chỉ thấy Customer (để gán khay). `q` tìm theo tên/email/SĐT |
| GET | `/users/:id` | Admin | |
| POST | `/users` | Admin | `{ fullName, email, password, role, phone?, address? }` |
| PUT | `/users/:id` | Admin | `{ fullName?, phone?, address?, role? }` |
| PATCH | `/users/:id/status` | Admin | `{ status: "Active" \| "Disabled" }` – khoá / mở khoá |
| PUT | `/users/:id/password` | Admin | `{ newPassword }` – đặt lại mật khẩu |
| DELETE | `/users/:id` | Admin | Xoá mềm (giữ lịch sử) |

## 3. Phòng nuôi – `/rooms`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/rooms` | Staff | Kèm `TrayCount`, `AvailableTrays`, `InUseTrays` |
| GET | `/rooms/:id` | Staff | Kèm `thresholds`, `devices`, `environment` (mới nhất) |
| POST | `/rooms` | Staff | `{ roomCode, roomName, capacity, description?, status? }` |
| PUT | `/rooms/:id` | Staff | `{ roomName?, capacity?, description?, status? }` – status: `Active`, `Maintenance`, `Inactive` |
| DELETE | `/rooms/:id` | Admin | Chỉ xoá được phòng chưa có khay |
| GET | `/rooms/:id/thresholds` | Staff | |
| PUT | `/rooms/:id/thresholds` | Admin | `[{ metric: "Temperature"\|"Humidity"\|"CO2", minValue, maxValue }]` |

## 4. Loại nấm – `/mushroom-types`

| Method | Đường dẫn | Quyền | Body |
|---|---|---|---|
| GET | `/mushroom-types` | Đã đăng nhập | |
| POST | `/mushroom-types` | Admin | `{ typeName, growthDays, expectedYieldKg?, description?, imageUrl? }` |
| PUT | `/mushroom-types/:id` | Admin | như trên, tuỳ chọn |
| DELETE | `/mushroom-types/:id` | Admin | 409 nếu đang được khay dùng |

## 5. Khay & canh tác – `/trays`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/trays/available` | Đã đăng nhập | Số khay trống theo phòng + loại nấm (khách xem trước khi thuê) |
| GET | `/trays?roomId=&status=&q=` | Staff | Kèm khách đang thuê, ngày thu hoạch dự kiến, `DaysToHarvest` |
| GET | `/trays/:id` | Staff | Kèm `growthLogs`, `harvests` |
| POST | `/trays` | Staff | `{ roomId, quantity?, mushroomTypeId?, positionLabel? }` – mã khay tự sinh `TRAY-R01-013` |
| PUT | `/trays/:id` | Staff | `{ roomId?, mushroomTypeId?, positionLabel? }` |
| PATCH | `/trays/:id/status` | Staff | `{ status: "Available" \| "Maintenance" }` – dọn khay sau thu hoạch / bảo trì |
| DELETE | `/trays/:id` | Admin | Chỉ khay chưa từng sử dụng |
| POST | `/trays/:id/start` | Staff | `{ mushroomTypeId, note? }` – bắt đầu vụ trồng |
| POST | `/trays/:id/stage` | Staff | `{ stage, note?, imageUrl? }` – chỉ đi tới; `Harvest` tự tạo lịch thu hoạch |
| POST | `/trays/:id/logs` | Staff | `{ note, imageUrl? }` – ghi nhật ký không đổi giai đoạn |
| POST | `/trays/:id/harvest` | Staff | `{ weightKg, quality: "A"\|"B"\|"C", note? }` |

## 6. Gói thuê – `/packages`

| Method | Đường dẫn | Quyền | Body |
|---|---|---|---|
| GET | `/packages` | **Public** | Gói đang áp dụng |
| GET | `/packages/all` | Admin | Cả gói đã ngừng |
| POST | `/packages` | Admin | `{ packageName, durationDays, pricePerTray, maxTrays?, description? }` |
| PUT | `/packages/:id` | Admin | như trên + `isActive?` |
| DELETE | `/packages/:id` | Admin | Ngừng áp dụng (không xoá hẳn) |

## 7. Thuê khay – `/rentals`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| POST | `/rentals` | Customer | `{ packageId, trayCount?, roomId?, mushroomTypeId?, paymentMethod? }` → `{ rentalId, trays }`. Thanh toán giả lập, thành công ngay |
| POST | `/rentals/assign` | Staff | `{ customerId, packageId, trayCode, paymentMethod? }` – gán khay cho khách tại trại |
| POST | `/rentals/link` | Customer | `{ trayCode }` – nhập mã khay để liên kết vào tài khoản |
| GET | `/rentals?status=&customerId=&page=` | Đã đăng nhập | Customer: đơn của mình; Staff: tất cả |
| GET | `/rentals/:id` | Đã đăng nhập | Kèm `trays`, `payments` |
| POST | `/rentals/complete-expired` | Admin | Đóng đơn hết hạn ngay (bình thường server tự chạy mỗi ngày) |

## 8. Dành cho khách hàng – `/my`  (Customer)

| Method | Đường dẫn | Ghi chú |
|---|---|---|
| GET | `/my/trays` | Khay đang thuê: giai đoạn, ngày thu hoạch, `Temperature`/`Humidity`/`CO2` mới nhất, `CameraUrl` |
| GET | `/my/trays/:trayId` | Chi tiết + `growthLogs`, `harvests` (kèm trạng thái giao nhận), `thresholds` |
| GET | `/my/transactions?page=` | Lịch sử thanh toán |
| GET | `/my/harvests` | Các đợt thu hoạch + giao nhận |

## 9. Thu hoạch & giao nhận

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/harvests?status=&from=&to=` | Staff | `Scheduled` = lịch thu hoạch, `Completed` = đã thu hoạch |
| POST | `/deliveries` | Customer | `{ harvestId, requestType: "Pickup"\|"Delivery", address?, receiverPhone?, preferredDate? }` – bỏ trống địa chỉ thì lấy từ hồ sơ. Phí giao 30.000đ |
| GET | `/deliveries?status=` | Đã đăng nhập | Customer: của mình; Staff: tất cả |
| PATCH | `/deliveries/:id/status` | Staff | `{ status }` – khách nhận thông báo |
| PATCH | `/deliveries/:id/cancel` | Customer | Chỉ khi đang `Pending` |

## 10. Thiết bị – `/devices`  (Staff)

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/devices?roomId=&type=` | Staff | Kèm `IsOn`, `AutoMode`, lệnh gần nhất, `StreamUrl` (camera) |
| GET | `/devices/:id` | Staff | |
| POST | `/devices` | Admin | `{ deviceCode, deviceName, deviceType, roomId, trayId?, streamUrl?, isSimulated? }` |
| PUT | `/devices/:id` | Admin | `{ deviceName?, roomId?, trayId?, streamUrl?, status? }` |
| DELETE | `/devices/:id` | Admin | 409 nếu đã có dữ liệu → đặt `status: "Offline"` thay vì xoá |
| POST | `/devices/:id/control` | Staff | `{ command: "ON"\|"OFF", reason? }` – điều khiển tay, tự tắt chế độ tự động |
| PATCH | `/devices/:id/auto-mode` | Staff | `{ autoMode: true\|false }` |
| GET | `/devices/:id/commands?page=` | Staff | Lịch sử lệnh |

## 11. Môi trường & cảm biến

| Method | Đường dẫn | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/environment` | Đã đăng nhập | Mới nhất từng phòng + ngưỡng + `TempState`/`HumState`/`CO2State` (`Low`/`Normal`/`High`). Customer chỉ thấy phòng có khay của mình |
| GET | `/environment/:roomId/history?hours=24&groupBy=none\|hour\|day` | Đã đăng nhập | Dữ liệu vẽ biểu đồ (`Time`, `Temperature`, `Humidity`, `CO2`) |
| GET | `/sensors/config` | Thiết bị (`x-device-key`) | Danh sách cảm biến, ngưỡng, thiết bị trong phòng |
| POST | `/sensors/readings` | Thiết bị (`x-device-key`) | `{ deviceCode, temperature?, humidity?, co2? }` – trigger tự tạo cảnh báo + bật/tắt thiết bị |
| POST | `/sensors/simulate` | Admin | `{ rounds?, intervalMinutes?, anomalyPercent? }` – sinh nhanh dữ liệu trong DB |

## 12. Cảnh báo – `/alerts`  (Staff)

| Method | Đường dẫn | Body / Ghi chú |
|---|---|---|
| GET | `/alerts?status=&roomId=&severity=&page=` | Cảnh báo `Open` lên đầu |
| PATCH | `/alerts/:id` | `{ status: "Acknowledged" \| "Resolved" }` |

Cảnh báo tự đóng khi chỉ số trở lại bình thường.

## 13. Thông báo – `/notifications`

| Method | Đường dẫn | Quyền | Body / Ghi chú |
|---|---|---|---|
| GET | `/notifications?unreadOnly=true&page=` | Đã đăng nhập | Kèm `unreadCount` (hiện số trên chuông) |
| PATCH | `/notifications/:id/read` | Đã đăng nhập | |
| PATCH | `/notifications/read-all` | Đã đăng nhập | |
| DELETE | `/notifications/:id` | Đã đăng nhập | |
| GET | `/notifications/preferences` | Đã đăng nhập | Các loại thông báo + trạng thái bật/tắt của tôi |
| PUT | `/notifications/preferences` | Đã đăng nhập | `{ type, isEnabled }` |
| GET | `/notifications/settings` | Admin | Cấu hình toàn hệ thống |
| PUT | `/notifications/settings/:type` | Admin | `{ isEnabled }` |

## 14. Báo cáo – `/reports`

Thêm `?format=csv` vào các báo cáo Admin để tải file mở bằng Excel.

| Method | Đường dẫn | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/reports/dashboard` | Staff | Số liệu tổng quan, khay theo trạng thái, môi trường, 5 cảnh báo mới |
| GET | `/reports/revenue?from=&to=` | Admin | Doanh thu theo gói (dòng cuối `PackageId = null` là tổng) |
| GET | `/reports/revenue/monthly` | Admin | Doanh thu theo tháng |
| GET | `/reports/harvests` | Admin | Sản lượng theo tháng và loại nấm |
| GET | `/reports/rentals?from=&to=` | Admin | Danh sách đơn thuê |
| GET | `/reports/environment?roomId=&from=&to=` | Admin | Trung bình / min / max môi trường theo ngày |

## Ví dụ gọi API (JavaScript)

```js
const API = 'http://localhost:3000/api';

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'an.le@example.test', password: '...' }),
}).then((r) => r.json());

const token = login.data.token;

const res = await fetch(`${API}/my/trays`, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json();
if (!res.ok) alert(body.error.message);   // thông báo lỗi tiếng Việt
else console.log(body.data);
```
