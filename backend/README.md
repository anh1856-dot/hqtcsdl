# Backend – Mushroom Farm API

RESTful API (Node.js + Express + SQL Server) cho web Admin/Operator, app khách hàng và thiết bị IoT giả lập.
Danh sách API: **[API.md](API.md)**.

## Chuẩn bị (làm 1 lần)

1. **Node.js 20+** – https://nodejs.org (bản LTS)
2. **Database** – chạy `database/run_all.ps1` (xem `database/README.md`)
3. **Cấu hình SQL Server** để Node.js kết nối được:
   - Bật **TCP/IP**: Start → gõ `SQLServerManager17.msc` (SQL Server 2022 là `SQLServerManager16.msc`) → *SQL Server Network Configuration* → *Protocols for MSSQLSERVER* → chuột phải **TCP/IP → Enable**
   - Bật **SQL Server Authentication**: SSMS → chuột phải server → *Properties* → *Security* → **SQL Server and Windows Authentication mode**
   - **Restart** SQL Server: Configuration Manager → *SQL Server Services* → chuột phải *SQL Server (MSSQLSERVER)* → Restart

## Chạy

```powershell
cd backend
npm install
copy .env.example .env      # sua neu may dung SQL Server Express hoac doi mat khau
npm run dev                 # tu khoi dong lai khi sua code
```

Mở http://localhost:3000/api/health thấy `"status": "ok"` là chạy được.

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy API, tự reload khi sửa code |
| `npm start` | Chạy API |
| `npm run simulate` | Giả lập 3 cảm biến gửi dữ liệu mỗi 5 giây (mở terminal thứ 2, API phải đang chạy) |
| `npm run test:api` | Kiểm thử nhanh 48 trường hợp (ghi dữ liệu thật – chạy lại `run_all.ps1` để làm sạch) |

## Tài khoản mẫu

Mật khẩu chung ghi trong `database/README.md`.

| Email | Vai trò |
|---|---|
| `admin@mushroomfarm.test` | Admin |
| `operator1@mushroomfarm.test` | Operator |
| `an.le@example.test`, `binh.pham@example.test`, `cuong.hoang@example.test`, `dung.do@example.test`, `em.vu@example.test` | Customer |

## Cấu trúc

```
backend/
├── src/
│   ├── server.js              # khoi dong, ket noi DB, lich dong don het han
│   ├── app.js                 # Express, gan cac route
│   ├── config/
│   │   ├── env.js             # doc file .env
│   │   └── db.js              # query(), queryOne(), queryMulti(), exec() goi stored procedure
│   ├── middlewares/
│   │   ├── auth.js            # authenticate (JWT), authorize('Admin', ...), requireDeviceKey
│   │   └── errorHandler.js    # loi THROW 50001-50099 tu SQL -> HTTP 400/403/404/409
│   ├── utils/                 # HttpError, phan trang, kiem tra du lieu, xuat CSV
│   └── routes/                # moi file = 1 nhom API (xem API.md)
└── scripts/
    ├── simulate-iot.js        # gia lap thiet bi IoT
    └── smoke-test.js          # kiem thu nhanh
```

## Thêm một API mới

```js
// src/routes/xxx.routes.js
const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { notFound, asyncHandler } = require('../utils/http');

router.use(authenticate);

router.get('/:id', authorize('Admin', 'Operator'), asyncHandler(async (req, res) => {
  const row = await db.queryOne('SELECT * FROM dbo.Rooms WHERE RoomId = @id', { id: req.params.id });
  if (!row) throw notFound('Không tìm thấy phòng.');
  res.json({ data: row });
}));

module.exports = router;
// roi them vao src/app.js:  app.use('/api/xxx', require('./routes/xxx.routes'));
```

- Luôn dùng tham số `@ten` – **không** cộng chuỗi SQL (chống SQL injection).
- Nghiệp vụ có sẵn stored procedure thì gọi `db.exec('dbo.usp_...')`, lỗi nghiệp vụ tự trả về đúng mã HTTP.
- Các bảng có trigger (`Users`, `Trays`, `Notifications`, `SensorReadings`, `DeviceCommands`) không dùng `OUTPUT inserted.*` trực tiếp – dùng `SCOPE_IDENTITY()` hoặc `OUTPUT ... INTO @bien`.
- Backend kết nối bằng login `mushroom_app` nên **không** sửa trực tiếp được `Payments`, `Rentals`… (phân quyền ở `database/05_security.sql`) – phải đi qua procedure.
