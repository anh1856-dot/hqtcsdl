# Xác minh web Admin/Operator và bàn giao tích hợp

Ngày thực hiện: **10/11/2026**, múi giờ Asia/Saigon. Nhánh: `feature/web-admin-complete`.

## Mã kế thừa và phạm vi

- `origin/main` lúc bắt đầu: `35a6492`.
- PR #4 và #5 đều đang mở, chưa hợp nhất khi kiểm tra. Nhánh tích hợp dùng merge Git các nhánh nguồn, không sao chép module, không thay tác giả hoặc sửa lịch sử commit cũ.
- Kế thừa `f0b8a4c` (bốn module cơ bản) và `6d107e9` (đơn thuê). Không đóng hoặc tự merge các PR đó trên GitHub.
- Chỉ thêm frontend trong `web-admin/` và ba file workspace `.vscode/tasks.json`, `.vscode/settings.json`, `.vscode/extensions.json` được giao bổ sung. Root `.gitignore` có sẵn bỏ qua `.vscode/`; ba file được stage đích danh, không thay quy tắc ignore toàn repo.
- Không sửa `backend/`, `database/`, mobile, ESP32, GitHub Actions, root README, settings VS Code global hoặc dữ liệu mẫu. Không đưa `.env`, node_modules, dist, ảnh/log thử nghiệm vào commit.

## Chức năng theo tám nhóm

| Nhóm                | Phần frontend đã triển khai                                                                                                                                         | Điểm cần môi trường thật                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Khung ứng dụng      | Vite/entry, hash router/404, layout responsive, menu/route guard, đăng nhập, kiểm tra phiên, đăng xuất, hồ sơ/đổi mật khẩu; tích hợp năm module cũ qua client chung | Chưa xác minh tài khoản/phiên với backend thật                     |
| Dashboard/báo cáo   | Dashboard theo API, thời điểm cập nhật, phân bố khay; năm báo cáo, ngày/phòng đúng endpoint; CSV có Bearer token; biểu đồ doanh thu theo tháng                      | Chưa đối chiếu số liệu với SQL Server thật                         |
| Khay/canh tác       | Danh sách tìm/lọc, chi tiết, tạo 1–100 khay, sửa/chuyển phòng theo trạng thái, xóa Admin; bắt đầu vụ, giai đoạn tiến về trước, nhật ký/URL ảnh và lịch sử           | Máy chủ quyết định sức chứa, lịch sử và các quy tắc đồng thời      |
| Thu hoạch/giao nhận | Lọc lịch/kết quả, ghi kg/chất lượng/ghi chú qua khay, xem lịch sử; cập nhật giao nhận theo NEXT thực tế                                                             | Chưa tạo/ghi kết quả trên dữ liệu dev thật                         |
| Môi trường/cảnh báo | Đơn vị/thời gian/ngưỡng, phân biệt chưa có/cũ >5 phút; lịch sử 24h/3d/7d/90d, nhóm thời điểm/giờ/ngày và biểu đồ; lọc/phân trang, tiếp nhận/xử lý cảnh báo          | Chưa xác minh cảm biến/IoT thật; API tối đa 2.000 mốc              |
| Thiết bị/camera     | Lọc/xem chi tiết, cấu hình Admin, xác nhận bật/tắt/Auto, lịch sử lệnh; lưu URL camera, phát nguồn video trình duyệt hỗ trợ và báo lỗi/giới hạn RTSP/HLS             | Không có nguồn camera thật hay phần cứng để xác minh phát/thi hành |
| Thông báo/cấu hình  | Chuông số chưa đọc, danh sách/lọc/phân trang, đọc một/tất cả/xóa; tùy chọn cá nhân; cấu hình toàn hệ thống và ngưỡng phòng cho Admin                                | Chỉ thông báo trong app; backend chưa cung cấp push/email          |
| Tích hợp/kiểm tra   | Chạy dev, preview, build tĩnh, VS Code Task/Live Server config; kiểm tra desktop/mobile và các luồng nối trang                                                      | Backend/database chưa sẵn sàng; không tự reset để làm demo         |

## Kết quả kiểm tra thực tế

- `npm ci`/cài dependency và build Vite 8.3.7 thành công với React 18.3.1, Node 26.13.0.
- **34/34** kiểm tra Node: gồm 26 ca của module cũ và 8 ca API/model mới.
- **30/30** kiểm tra trình duyệt trên Vite dev, Chrome headless, React StrictMode, không retry.
- **19/19** ca trang, reload, phiên, CSV và mobile trên Vite preview.
- **19/19** ca tương tự trên engine `live-server` được đóng gói cùng extension Ritwick Dey 5.7.10, root chính xác `web-admin/dist`.
- Các ca mới kiểm tra quyền Admin/Operator/Customer, không lóe dữ liệu trước auth; các module kế thừa; giai đoạn/thu hoạch/giao nhận; lịch sử/biểu đồ/cảnh báo; điều khiển và camera RTSP; thông báo/ngưỡng; tải CSV có xác thực; lỗi 401/403/409; giữ form, khóa gửi lặp; response cũ; polling chờ request và dừng khi chuyển trang; mobile 390×844.
- Đã xem ảnh desktop/mobile ngoài repo. CSS bảng giữ độ rộng tối thiểu cho cột để mã/tên không bị bó thành từng ký tự; cuộn ngang trong vùng bảng.
- `index.html`, JS và CSS build trả HTTP 200 đúng MIME trên cả preview và Live Server; URL asset tương đối `./assets/...`. Không có ảnh local bắt buộc cần sao chép thêm.
- Test bản build xác nhận API/CSV được gọi sang origin `http://localhost:3000`, không dùng proxy Vite dev. Test có mock riêng chặn request; không làm API thật hoạt động giả.

**Tất cả kiểm tra nghiệp vụ trình duyệt dùng mock tách trong tests. Chưa kiểm thử tích hợp backend/SQL Server thật.**

## Dev, Task và Go Live: đã xác minh gì

| Cách                                  | Kết quả                                                                                                             | URL quan sát được                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `npm run dev -- --open`               | Đã chạy, Vite mở browser, tự theo dõi source; dev test đạt                                                          | `http://127.0.0.1:5173/`          |
| `npm run build` rồi `npm run preview` | Đã chạy, tải asset và reload các route hash đạt                                                                     | `http://127.0.0.1:4173/`          |
| Live Server engine của extension      | Đã chạy đúng root dist, asset và route hash đạt                                                                     | `http://127.0.0.1:5500/`          |
| VS Code Task “Chạy web quản trị”      | JSON/cwd/lệnh đã kiểm tra; chạy đúng lệnh tương đương có `--open`; chưa bấm trực tiếp Task trong giao diện VS Code  | URL do Vite chọn/in ra            |
| Nút Go Live của VS Code               | Extension đã cài và cấu hình workspace đã đọc/kiểm tra; chưa bấm nút trong UI. Engine bên dưới đã kiểm tra như trên | Theo extension báo; cấu hình 5500 |

Cổng trên là kết quả của lần kiểm tra, không bảo đảm cố định trên mọi máy. Engine preview/Live Server dùng cho QA được dừng sau kiểm tra; người dùng chạy theo [README](../README.md). Cách dừng dev/preview: Ctrl+C hoặc Terminate Task; Live Server: Stop Live Server.

## Môi trường thật đang bị chặn

Đã gọi read-only `http://localhost:3000/api/health`: kết nối bị từ chối, `ECONNREFUSED` trên cả địa chỉ IPv4/IPv6 được thử. Không có listener cổng 3000. File `backend/.env` chưa tồn tại. SQL Server local trả không có database tên `MushroomFarmDB`.

Không thử đăng nhập bằng mật khẩu suy đoán, không gọi API ghi dữ liệu thật, không chạy script tạo/reset database. Chưa thể kiểm tra CORS từ backend đang chạy, quyền SQL, giao dịch thật hoặc nguồn camera. Cần nhóm trưởng chuẩn bị DB dev, backend `.env`, chạy API và kiểm tra health trước khi đăng nhập frontend. Nếu dùng CORS allowlist, thêm đúng origin frontend thực tế.

## Giới hạn API và cách tái hiện cần nhóm trưởng xử lý

1. **Thay loại nấm làm đổi báo cáo cũ:** `vw_HarvestSummary` join loại nấm hiện tại của khay. Đổi loại nấm trên khay từng thu hoạch sẽ phân loại lại sản lượng cũ. Frontend hiển thị số liệu API, không tự sửa lịch sử hoặc tính lại để che lỗi. Cần lưu thông tin theo vụ/lần thu hoạch ở backend.
2. **Gán khay phòng ngừng hoạt động:** `usp_AssignTrayToCustomer` chỉ kiểm tra khay Available, không kiểm tra Rooms.Status; `/trays?status=Available` không trả trạng thái phòng. Đặt phòng Inactive nhưng giữ khay Available rồi gán vẫn có thể được chấp nhận. Đây là điểm đã ghi nhận từ module đơn thuê, không sửa backend trong nhánh này.
3. **Sức chứa tại CSDL:** cập nhật trực tiếp Rooms.Capacity có thể nhỏ hơn số khay vì trigger chỉ nằm trên Trays. API phòng có kiểm tra trước, nhưng CSDL chưa bảo vệ mọi đường ghi/đồng thời. Frontend dùng kiểm tra API, không tự sửa DB.
4. **Xóa phòng chưa atomic:** route xóa ngưỡng trước rồi xóa phòng, không có transaction. Nếu phòng còn thiết bị, bước xóa phòng có thể bị khóa ngoại chặn sau khi ngưỡng đã mất. Cần bọc thao tác phía backend.
5. **PUT dùng COALESCE:** một số trường loại nấm/gói/khay không thể xóa trắng qua API hiện tại. Module cũ giữ cách xử lý đã bàn giao; sửa khay bỏ qua vị trí/loại nấm rỗng thay vì báo đã xóa trắng. Không giả lập dữ liệu mới.
6. **Đơn thuê/thanh toán đang mô phỏng:** thuê/gán tạo Payment Paid với mã SIM, không có cổng thanh toán thật. Thiết bị giả lập cũng đánh dấu Executed; trường IsOn của thiết bị thật được trigger cập nhật theo lệnh gửi, chưa phải xác nhận phần cứng. UI nói rõ trạng thái được ghi nhận trong hệ thống.
7. **Mạng mất sau POST:** backend chưa có idempotency key. Frontend chặn request lặp trong lúc chờ, không tự retry khi mất kết nối; người dùng phải kiểm tra kết quả trước khi gửi lại.
8. **Phân trang trang rỗng:** API dùng COUNT OVER từ các dòng trả về; trang rỗng có thể có total=0 dù trang trước còn dữ liệu. Nút Trước vẫn dùng được; đổi bộ lọc trở về trang 1.
9. **Lịch sử môi trường giới hạn:** endpoint dùng TOP 2000 và sắp thời gian tăng dần; khoảng dày có thể thiếu phần cuối. Dùng nhóm giờ/ngày. Biểu đồ không bù số 0 cho mốc thiếu, không tạo giá trị giữa các khoảng không có mẫu.
10. **Ngưỡng chưa atomic:** route PUT lặp MERGE từng metric, không transaction. Nếu một metric sau lỗi, metric trước có thể đã được lưu. Frontend kiểm tra min/max và khoảng số trước khi gửi, vẫn cần backend bảo đảm atomic khi nhiều người cập nhật.
11. **Thông tin lịch sử có trường hiện tại:** chi tiết đơn/lịch sử khay/gói và loại nấm không phải snapshot. Tiền dùng Rentals.TotalAmount/Payments.Amount; không nhân lại giá gói hiện tại. Ghi nhận thu hoạch chọn lịch Scheduled đầu tiên theo khay, không nhận HarvestId để chọn chính xác nếu dữ liệu có nhiều lịch chờ.
12. **Camera:** MP4/WebM/Ogg qua HTTP(S) được đưa vào video native; HLS chỉ khi browser báo hỗ trợ native. Sai codec, URL không tồn tại, quyền/CORS/mixed content hoặc stream RTSP cần giải pháp nguồn phát riêng. Không thêm proxy/chuyển mã, video hoặc ảnh mẫu.
13. **Timestamp:** frontend hiển thị timestamp ISO theo múi giờ trình duyệt; SQL DATETIME2 không có múi giờ và driver có thể tuần tự hóa thành UTC. Cần nhóm trưởng thống nhất thời gian SQL/API/IoT trước khi dùng để đánh giá dữ liệu cũ chính xác.
14. **Quyền dashboard:** API dashboard hiện cho Operator thấy cả RevenueThisMonth; frontend tuân thủ hợp đồng đó, nhưng báo cáo chi tiết/CSV chỉ Admin. Nếu nghiệp vụ không cho Operator thấy số này, cần thay quyền/dữ liệu trả ở backend.

Các lỗi mô tả được suy ra từ route/SQL đã đọc, ba lỗi dữ liệu ở đầu từng được tái hiện trong CSDL tạm ở lượt review trước. **Không tái hiện bằng thao tác ghi trên DB thật trong lượt này.**

## Việc nhóm trưởng cần làm

- Review PR tích hợp, đối chiếu hai commit kế thừa với PR #4/#5, quyết định thứ tự merge/đóng PR cũ để không xử lý trùng. Agent không tự merge hoặc đóng PR.
- Chuẩn bị môi trường SQL Server/API dev, cấu hình CORS theo URL frontend, cấp tài khoản thử đúng vai trò.
- Chạy kiểm thử tích hợp thực tế các luồng: tạo/gán khay → vụ trồng → lịch/ghi thu hoạch → yêu cầu giao nhận Customer → xử lý Staff; kiểm tra dữ liệu và rollback khi API lỗi.
- Cấp URL camera browser-compatible nếu muốn demo phát video; kiểm tra trạng thái thiết bị thật ở lớp phần cứng, không dựa riêng trên IsOn/Executed.
- Xử lý các giới hạn backend/CSDL được liệt kê; thống nhất policy gia hạn đơn hết hạn, múi giờ, bảo toàn lịch sử và chống ghi lặp.
- Sau merge, người clone chạy `npm ci`, tự tạo `.env`, build lại; không lấy dist từ Git. Cập nhật trạng thái frontend trong tài liệu tổng của nhóm nếu cần.
