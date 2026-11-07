# Hệ thống quản lý nuôi trồng nấm thông minh

Đồ án môn Hệ quản trị cơ sở dữ liệu – quản lý phòng/khay nấm, cho thuê khay, giám sát môi trường (IoT giả lập) và theo dõi từ xa.

**Thành viên:** Huỳnh An (nhóm trưởng), Cao Thành Dương, Ngô Phú Minh Hùng, Tào Quốc Bảo, Trần Việt Đức

## Cấu trúc

| Thư mục | Nội dung | Công nghệ | Trạng thái |
|---|---|---|---|
| [`database/`](database/) | CSDL, procedure, trigger, phân quyền, backup | SQL Server | ✅ |
| [`backend/`](backend/) | RESTful API + giả lập IoT ([danh sách API](backend/API.md)) | Node.js, Express | ✅ |
| `web-admin/` | Web cho Admin / Operator | ReactJS | ⏳ |
| `mobile-app/` | App cho khách hàng | Flutter | ⏳ |

## Chạy nhanh

1. Tạo database: `database/README.md`
2. Chạy API: `backend/README.md`
3. Web / app gọi API tại `http://localhost:3000/api`

## Quy tắc làm việc nhóm

- **Không push thẳng lên `main`.** Mỗi việc tạo một nhánh (`feature/web-login`, `feature/app-tray-list`…) rồi mở Pull Request.
- Nhóm trưởng review và merge. Mỗi người commit bằng tài khoản GitHub của mình.
- Cần thêm/sửa bảng, cột, API → nhắn nhóm trưởng, không tự sửa `database/` và `backend/`.
- Trước khi bắt đầu việc mới: `git pull` để lấy code mới nhất.
