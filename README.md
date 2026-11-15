# Nấm Smart — bản sửa lỗi Mock Server

## Chạy trên Windows / VS Code

1. **Dừng máy chủ cũ** đang chạy bằng `Ctrl + C` trong CMD.
2. Giải nén ZIP này, mở đúng thư mục `NamSmart-Demo`.
3. Chạy `node mock-server.js`.
4. Vào `http://localhost:3001` và bấm **Ctrl + F5** để tải lại.
5. Đăng nhập: `an.le@example.test` / `123456`.
6. Để thử liên kết khay, dùng mã đã được cấp sẵn `TRAY-R01-013` (mỗi phiên chỉ liên kết được một lần).

Nếu máy báo cổng 3001 đang sử dụng, phải dừng tiến trình server trước rồi mới chạy phiên bản mới.

## Chạy không cần Node

Mở bằng VS Code Live Server và truy cập `index.html?demo=1`. Nếu trình duyệt giữ phiên đăng nhập cũ không hợp lệ, hãy đăng xuất hoặc xóa `token` trong Local Storage rồi tải lại.

## Các lỗi đã sửa

- Đăng nhập xác minh mật khẩu; đăng ký tạo tài khoản demo độc lập, không đăng ký trùng email.
- Đổi mật khẩu xác minh mật khẩu cũ, mật khẩu mới >= 6 ký tự và phải khác cũ.
- Sửa hồ sơ xác thực tên, số điện thoại.
- Thuê khay kiểm tra số nguyên dương, giới hạn gói thuê, phòng tồn tại, loại nấm, tồn kho, phương thức thanh toán; tránh đơn thuê khay âm/lẻ/0.
- Tạo mã đơn thuê, mã khay và mã thanh toán không lặp trong phiên.
- Liên kết mã khay xác minh tồn tại, ngăn liên kết trùng. Mã demo được cấp: TRAY-R01-013.
- Giao nhận chỉ với đợt đã thu hoạch, không tạo yêu cầu trùng, kiểm tra địa chỉ/số điện thoại giao hàng, loại yêu cầu.
- Chỉ hủy giao nhận đang chờ.
- API khay, đơn thuê, thu hoạch, giao dịch và thông báo phân tách theo tài khoản demo.
- Đồng nhất API giả trên Node và chế độ trình duyệt; ngăn API khi chưa đăng nhập.
- Thông báo kiểm tra loại và thiết lập, xử lý ID không tồn tại.
- Chặn JSON sai định dạng, đường dẫn file không thuộc ứng dụng và yêu cầu dữ liệu quá lớn.

## Giới hạn của bản này

- **Vẫn là Mock Server**, dữ liệu giả nằm trong RAM, dừng server là mất. Thanh toán là giả lập.
- Tài khoản và mật khẩu chỉ dùng để thử nghiệm; chưa triển khai bảo mật production, SQL Server, JWT chuẩn, thanh toán hoặc cảm biến thật.
- Trong trình duyệt, chế độ `?demo=1` cũng là dữ liệu tạm trong RAM; làm mới trang sẽ làm mất những thay đổi demo.
- Kiểm thử tự động: `node test-api.js` (62 ca API), thêm HTTP smoke test cho tệp tĩnh và API. Chưa xác minh tương tác toàn bộ màn hình trên Chrome do môi trường tự động chặn localhost.

## Cấu trúc

```text
NamSmart-Demo/
  index.html
  css/style.css
  js/app.js
  js/mock-api.js
  mock-server.js
  test-api.js
  README-SUA-LOI.md
```
