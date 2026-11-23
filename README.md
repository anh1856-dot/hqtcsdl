# Hệ thống quản lý nuôi trồng nấm thông minh

Đồ án môn Hệ quản trị cơ sở dữ liệu – quản lý phòng/khay nấm, cho thuê khay, giám sát môi trường (IoT giả lập) và theo dõi từ xa.

**Thành viên:** Huỳnh An (nhóm trưởng), Cao Thành Dương, Ngô Phú Minh Hùng, Tào Quốc Bảo, Trần Việt Đức

## Cấu trúc

| Thư mục | Nội dung | Công nghệ | Trạng thái |
|---|---|---|---|
| [`database/`](database/) | CSDL, procedure, trigger, phân quyền, backup | SQL Server | ✅ |
| [`backend/`](backend/) | RESTful API + giả lập IoT ([danh sách API](backend/API.md)) | Node.js, Express | ✅ |
| [`web-admin/`](web-admin/) | Web cho Admin / Operator ([cách chạy](web-admin/README.md)) | ReactJS (Vite) | ✅ |
| [`mobile-app/`](mobile-app/) | App cho khách hàng ([cách chạy, build APK](mobile-app/README.md)) | Flutter | ✅ |

## Chạy nhanh

1. Tạo database: `database\run_all.ps1` (xem `database/README.md`). Sau mỗi lần `git pull` có sửa `database/` thì chạy lại.
2. Chạy API: `backend/README.md`, kiểm tra bằng `npm run test:api`.
3. Chạy web quản trị: `web-admin/README.md`.
4. Chạy app khách hàng: `mobile-app/README.md` (`flutter run`, hoặc build file APK để cài lên điện thoại Android).
   **Tải sẵn file APK:** [Releases → bản mới nhất](https://github.com/anh1856-dot/hqtcsdl/releases/latest) (kèm hướng dẫn cài).
5. Web / app gọi API tại `http://localhost:3000/api`. Chạy app trên điện thoại thật thì dùng IP máy chạy backend thay cho `localhost`.

Tài khoản mẫu: `admin@mushroomfarm.test`, `operator1@mushroomfarm.test`, `an.le@example.test`… mật khẩu chung `Mushroom@123` (chỉ dùng cho môi trường dev).

## Phạm vi đã thống nhất

- Dùng **SQL Server**.
- **IoT giả lập** (`backend/scripts/simulate-iot.js`), không dùng ESP32 / cảm biến thật.
- **Camera chỉ ở mức tham khảo:** web quản trị có phần cấu hình camera và URL stream, không nối camera / video thật.
- **Thanh toán giả lập**, ghi nhận giao dịch thành công ngay.
