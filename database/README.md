# Database – MushroomFarmDB (SQL Server)

Cơ sở dữ liệu cho hệ thống quản lý nuôi trồng nấm thông minh, tích hợp cho thuê khay và giám sát từ xa.

## Yêu cầu

- SQL Server (2019 trở lên, bản Express/Developer đều được)
- SSMS (để xem và chạy truy vấn)
- `sqlcmd` (cài kèm SQL Server / SSMS) nếu dùng `run_all.ps1`

## Cách tạo database

**Cách 1 – PowerShell** (trong thư mục `database`):

```powershell
.\run_all.ps1
# SQL Server ten khac:  .\run_all.ps1 -Server "localhost\SQLEXPRESS"
```

**Cách 2 – SSMS:** mở `MushroomFarmDB_full.sql`, bấm **F5**.

> ⚠ Cả hai cách đều **xoá và tạo lại toàn bộ bảng** trong `MushroomFarmDB` (database khác không bị ảnh hưởng).

## Các file

| File | Nội dung |
|---|---|
| `01_create_tables.sql` | Tạo database, 18 bảng, khoá, ràng buộc, index |
| `02_views_functions.sql` | View và function |
| `03_procedures_triggers.sql` | Stored procedure và trigger (nghiệp vụ chính) |
| `04_sample_data.sql` | Dữ liệu mẫu (chạy các procedure để tạo đơn thuê, trồng, thu hoạch, dữ liệu cảm biến) |
| `run_all.ps1` | Chạy 01 → 04 theo thứ tự |
| `MushroomFarmDB_full.sql` | Bản gộp 4 file để xem / nộp bài |

**Sửa code thì sửa trong 4 file gốc**, không sửa file gộp. Chỉ sửa procedure/view: chạy lại riêng file 02 hoặc 03 (dùng `CREATE OR ALTER`, không mất dữ liệu).

## Các bảng

| Nhóm | Bảng |
|---|---|
| Tài khoản | `Roles`, `Users` |
| Phòng, khay | `Rooms`, `MushroomTypes`, `Trays` |
| Cho thuê | `RentalPackages`, `Rentals`, `RentalTrays`, `Payments` |
| IoT | `Devices`, `SensorReadings`, `EnvThresholds`, `DeviceCommands` |
| Cảnh báo | `Alerts`, `Notifications` |
| Canh tác | `GrowthLogs`, `Harvests`, `DeliveryRequests` |

## Procedure cho backend

| Procedure | Chức năng |
|---|---|
| `usp_RentTrays` | Khách thuê 1 hoặc nhiều khay online (transaction, tự chọn khay trống) |
| `usp_AssignTrayToCustomer` | Operator gán khay cho khách tại trại |
| `usp_LinkTrayByCode` | Khách đăng ký khay bằng mã |
| `usp_StartCultivation` | Bắt đầu vụ trồng |
| `usp_UpdateTrayStage` | Cập nhật giai đoạn sinh trưởng (chỉ đi tới) |
| `usp_RecordHarvest` | Ghi nhận thu hoạch |
| `usp_RequestDelivery` | Khách yêu cầu nhận tại trại / giao tận nơi |
| `usp_InsertSensorReading` | Nhận dữ liệu từ thiết bị cảm biến |
| `usp_SimulateSensorData` | Giả lập IoT: sinh dữ liệu cảm biến |
| `usp_ControlDevice` | Bật/tắt thiết bị thủ công |
| `usp_UpdateAlertStatus` | Xác nhận / xử lý cảnh báo |
| `usp_CompleteExpiredRentals` | Đóng đơn thuê hết hạn (chạy định kỳ) |
| `usp_RevenueReport` | Báo cáo doanh thu theo gói |

Function/view hay dùng: `fn_GetCustomerTrays(@CustomerId)`, `vw_TrayOverview`, `vw_RoomLatestEnvironment`, `vw_DeviceStatus`, `vw_MonthlyRevenue`, `vw_HarvestSummary`.

**Trigger** `trg_SensorReadings_AfterInsert`: khi có dữ liệu cảm biến mới, tự tạo cảnh báo nếu vượt ngưỡng, gửi thông báo cho Admin/Operator và khách có khay trong phòng, tự bật/tắt quạt – phun sương – sưởi; tự đóng cảnh báo khi chỉ số ổn định lại.

## Lưu ý cho backend

- Lỗi nghiệp vụ được `THROW` với mã **50001–50099** kèm thông báo tiếng Việt → bắt theo `error.number` để trả về client.
- Mật khẩu mẫu đang là `CHANGE_ME_BCRYPT_HASH` → cần sinh hash bcrypt thật khi seed tài khoản.
- Chạy truy vấn bằng `sqlcmd` thì thêm cờ `-I` (filtered index cần `QUOTED_IDENTIFIER ON`). SSMS và thư viện `mssql` của Node.js đã bật sẵn.

## Tài khoản mẫu

| Email | Vai trò |
|---|---|
| `admin@mushroomfarm.test` | Admin |
| `operator1@mushroomfarm.test`, `operator2@mushroomfarm.test` | Operator |
| `an.le@example.test`, `binh.pham@example.test`, `cuong.hoang@example.test`, `dung.do@example.test`, `em.vu@example.test` | Customer |
