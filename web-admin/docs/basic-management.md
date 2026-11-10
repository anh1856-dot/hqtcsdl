# Bàn giao bốn module quản lý cơ bản

## Phạm vi và vị trí

Toàn bộ mã nguồn nằm trong `web-admin/src/features/basic-management/`. Đây là các trang React độc lập chờ tích hợp, không phải một ứng dụng quản trị hoàn chỉnh. Không đăng ký router/menu, không tạo layout hoặc đăng nhập riêng; không sửa backend, database hay cấu hình chung.

| Trang export | Chức năng | Đường dẫn đề xuất, người tích hợp quyết định |
| --- | --- | --- |
| `MushroomTypesPage` | Danh sách, tìm trong danh sách, thêm/sửa/xóa loại nấm; URL ảnh; xác nhận xóa | `/management/mushroom-types` |
| `RentalPackagesPage` | Danh sách theo quyền, thêm/sửa, ngừng áp dụng; sửa trạng thái để áp dụng lại | `/management/packages` |
| `RoomsPage` | Danh sách, lọc/tìm, thêm/sửa phòng; Admin xóa có xác nhận | `/management/rooms` |
| `UsersPage` | Phân trang/tìm kiếm/lọc trên server, thêm/sửa, đổi vai trò có xác nhận, khóa/mở khóa, đặt lại mật khẩu và xóa mềm | `/management/users` |

Các export khác tại `index.js`: `BasicManagementProvider`, `createBasicManagementClient`, `BasicManagementApiError`.

## Interface tích hợp

Dependency chạy thật: **React và ReactDOM 18 trở lên** do ứng dụng chung cung cấp; Fetch, AbortController, URLSearchParams và HTML `<dialog>` của trình duyệt hiện đại. Không dùng thư viện UI, router, thư viện icon hoặc dependency mới trong cấu hình chung. Module có JSX và ESM, cần pipeline JSX của ứng dụng chứa module.

`BasicManagementProvider` nhận:

| Prop | Hợp đồng |
| --- | --- |
| `currentUser` | `{ id, role }` hoặc response hồ sơ `{ UserId, Role }`; role chính xác là `Admin`, `Operator`, `Customer`. Trang tài khoản cần ID để bảo vệ tài khoản hiện tại. |
| `apiClient` | Tùy chọn, object ổn định có `request(path, { method?, body?, signal? })`; trả Promise của **envelope đã parse** `{ data, pagination? }`, không phải Axios response ngoài cùng. Reject bằng Error có `message`, `status`, tùy chọn `code`. Body là object chưa stringify. |
| `baseUrl` | Nếu không truyền `apiClient`, mặc định `http://localhost:3000/api`. Bao gồm `/api`, không bao gồm endpoint. |
| `getToken` | Nếu không truyền `apiClient`, hàm lấy token hiện tại; hỗ trợ trả Promise. Module không đọc localStorage/sessionStorage. |
| `onUnauthorized` | Hàm kết thúc phiên do ứng dụng chung cung cấp; Provider gọi khi request trả 401. Nên idempotent vì nhiều request có thể cùng hết phiên. Không đăng nhập hoặc điều hướng bên trong module. |
| `children` | Một trong bốn trang hoặc router chứa các trang. |

Giữ `apiClient`, `getToken`, `onUnauthorized` ổn định bằng interface/hook của ứng dụng chung hoặc `useMemo`/`useCallback`, tránh tạo lại client khi render. Provider remount trang khi ID/vai trò thay đổi để bỏ danh sách và form của phiên trước.

Ví dụ sau **chỉ để người tích hợp áp dụng vào các file chung**:

```jsx
import {
  BasicManagementProvider,
  MushroomTypesPage,
  RentalPackagesPage,
  RoomsPage,
  UsersPage,
} from './features/basic-management/index.js';
import './features/basic-management/styles.css';

// session là cơ chế đăng nhập sẵn có của ứng dụng chung.
// Dùng React.useCallback nếu các hàm tương ứng chưa ổn định.
function BasicManagementArea({ session }) {
  const getToken = React.useCallback(() => session.getAccessToken(), [session]);
  const endSession = React.useCallback(() => session.endSession(), [session]);
  return (
    <BasicManagementProvider
      currentUser={session.user}
      baseUrl="http://localhost:3000/api"
      getToken={getToken}
      onUnauthorized={endSession}
    >
      {/* Ví dụ khi ứng dụng chung đã dùng React Router: */}
      <Routes>
        <Route path="/management/mushroom-types" element={<MushroomTypesPage />} />
        <Route path="/management/packages" element={<RentalPackagesPage />} />
        <Route path="/management/rooms" element={<RoomsPage />} />
        <Route path="/management/users" element={<UsersPage />} />
      </Routes>
    </BasicManagementProvider>
  );
}
```

`React`, `Routes`, `Route` trong ví dụ phải được import theo ứng dụng chung. Module không yêu cầu React Router nếu host dùng router khác. Menu đề xuất: **Loại nấm**, **Gói thuê**, **Phòng nuôi**, **Tài khoản**; ẩn mục không có quyền như bảng bên dưới.

Nếu có API client chung, truyền adapter ổn định thay cho `baseUrl/getToken`:

```js
// Minh họa cho client kiểu Axios: response.data chính là envelope của backend.
const basicManagementClient = {
  async request(path, { method = 'GET', body, signal } = {}) {
    try {
      const response = await sharedApi.request({ url: path, method, data: body, signal });
      return response.status === 204 ? { data: null } : response.data;
    } catch (cause) {
      const error = new Error(cause.response?.data?.error?.message || 'Không thể kết nối máy chủ.');
      error.status = cause.response?.status || 0;
      error.code = cause.response?.data?.error?.code;
      throw error;
    }
  },
};
```

`createBasicManagementClient` cũng nhận `{ baseUrl, getToken, onUnauthorized?, fetchImpl? }`. Khi truyền client tạo sẵn vào Provider, chỉ cấu hình callback hết phiên ở **một nơi**, tránh gọi hai lần. Provider đã xử lý 401 cho cả client nội bộ và client được truyền từ ngoài.

## Quyền và hợp đồng API đã đối chiếu

Đối chiếu `backend/API.md`, `backend/README.md`, middleware và bốn route tại base commit `35a6492`. Tên response giữ nguyên PascalCase; request gửi camelCase. Không gọi API ở các module khác.

| Endpoint | Method | Dữ liệu/quyền |
| --- | --- | --- |
| `/mushroom-types` | GET | Người đã đăng nhập, response `data[]` |
| `/mushroom-types` | POST | Admin: `typeName, growthDays, expectedYieldKg, description, imageUrl` |
| `/mushroom-types/:id` | PUT / DELETE | Admin; DELETE trả 204, loại đang được dùng có thể trả 409 |
| `/packages` | GET | Public, chỉ gói `IsActive = true`; dùng cho người không phải Admin |
| `/packages/all` | GET | Admin, gồm cả gói ngừng áp dụng |
| `/packages` | POST | Admin: `packageName, durationDays, pricePerTray, maxTrays, description`; gói mới tự hoạt động |
| `/packages/:id` | PUT | Admin: các trường trên, thêm `isActive` kiểu boolean |
| `/packages/:id` | DELETE | Admin; **ngừng áp dụng**, không xóa vĩnh viễn; trả 204 |
| `/rooms` | GET / POST | Admin hoặc Operator; POST: `roomCode, roomName, capacity, description, status` |
| `/rooms/:id` | PUT | Admin hoặc Operator: `roomName, capacity, description, status`; **không gửi roomCode** |
| `/rooms/:id` | DELETE | Chỉ Admin; có xác nhận, hiển thị nguyên thông báo phòng đang có khay/dữ liệu |
| `/users?q=&role=&status=&page=&pageSize=` | GET | Trang này chỉ dành cho Admin; response có `data[]` và `pagination: { page, pageSize, total }` |
| `/users` | POST | Admin: `fullName, email, password, role, phone, address` |
| `/users/:id` | PUT | Admin: `fullName, phone, address, role`; **không gửi email/password** |
| `/users/:id/status` | PATCH | Admin: `{ status: 'Active' \| 'Disabled' }` |
| `/users/:id/password` | PUT | Admin: `{ newPassword }` |
| `/users/:id` | DELETE | Admin, xóa mềm, trả 204 |

Loại nấm/gói/phòng trả toàn bộ danh sách, không có phân trang hay tìm kiếm API: module tìm/lọc tại trình duyệt trên dữ liệu đã tải. Tài khoản tìm theo mỗi lần thay đổi từ khóa, lọc theo server, đưa về trang 1. Hủy GET bằng AbortController và bỏ phản hồi cũ, kể cả khi client ngoài không hỗ trợ hủy. Mật khẩu chỉ tồn tại tạm trong form/request, được bỏ khi đóng hoặc thành công; không ghi log, không lưu storage.

Admin có toàn bộ thao tác. Operator chỉ xem loại nấm/gói đang áp dụng, được thêm/sửa phòng và không xóa phòng. Customer có thể xem danh sách loại nấm/gói theo quyền API, không truy cập trang phòng/tài khoản. Backend `/users` cho Operator đọc khách hàng phục vụ gán khay, nhưng **trang quản lý tài khoản này chủ ý chỉ dành cho Admin** theo phân công.

## Style và hành vi

Import `styles.css` **một lần** tại nơi tích hợp. Mọi selector đều nằm trong `.bm-root`; các class/keyframes dùng tiền tố `bm-`. Không có style cho `body`, `html`, `:root` hoặc thành phần ngoài module. CSS toàn cục của host vẫn có thể tác động vào module nên cần kiểm tra lại khi ghép layout thật.

Giao diện tiếng Việt; bàn phím và label cho form; dialog native giữ focus, Escape đóng khi không gửi request. Khi đang lưu, khóa form/nút đóng/gửi; chỉ tải lại danh sách sau thành công. Lỗi giữ nguyên form. Bảng có vùng cuộn ngang riêng trên điện thoại. Có loading, empty state, retry, phản hồi thành công và lỗi nghiệp vụ từ `error.message`.

## Giới hạn API cần báo nhóm trưởng

- PUT loại nấm dùng `COALESCE`: chưa xóa trắng được sản lượng, mô tả, URL ảnh đã có. PUT gói thuê tương tự với mô tả. Form chặn việc xóa trắng những giá trị đó và giải thích, tránh báo thành công nhưng dữ liệu không đổi. Có thể sửa sang giá trị mới. Không sửa backend để xử lý.
- Backend **có hỗ trợ** áp dụng lại gói qua `PUT isActive: true`; thao tác thực hiện trong form sửa gói. Không có endpoint restore riêng.
- Giá gói là `DECIMAL(12,0)` nên form nhận số nguyên VNĐ, sản lượng `DECIMAL(6,2)` nhận tối đa hai chữ số thập phân.
- API phòng trả `TrayCount`, `AvailableTrays`, `InUseTrays`; trang hiện số khay hiện có và khay trống. Giá trị 0 vẫn hiển thị 0; nếu client ngoài không trả một trường đếm, giao diện hiển thị `—` thay vì tự suy diễn.
- Xóa phòng có thể bị khóa ngoại chặn khi còn thiết bị/dữ liệu. Luồng DELETE hiện xóa ngưỡng rồi xóa phòng mà không bọc transaction; nếu bước xóa phòng lỗi, ngưỡng có thể đã bị xóa. Cần nhóm trưởng xem xét; module không gọi API ngưỡng và không sửa backend.
- Phân trang `/users` lấy `total` từ `COUNT(*) OVER()`; trang rỗng có thể trả `total = 0` dù trang trước còn dữ liệu. Nút Trước vẫn dùng được; sau cập nhật tài khoản, module về trang 1 nếu đang ở trang sau.
- Các vấn đề CSDL đã review trước đây (lịch sử thu hoạch/loại nấm, gán khay phòng ngừng hoạt động, ràng buộc sức chứa) nằm ngoài phạm vi bốn module này.

## Kiểm tra và kết quả thực tế

Không có ứng dụng frontend chung, không có `package.json` của web và không có backend dev đang lắng nghe cổng 3000 tại thời điểm làm. Không tạo/reset CSDL, không chạy bộ smoke test có ghi dữ liệu của backend. **Chưa kiểm thử tích hợp backend thật hoặc build toàn ứng dụng chung.**

Kiểm tra logic/API client độc lập, không cần dependency:

```powershell
node --test web-admin/src/features/basic-management/tests/apiClient.test.mjs web-admin/src/features/basic-management/tests/model.test.mjs
```

Node 20+ cung cấp `node:test`, Fetch/Response; môi trường thực chạy Node 26.13.0. Bộ kiểm tra gồm 12 ca: validation, mapping PascalCase/camelCase, boolean/giá 0, trường bất biến, mật khẩu, truy vấn phân trang, auth header, abort, 204, lỗi nghiệp vụ/401/403, mạng và response sai định dạng.

Kiểm tra trình duyệt đặt tại `tests/basic-management.spec.cjs`, dùng Playwright **chỉ trong môi trường tạm ngoài repo**. Không có mock nào được import từ entry chạy thật. Spec tự chặn `/api/**` để kiểm tra với mock, không gọi backend thật.

Để tái chạy, tạo một harness React tạm ngoài repo:

1. Cài `react@18.3.1`, `react-dom@18.3.1`, `esbuild@0.25.12`, `@playwright/test@1.56.1` vào harness, không chạy cài đặt ở repo.
2. Entry harness import bốn trang và Provider từ đường dẫn tuyệt đối tới `index.js`, import `styles.css`. Chọn trang theo query `page=mushrooms|packages|rooms|users`, role theo `role`, ID mặc định 1. Bọc bằng React StrictMode.
3. Dùng `baseUrl = location.origin + '/api'`, `getToken` trả token chỉ dùng kiểm tra. Callback 401 tăng `window.bmUnauthorizedCount`. Nếu query `client=provided`, truyền API client bọc `createBasicManagementClient` nhưng bỏ `signal` để spec kiểm tra phản hồi cũ.
4. Bundle bằng esbuild với `nodePaths: [<harness>/node_modules]`, phục vụ HTML/bundle/CSS trên loopback, ví dụ `http://127.0.0.1:4179`. Đây là máy chủ kiểm tra, không phải ứng dụng cần ghép vào repo.
5. Cấu hình Playwright `testDir` trỏ tới thư mục `tests` của module, `testMatch: '**/*.spec.cjs'`, `use.baseURL` trỏ harness, `browserName: 'chromium'`, `channel: 'chrome'`, viewport `1440×1000`, `workers: 1`, `retries: 0`. Đặt `NODE_PATH` tới `node_modules` của harness để spec resolve Playwright. `outputDir` đặt ngoài repo. Tùy chọn `BM_SCREENSHOT_DIR` để chụp desktop/mobile ngoài repo.

Ví dụ lệnh chạy sau khi đã chuẩn bị harness:

```powershell
$qaDir = 'C:\path\to\temporary-harness'
$env:NODE_PATH = Join-Path $qaDir 'node_modules'
node (Join-Path $qaDir 'node_modules\@playwright\test\cli.js') test --config (Join-Path $qaDir 'playwright.config.cjs')
```

Kết quả thực chạy ngày 07/11/2026:

- Build harness bằng esbuild thành công, toàn bộ export/JSX/CSS resolve được với React 18.3.1.
- **12/12** kiểm tra Node đạt.
- **22/22** kiểm tra Playwright đạt trên Google Chrome headless, React StrictMode, không retry. Các ca gồm render bốn trang, quyền, validation/mapping CRUD, giữ form khi 409, ngừng/áp dụng lại gói, mã phòng/email bất biến, phân trang/lọc, phản hồi cũ, tự bảo vệ Admin, reset mật khẩu, khóa nút khi chờ, 401/403, retry/empty và viewport 390×844.
- Đã xem ảnh chụp desktop/mobile từ harness; ảnh và kết quả tạm nằm ngoài repo.
- Diff chỉ có mã module và tài liệu bàn giao; không có thay đổi backend/database/file chung. Không có dependency hoặc build output trong phần bàn giao.

Build harness chỉ xác minh import/export và JSX/CSS của module, không xác minh tích hợp router/menu/layout của nhóm. Toàn bộ kiểm tra trình duyệt dùng API mock; chưa xác nhận CRUD thật với SQL Server và backend đang chạy.

## Danh sách file

- `index.js`: entry export riêng.
- `BasicManagementProvider.jsx`, `apiClient.mjs`: interface người dùng và kết nối API.
- `MushroomTypesPage.jsx`, `RentalPackagesPage.jsx`, `RoomsPage.jsx`, `UsersPage.jsx`: bốn trang.
- `ResourcePage.jsx`, `resourceDefinitions.jsx`: bảng/form cho ba danh mục, endpoint/quyền/trường dữ liệu.
- `components.jsx`, `hooks.js`, `model.mjs`: thành phần và logic nội bộ module.
- `styles.css`: CSS giới hạn phạm vi.
- `tests/apiClient.test.mjs`, `tests/model.test.mjs`, `tests/basic-management.spec.cjs`: kiểm thử.
- `web-admin/docs/basic-management.md`: tài liệu này.

Không đưa `.env`, token thật, mật khẩu thật, node_modules, build output, ảnh hoặc harness tạm vào thay đổi bàn giao.
