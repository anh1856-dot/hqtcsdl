# Web quản trị trang trại nấm

Ứng dụng React + Vite cho **Admin và Operator**. Giữ nguyên và tích hợp năm module từ PR #4/#5, bổ sung các trang vận hành còn lại. Giao diện chạy thật với REST API hiện có; không có dữ liệu giả hoặc chế độ tự đăng nhập trong ứng dụng.

## 1. Mở đúng workspace và cài dependency

Mở **thư mục gốc repository `hqtcsdl`** trong VS Code, trên máy hiện tại là `D:\hqtcsdl`. Không chỉ mở thư mục `web-admin` nếu muốn sử dụng Task và cấu hình Go Live đã bàn giao tại `.vscode/`.

Yêu cầu **Node 20.x từ 20.19, hoặc Node từ 22.12 trở lên** theo engine của Vite. Máy kiểm tra dùng Node 26.13.0. Mở Terminal → New Terminal:

```powershell
cd D:\hqtcsdl\web-admin
npm ci
```

Trên máy khác, thay đường dẫn bằng nơi clone repo. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` thay `npm`, không cần thay đổi chính sách PowerShell hoặc cài đặt VS Code global. Task Windows đã gọi `npm.cmd`.

## 2. Cấu hình API

```powershell
Copy-Item .env.example .env
```

Sửa `.env` theo backend phát triển của nhóm:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api
```

- Phải là URL HTTP(S) tuyệt đối, có `/api`; không dùng `/api` tương đối hoặc dựa vào proxy Vite.
- Không đưa mật khẩu, JWT secret hoặc token vào `VITE_*`: biến frontend được đưa vào JavaScript công khai của bản build.
- Không commit `.env`. `.env.example` chỉ chứa cấu hình công khai.
- Thay đổi `.env` cần khởi động lại Vite dev; với Go Live/preview phải **build lại**.

## 3. Chạy database và backend riêng

Làm theo [hướng dẫn backend](../backend/README.md) và [hướng dẫn CSDL](../database/README.md): SQL Server, database phát triển, cấu hình TCP/IP/SQL Authentication và `.env` của backend. Sau khi đã chuẩn bị đúng môi trường, mở terminal riêng:

```powershell
cd D:\hqtcsdl\backend
npm ci
# Chuẩn bị .env của backend theo backend/README.md trước khi chạy.
npm run dev
```

Kiểm tra `http://localhost:3000/api/health`. Cần nhận trạng thái `ok` từ API và kết nối SQL Server thành công. Không cần reset database để chạy frontend; script `database/run_all.ps1` tạo lại bảng, không chạy lại trên dữ liệu chung chỉ để demo.

**Go Live chỉ phục vụ frontend**, không chạy Node API hay SQL Server. Tài khoản đăng nhập do quản trị viên cấp; tài khoản dev mẫu được mô tả trong tài liệu database, không được hardcode trong frontend.

Nếu browser báo CORS, kiểm tra `CORS_ORIGIN` trong cấu hình backend do nhóm quản lý. Khi dùng allowlist, cần chứa đúng origin frontend đang mở, ví dụ `http://127.0.0.1:5173`, `http://127.0.0.1:4173` hoặc `http://127.0.0.1:5500`. `localhost` và `127.0.0.1` là origin khác nhau. Khởi động lại backend sau khi người phụ trách chỉnh cấu hình. Phần việc này không sửa mã backend/database.

## 4. Mở web khi đang phát triển

**Từ VS Code:** Terminal → Run Task → **Chạy web quản trị**. Task chạy trong `web-admin`, gọi `npm run dev -- --open`, tự mở trình duyệt ở cổng Vite thực sự chọn.

**Hoặc từ terminal frontend:**

```powershell
npm run dev
# Muốn tự mở browser:
npm run dev -- --open
```

Xem dòng **Local** của Vite. Trong lần kiểm tra ngày 10/11/2026, URL là **http://127.0.0.1:5173/**. Nếu cổng bận, Vite có thể chọn cổng khác; dùng URL in trong terminal, không mặc định 5173.

Vite theo dõi source và tự cập nhật/tải lại giao diện khi sửa. Phiên chỉ lưu token trong `sessionStorage` của tab; không lưu mật khẩu. Reload sẽ kiểm tra `/auth/me` trước khi hiển thị nội dung quản trị. Đăng xuất xóa token; đóng tab kết thúc phiên lưu tại tab đó.

**Dừng:** Ctrl+C ở terminal đang chạy. Với Task: Terminal → Terminate Task → chọn **Chạy web quản trị** (hoặc Ctrl+C tại terminal của Task).

## 5. Build và xem bằng Go Live

Đã cài extension **Live Server của Ritwick Dey**, mã `ritwickdey.LiveServer` (máy kiểm tra: 5.7.10). Máy khác: mở Extensions, tìm đúng tên/tác giả, chọn Install; hoặc:

```powershell
code --install-extension ritwickdey.LiveServer
```

Mở workspace gốc, build frontend:

```powershell
cd D:\hqtcsdl\web-admin
npm run build
```

Hoặc Terminal → Run Task → **Build web quản trị**. Kết quả nằm trong **`web-admin/dist`**.

1. Mở `web-admin/dist/index.html` trong VS Code.
2. Bấm **Go Live**, hoặc Command Palette → **Live Server: Open with Live Server**.
3. `.vscode/settings.json` phục vụ root `/web-admin/dist`, host `127.0.0.1`, cổng cấu hình 5500.
4. Mở URL extension báo. Lần kiểm tra engine Live Server: **http://127.0.0.1:5500/**.

Nếu có extension **Five Server** cùng cung cấp nút Go Live, dùng Command Palette và chọn đúng lệnh của **Live Server (Ritwick Dey)**. Không cần gỡ extension khác. Nếu cổng 5500 đang được dùng, xử lý cổng bận/đổi `liveServer.settings.port` trong workspace và xem URL thực tế extension báo.

**Không mở `src/main.jsx` bằng Live Server. Không mở `dist/index.html` bằng `file://`.** JSX cần Vite xử lý và bản build cần được phục vụ bằng HTTP.

Vite dùng `base: './'`, nên JS/CSS trỏ tới `./assets/...` trong dist. Ứng dụng chưa có ảnh local bắt buộc; URL ảnh/camera được lấy từ API. Không sao chép ảnh/video mẫu để thay thế nguồn không truy cập được.

Router dùng **hash**: ví dụ `http://127.0.0.1:5500/#/trays` và `/#/devices`. Khi tải lại, browser vẫn yêu cầu `index.html`, nên Live Server không cần SPA fallback. Không dùng `/trays` dạng đường dẫn không có `#`. Nếu sau này chuyển sang BrowserRouter, máy chủ tĩnh phải có fallback; dùng Vite preview để kiểm tra đầy đủ và cấu hình lại hosting trước khi đổi router.

**Khi sửa code hoặc biến môi trường: chạy lại `npm run build`.** Go Live/preview chỉ xem bản build hiện có, không tự biên dịch JSX. Live Server có thể reload khi dist đổi, nhưng không thay bước build. `dist` không được commit; người clone phải cài dependency và build lại.

**Dừng:** bấm trạng thái Port/Go Live để dừng hoặc Command Palette → **Live Server: Stop Live Server**.

## 6. Xem bản build bằng Vite preview

```powershell
npm run build
npm run preview
# Hoặc npm run preview -- --open
```

Task **Xem bản build web quản trị** tự chạy Task build trước rồi mở preview. Lần kiểm tra URL là **http://127.0.0.1:4173/**; đọc dòng Local nếu cổng khác. Dừng bằng Ctrl+C hoặc Terminate Task. Preview không thay thế backend/database và không được dùng như máy chủ production công khai.

## Quyền và các trang

| Trang                                                                     | Admin                | Operator                                                        |
| ------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| Tổng quan                                                                 | Có                   | Có, theo số liệu dashboard backend trả                          |
| Báo cáo chi tiết/CSV                                                      | Có                   | Không                                                           |
| Phòng, khay/canh tác, đơn thuê, thu hoạch, giao nhận, môi trường/cảnh báo | Theo API             | Theo API; xóa phòng/khay chỉ Admin                              |
| Loại nấm, gói thuê                                                        | Quản lý              | Xem                                                             |
| Tài khoản                                                                 | Quản lý              | Không có trang quản lý tài khoản                                |
| Thiết bị/camera                                                           | Cấu hình, điều khiển | Xem, điều khiển thiết bị được phép; không thêm/sửa/xóa cấu hình |
| Thông báo, tùy chọn cá nhân, hồ sơ/đổi mật khẩu                           | Có                   | Có                                                              |
| Thông báo toàn hệ thống/ngưỡng phòng                                      | Có                   | Không                                                           |

Không có đăng ký Admin công khai. Customer không được vào ứng dụng nhân viên. 401 kết thúc phiên; 403 hiển thị thiếu quyền, không tự đăng xuất.

## Demo các luồng chính

1. Đăng nhập bằng tài khoản dev của nhóm → Tổng quan → Phòng/Loại nấm/Gói thuê (module cũ).
2. Khay & canh tác → tạo khay trong phòng còn sức chứa → bắt đầu trồng → cập nhật giai đoạn tiến về trước → ghi nhật ký. Không tự đặt lại dữ liệu để làm demo.
3. Đơn thuê → gán một khay trống cho khách đang hoạt động → kiểm tra thông tin → xác nhận → xem đơn/thanh toán backend trả. Thanh toán luồng này hiện là **giả lập**.
4. Khay chuyển sang giai đoạn sẵn sàng thu hoạch → Thu hoạch → ghi nhận kg/chất lượng. Giao nhận chỉ xử lý yêu cầu Customer đã tạo, theo thứ tự trạng thái API cho phép.
5. Môi trường → chọn phòng/khoảng thời gian/nhóm số đo → xem biểu đồ; Cảnh báo → tiếp nhận/xử lý.
6. Thiết bị → kiểm tra loại/trạng thái/giả lập trước khi xác nhận điều khiển thủ công/tự động → xem lịch sử lệnh. Camera phải có nguồn thật phù hợp trình duyệt; RTSP chỉ lưu cấu hình.
7. Thông báo → đánh dấu đã đọc; Cấu hình → tùy chọn cá nhân; Admin có thể sửa ngưỡng phòng sau khi kiểm tra min/max.
8. Báo cáo → chọn báo cáo, ngày/phòng khi endpoint có hỗ trợ → xuất CSV có xác thực.

Chỉ thao tác ghi khi nhóm đã xác định là môi trường dev phù hợp. Frontend không tự tạo giao dịch thật, tạo đơn khi mở trang hoặc gọi reset CSDL.

## Cấu trúc và kiểm tra

- `src/App.jsx`: HashRouter, guard vai trò, layout/menu và tích hợp provider cũ.
- `src/shared/`: API client, phiên đăng nhập, GET/polling, bảng/form/dialog, định dạng và biểu đồ SVG.
- `src/pages/`: nhóm trang mới, gọi endpoint thật; không import dữ liệu test.
- `src/features/basic-management/`, `rentals-management/`: giữ nguyên mã từ PR #4/#5; xem tài liệu bàn giao riêng trong `docs/`.
- `tests/e2e/`: mock chỉ trong Playwright, không nằm trong luồng ứng dụng.
- `.vscode/` tại root: Task, cấu hình Live Server và extension được khuyến nghị, không đổi settings global.

```powershell
npm test
npm run build
npm run test:e2e
```

Browser test mặc định dùng Chrome headless. Nếu máy chưa có Chrome, cài browser theo Playwright, ví dụ `npx playwright install chromium` rồi chọn channel tương ứng qua `PW_CHANNEL=chromium`. Biến `WEB_ADMIN_TEST_URL` cho phép kiểm tra preview/Go Live đang chạy thay vì dev. Không dùng test có ghi trên backend thật.

Xem [kết quả xác minh và giới hạn](docs/web-admin-validation.md). Không có cấu hình lint/typecheck có sẵn; source JSX được kiểm tra bằng build và các bài kiểm thử.
