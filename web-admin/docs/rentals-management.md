# Bàn giao module web quản lý đơn thuê

## Phạm vi

Module độc lập cho **Admin và Operator**, tạo từ `origin/main` tại commit `35a6492`. Bốn module quản lý cơ bản ở PR #4 chưa được hợp nhất khi bắt đầu công việc này; module đơn thuê không import, sao chép hay phụ thuộc mã từ nhánh đó.

Chỉ thêm mã trong `web-admin/src/features/rentals-management/` và tài liệu này. Không đăng ký router/menu; không thêm layout, đăng nhập hay cấu hình ứng dụng. Không sửa backend, database, bốn module trước hoặc mã của thành viên khác.

Chức năng:

- Danh sách đơn có phân trang phía server; lọc trạng thái và khách hàng. Hiển thị mã đơn, khách, gói, ngày bắt đầu/kết thúc, số khay, tổng tiền và trạng thái.
- Bộ chọn khách hàng tìm theo tên/email/số điện thoại và phân trang bằng `/users`. Đây là tìm **khách hàng**, không phải tìm kiếm đơn thuê trên toàn hệ thống.
- Chi tiết chỉ đọc gồm thông tin đơn, các khay và lịch sử thanh toán. Tổng tiền hiển thị theo backend, không tính lại từ giá gói hiện tại.
- Gán một khay cho khách đang hoạt động, dùng gói đang áp dụng, chọn mã khay trống và phương thức thanh toán. Có bước kiểm tra/xác nhận trước khi gửi.
- Chỉ báo thành công sau phản hồi API; tải lại danh sách và có nút xem mã đơn vừa tạo nếu response trả `rentalId` hợp lệ.
- Có loading, empty state, thông báo lỗi/thành công, thử lại; giữ dữ liệu form khi lỗi, chặn gửi lặp trong lúc chờ; bỏ phản hồi GET cũ khi đổi bộ lọc.

Không có luồng khách thuê online/liên kết khay; không sửa/hủy/hoàn tiền đơn, không đóng hàng loạt đơn hết hạn và không làm các module khác.

## Export và cách tích hợp

Entry: `web-admin/src/features/rentals-management/index.js`.

| Export | Công dụng |
| --- | --- |
| `RentalsManagementPage` | Trang danh sách, chi tiết qua hộp thoại, gán khay |
| `RentalsManagementProvider` | Nhận người dùng và cách gọi API/xử lý hết phiên từ ứng dụng chung |
| `RentalDetails` | Nội dung chi tiết chỉ đọc, tùy chọn dùng riêng với prop `rentalId` |
| `createRentalsClient` | Bộ gọi API bằng Fetch khi host chưa truyền client |
| `RentalsApiError` | Error có `message`, `status`, `code` |

Dependency chạy thật: React/ReactDOM 18+ của ứng dụng chứa module; Fetch, AbortController và HTML `<dialog>` từ trình duyệt hiện đại. JSX/CSS được xử lý bởi pipeline của host. Không thêm dependency hoặc package/config vào repository.

Props Provider:

| Prop | Hợp đồng |
| --- | --- |
| `currentUser` | `{ id, role }` hoặc `{ UserId, Role }`; cần ID nguyên dương và role `Admin`/`Operator`. Guest/Customer không có nội dung quản trị và không phát sinh request. |
| `apiClient` | Tùy chọn: object ổn định có `request(path, { method?, body?, signal? })`. Trả Promise của envelope backend đã parse `{ data, pagination? }`; reject bằng Error có `status` và `message`, tùy chọn `code`. Body là object chưa stringify. |
| `baseUrl` | Dùng khi không có `apiClient`, mặc định `http://localhost:3000/api`, bao gồm `/api`. |
| `getToken` | Hàm lấy token hiện tại từ cơ chế phiên của host, hỗ trợ Promise. Module không đọc hay ghi localStorage/sessionStorage. |
| `onUnauthorized` | Callback do host cung cấp để kết thúc phiên khi gặp 401, áp dụng cho cả client bên ngoài. Nên idempotent vì có thể nhiều request cùng hết phiên. |
| `children` | Trang hoặc nội dung đơn thuê. |

Giữ client/các callback ổn định bằng `useMemo`/`useCallback` khi cần. Provider bỏ trạng thái các trang/hộp thoại khi ID hoặc vai trò thay đổi. Backend luôn quyết định quyền cuối cùng; host phải truyền danh tính từ phiên đã xác thực.

Ví dụ dành cho người tích hợp, **chưa áp dụng vào file chung**:

```jsx
import React from 'react';
import { RentalsManagementPage, RentalsManagementProvider } from './features/rentals-management/index.js';
import './features/rentals-management/styles.css';

function RentalsArea({ session }) {
  const getToken = React.useCallback(() => session.getAccessToken(), [session]);
  const endSession = React.useCallback(() => session.endSession(), [session]);
  return (
    <RentalsManagementProvider
      currentUser={session.user}
      baseUrl="http://localhost:3000/api"
      getToken={getToken}
      onUnauthorized={endSession}
    >
      <RentalsManagementPage />
    </RentalsManagementProvider>
  );
}
```

Đường dẫn đề xuất: `/management/rentals`; menu: **Đơn thuê**, chỉ cho Admin/Operator. Nếu host đã có React Router, người tích hợp có thể gắn `<Route path="/management/rentals" element={<RentalsArea session={session} />} />`. Không yêu cầu cài React Router nếu host dùng cách điều hướng khác.

Nếu dùng API client có sẵn, truyền adapter trả đúng envelope. Ví dụ với client kiểu Axios, trả `response.data` thay vì nguyên `response`; chuyển `cause.response.status` thành `error.status` và `cause.response.data.error.message` thành `error.message`. Chuyển tiếp AbortSignal nếu client hỗ trợ. Khi client bỏ qua signal, module vẫn kiểm tra request còn hiện hành trước khi cập nhật giao diện.

`RentalDetails` có thể import riêng rồi render `<RentalDetails rentalId={selectedRentalId} />` bên trong Provider. Có loading, lỗi, không tìm thấy và thử lại. Component tự có wrapper CSS `.rm-root`.

## API đã đối chiếu

Đã đọc `backend/API.md`, `backend/README.md`, middleware và các route `rentals`, `users`, `packages`, `trays`; đọc procedure gán khay để hiểu tác động ghi dữ liệu. Response dùng PascalCase trừ response tạo đơn là `data.rentalId`.

| Method / Endpoint | Nội dung và cách dùng |
| --- | --- |
| `GET /rentals?page=&pageSize=&status=&customerId=` | Staff xem danh sách. `data[]` gồm `RentalId, CustomerId, CustomerName, PackageName, StartDate, EndDate, TrayCount, TotalAmount, Status` và các trường khác; `pagination` có `page, pageSize, total`. |
| `GET /rentals/:id` | `data` là đơn, thêm `trays[]`, `payments[]`. Không yêu cầu API tài khoản chi tiết vốn chỉ dành Admin; Operator vẫn xem được thông tin khách có sẵn trong response đơn. |
| `POST /rentals/assign` | Body `{ customerId, packageId, trayCode, paymentMethod }`; Staff; response 201 `{ data: { rentalId } }`. Không gửi giá, tổng tiền hoặc ID nhân viên do frontend tự đặt. |
| `GET /users?role=Customer&page=&pageSize=10&q=` | Bộ chọn khách để lọc đơn. Tìm kiếm và phân trang ở server, có thể chọn khách đã khóa để xem lịch sử. |
| `GET /users?role=Customer&status=Active&page=&pageSize=10&q=` | Bộ chọn khách nhận khay, chỉ khách đang hoạt động. Operator được phép đọc danh sách khách hàng. |
| `GET /packages` | Chỉ lấy gói đang áp dụng, không gọi `/packages/all`. |
| `GET /trays?status=Available` | Staff lấy từng khay còn trống với `TrayId, TrayCode, RoomName, Status`; không có phân trang. |

`/trays/available` **không được dùng** vì chỉ trả số khay trống theo phòng/loại nấm, không trả mã từng khay để gán.

Giá trị gửi đúng backend:

- Trạng thái đơn: `Pending`, `Active`, `Completed`, `Cancelled`.
- Thanh toán: `Cash`, `BankTransfer`, `EWallet`, `Card`.
- Mã khay được trim và viết hoa. Mỗi lần gán là một khay, số lượng không phải trường người dùng tự nhập.

Mở trang chỉ GET danh sách đơn; mở form mới tải gói/khay; mở bộ chọn khách mới tải danh sách khách. Không tự POST khi mở trang hoặc mở hộp thoại.

## Style, ngày tháng và xử lý lỗi

Import `styles.css` một lần. Các selector nằm trong `.rm-root`, class và keyframes dùng tiền tố `rm-`; không có selector toàn cục cho `html`, `body`, `:root`. Style của ứng dụng chung vẫn có thể tác động vào module nên cần kiểm tra lại khi tích hợp.

Tiền dùng `Intl.NumberFormat('vi-VN')` và VND. Ngày hiển thị `dd/mm/yyyy`, đọc phần ngày trong payload SQL DATE, không dịch chuyển ngày vì múi giờ của trình duyệt. Lịch sử thanh toán hiển thị ngày, không tự suy diễn múi giờ hoặc giờ thanh toán.

Native dialog giữ focus trong hộp thoại, Escape đóng khi không gửi request. Form có nhãn, thông báo lỗi, focus về trường sai hoặc phần xác nhận. Khi gửi, khóa form/nút đóng và chặn request trùng bằng ref. Bảng cuộn ngang trong vùng riêng trên điện thoại.

401 gọi host; 403/404/xung đột hiển thị thông báo từ `error.message`. 404 ở chi tiết có tiêu đề không tìm thấy và nút thử lại. Không dùng dữ liệu mẫu thay thế khi API lỗi. POST không tự retry. Nếu mất kết nối hoặc response ghi không đúng envelope, cảnh báo kết quả chưa được xác nhận và yêu cầu kiểm tra danh sách đơn trước khi gửi lại.

## Giới hạn và điểm cần báo nhóm trưởng

1. **Thanh toán hiện là giả lập.** `usp_AssignTrayToCustomer` tạo đơn Active, một dòng Payment Paid và mã giao dịch SIM ngay khi gán; không có cổng thanh toán thật trong luồng này. Form và bước xác nhận nói rõ tác động đó, không xác nhận đã thu tiền ngoài hệ thống.
2. **Khay có thể bị người khác thuê sau khi tải danh sách.** Procedure khóa và kiểm tra lại trạng thái; nếu trả 409, giữ form và hiển thị lỗi. Có nút cập nhật gói/khay, sau cập nhật phải chọn dữ liệu còn hợp lệ. Không đảm bảo giữ khay chỉ bằng việc chọn trong trình duyệt.
3. **Gán khay chưa kiểm tra phòng Active ở backend.** `/trays?status=Available` cũng không trả trạng thái hoạt động của phòng. Vì vậy danh sách có thể gồm khay trong phòng ngừng hoạt động. Cần nhóm trưởng thống nhất và sửa điều kiện tại backend; không tự sửa hoặc bổ sung API phòng trong phạm vi này.
4. **Không có khóa chống tạo trùng theo yêu cầu.** Chặn gửi lặp chỉ có hiệu lực với form đang mở. Nếu mạng mất sau khi server đã tạo đơn, frontend không biết chắc kết quả; không tự gửi lại và không báo thành công khi chưa có xác nhận.
5. **Phân trang trang rỗng:** backend lấy total từ `COUNT(*) OVER()`, nên trang rỗng có thể trả total 0 dù trang trước còn dữ liệu. Nút Trước vẫn hoạt động khi page > 1; đổi bộ lọc hoặc gán thành công đưa về trang đầu nếu đang ở trang sau. Bộ chọn khách áp dụng cùng cơ chế này.
6. **Lịch sử dùng một số thông tin hiện tại:** API chi tiết nối gói và khay hiện tại, không cung cấp snapshot tên/giá gói hoặc trạng thái khay tại ngày thuê. Giao diện dùng `Rentals.TotalAmount`/`Payments.Amount` do backend trả để hiển thị tiền, không nhân lại giá gói. Có ghi rõ trạng thái khay là hiện tại.
7. **Khách đã xóa mềm:** `/users` không trả khách đã xóa, nên bộ chọn không thể chọn họ để lọc; đơn cũ vẫn có thể được xem trong danh sách không lọc. Không thêm tìm kiếm giả trên một trang đơn đã tải.
8. **Sau gán:** nếu bộ lọc đang loại trừ đơn mới, đơn có thể không xuất hiện trong danh sách hiện tại. Nút “Xem đơn #...” dùng mã backend trả cho phép xem trực tiếp. Nếu thiếu mã hợp lệ, không dựng link giả, chỉ thông báo kiểm tra danh sách.

## Kiểm tra thực tế

Ngày 07/11/2026:

- Build module, JSX/CSS và entry export bằng esbuild thành công trong harness ngoài repo, dùng React 18.3.1.
- **14/14** kiểm tra Node đạt: quyền và ID, mapping/query, dữ liệu bắt buộc, lựa chọn hết hiệu lực, ngày/tiền, auth/body/signal, lỗi nghiệp vụ, mất mạng, response không hợp lệ và chống tự retry.
- **21/21** kiểm tra Playwright trên Chrome headless với React StrictMode đạt, không retry: Admin/Operator/Customer/guest, danh sách, phân trang/lọc, tìm/chọn khách, chi tiết/404/thử lại, tạo đơn/xác nhận, xung đột/giữ form, cập nhật lựa chọn, ngăn gửi lặp, API lỗi/rỗng/401/403, request cũ, đổi phiên và viewport 390×844.
- Đã xem ảnh giao diện máy tính và form trên điện thoại. Ảnh, log, build output và harness không nằm trong repo.

**Toàn bộ kiểm tra trình duyệt dùng API mock. Chưa xác nhận tích hợp với backend/SQL Server thật hoặc build toàn ứng dụng chung.** Không có frontend chung trên main và không có backend dev lắng nghe cổng 3000 khi thực hiện. Không tạo/reset CSDL và không chạy thao tác ghi trên dữ liệu dùng chung.

Chạy kiểm tra Node, không cần cài dependency:

```powershell
node --test web-admin/src/features/rentals-management/tests/api.test.mjs web-admin/src/features/rentals-management/tests/model.test.mjs
```

Node 20+ có Fetch/Response và `node:test`; môi trường đã chạy là Node 26.13.0.

Để chạy lại browser spec `tests/rentals.spec.cjs` mà không sửa cấu hình chung:

1. Tạo harness tạm **ngoài repo**. Cài hoặc dùng lại React/ReactDOM 18.3.1, esbuild 0.25.12 và Playwright 1.56.1 trong môi trường tạm; không cài vào repo.
2. Entry import module và CSS bằng đường dẫn tuyệt đối, bọc Provider trong React StrictMode. Mặc định currentUser `{ UserId: 1, Role: 'Admin' }`; lấy `role`/`userId` từ query. `role=guest` truyền `null`. Truyền `baseUrl = location.origin + '/api'`, hàm token chỉ dùng kiểm tra, callback 401 tăng `window.rmExpired`.
3. Với query `client=provided`, truyền một client bao ngoài `createRentalsClient` nhưng bỏ `signal` trước khi gọi, để kiểm tra phản hồi cũ. Cho harness đổi người dùng qua `window.rmSetUser = setUser`. Nếu `view=detail`, chỉ render `<RentalDetails rentalId={query.get('rentalId')} />`; còn lại render trang quản lý.
4. Bundle bằng esbuild với `nodePaths` trỏ dependency tạm; phục vụ HTML, JS, CSS tại loopback (lần kiểm tra này dùng `http://127.0.0.1:4181`). Spec tự chặn `/api/**` bằng mock tách riêng trong thư mục tests.
5. Cấu hình Playwright ngoài repo: `testDir` tới thư mục tests của module, `testMatch: '**/*.spec.cjs'`, `use.baseURL` tới harness, Chrome headless, viewport 1440×1000, workers 1, retries 0; đặt `outputDir` ngoài repo.
6. Đặt `NODE_PATH` tới `node_modules` chứa Playwright rồi chạy CLI với cấu hình ngoài repo. Tùy chọn `RM_SCREENSHOT_DIR` để ghi ảnh ra thư mục ngoài repo.

```powershell
$qaDir = 'C:\path\to\temporary-rentals-harness'
$qaDeps = 'C:\path\to\temporary-dependencies'
$env:NODE_PATH = Join-Path $qaDeps 'node_modules'
node (Join-Path $qaDeps 'node_modules\@playwright\test\cli.js') test --config (Join-Path $qaDir 'playwright.config.cjs')
```

## Danh sách file bàn giao

Tất cả file nguồn sau thuộc `web-admin/src/features/rentals-management/`:

| File | Nội dung |
| --- | --- |
| `index.js` | Entry export riêng |
| `RentalsManagementProvider.jsx` | Interface người dùng, API và hết phiên |
| `api.mjs` | Fetch client và lỗi |
| `model.mjs` | Enum, query, validation, body, ngày/tiền |
| `useRentalData.js` | Tải dữ liệu, abort và bỏ response cũ |
| `RentalsManagementPage.jsx` | Danh sách, bộ lọc và điều phối hộp thoại |
| `CustomerPicker.jsx` | Tìm/chọn khách có phân trang |
| `RentalDetails.jsx` | Chi tiết chỉ đọc |
| `AssignTrayDialog.jsx` | Chọn dữ liệu, xác nhận và gửi gán khay |
| `ui.jsx` | Table, dialog, phân trang và trạng thái nội bộ |
| `styles.css` | CSS giới hạn phạm vi |
| `tests/model.test.mjs` | Kiểm tra logic |
| `tests/api.test.mjs` | Kiểm tra Fetch client |
| `tests/rentals.spec.cjs` | Kiểm tra trình duyệt bằng mock |

Tài liệu: `web-admin/docs/rentals-management.md`. Tổng cộng 15 file mới; không có `.env`, bí mật, node_modules, build output hoặc ứng dụng thử nghiệm trong phần bàn giao.
