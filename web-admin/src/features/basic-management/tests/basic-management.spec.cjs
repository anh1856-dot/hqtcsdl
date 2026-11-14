// Browser-only mock tests. Run with an external harness described in the handoff.
const { test, expect } = require('@playwright/test');

const mushrooms = [
  { MushroomTypeId: 1, TypeName: 'Nấm bào ngư', GrowthDays: 28, ExpectedYieldKg: 1.2, Description: 'Ưa ẩm', ImageUrl: 'https://example.test/nam.png' },
  { MushroomTypeId: 2, TypeName: 'Nấm linh chi', GrowthDays: 90, ExpectedYieldKg: null, Description: null, ImageUrl: null },
];
const packages = [
  { PackageId: 1, PackageName: 'Gói cơ bản', DurationDays: 30, PricePerTray: 150000, MaxTrays: 5, IsActive: true },
  { PackageId: 2, PackageName: 'Gói cũ', DurationDays: 60, PricePerTray: 250000, MaxTrays: 10, IsActive: false },
];
const rooms = [{ RoomId: 1, RoomCode: 'R01', RoomName: 'Phòng bào ngư', Capacity: 20, TrayCount: 12, AvailableTrays: 5, Status: 'Active', Description: 'Phòng chính' }];
const users = Array.from({ length: 23 }, (_, i) => ({
  UserId: i + 1, FullName: i === 0 ? 'Quản trị viên' : `Người dùng ${i + 1}`,
  Email: `user${i + 1}@example.test`, Role: i === 0 ? 'Admin' : 'Customer',
  Status: i === 2 ? 'Disabled' : 'Active', Phone: '', Address: null,
}));

async function mockApi(page) {
  const state = { mushrooms: structuredClone(mushrooms), packages: structuredClone(packages), rooms: structuredClone(rooms), users: structuredClone(users), calls: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');
    const method = request.method();
    const body = request.postDataJSON();
    state.calls.push({ path, method, body, query: url.searchParams, authorization: request.headers().authorization });
    let rows, idKey, root;
    if (path.startsWith('/mushroom-types')) { rows = state.mushrooms; idKey = 'MushroomTypeId'; root = '/mushroom-types'; }
    else if (path.startsWith('/packages')) { rows = state.packages; idKey = 'PackageId'; root = '/packages'; }
    else if (path.startsWith('/rooms')) { rows = state.rooms; idKey = 'RoomId'; root = '/rooms'; }
    else if (path.startsWith('/users')) { rows = state.users; idKey = 'UserId'; root = '/users'; }
    else throw new Error(`Unexpected API: ${method} ${path}`);
    if (method === 'GET') {
      let data = [...rows];
      if (root === '/packages' && path === '/packages') data = data.filter((row) => row.IsActive);
      if (root === '/users') {
        if (url.searchParams.get('role')) data = data.filter((row) => row.Role === url.searchParams.get('role'));
        if (url.searchParams.get('status')) data = data.filter((row) => row.Status === url.searchParams.get('status'));
        if (url.searchParams.get('q')) data = data.filter((row) => row.FullName.toLowerCase().includes(url.searchParams.get('q').toLowerCase()));
        const pageNumber = Number(url.searchParams.get('page') || 1);
        const pageSize = Number(url.searchParams.get('pageSize') || 10);
        return route.fulfill({ json: { data: data.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), pagination: { page: pageNumber, pageSize, total: data.length } } });
      }
      return route.fulfill({ json: { data } });
    }
    const id = Number(path.split('/')[2]);
    const index = rows.findIndex((row) => row[idKey] === id);
    const mapping = { typeName: 'TypeName', growthDays: 'GrowthDays', expectedYieldKg: 'ExpectedYieldKg', description: 'Description', imageUrl: 'ImageUrl', packageName: 'PackageName', durationDays: 'DurationDays', pricePerTray: 'PricePerTray', maxTrays: 'MaxTrays', isActive: 'IsActive', roomCode: 'RoomCode', roomName: 'RoomName', capacity: 'Capacity', status: 'Status', fullName: 'FullName', email: 'Email', role: 'Role', phone: 'Phone', address: 'Address' };
    const mapped = Object.fromEntries(Object.entries(body || {}).filter(([key]) => key in mapping).map(([key, value]) => [mapping[key], value]));
    if (method === 'POST') {
      const row = { [idKey]: 100, ...mapped, ...(root === '/packages' ? { IsActive: true } : {}) };
      rows.push(row);
      return route.fulfill({ status: 201, json: { data: row } });
    }
    if (method === 'DELETE') {
      if (root === '/packages') rows[index].IsActive = false;
      else rows.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    Object.assign(rows[index], mapped);
    return route.fulfill({ json: { data: rows[index] } });
  });
  return state;
}

async function open(page, name, role = 'Admin', extra = '') {
  await page.goto(`/?page=${name}&role=${role}${extra}`);
}
const dialog = (page) => page.getByRole('dialog');
const save = (page) => dialog(page).getByRole('button', { name: 'Lưu thay đổi' });

for (const [name, title, content] of [
  ['mushrooms', 'Quản lý loại nấm', 'Nấm bào ngư'], ['packages', 'Quản lý gói thuê', 'Gói cũ'],
  ['rooms', 'Quản lý phòng nuôi', 'Phòng bào ngư'], ['users', 'Quản lý tài khoản', 'Quản trị viên'],
]) test(`renders exported ${name} page with PascalCase data`, async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await mockApi(page); await open(page, name);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toContainText(content);
  expect(failures).toEqual([]);
});

test('read-only roles cannot mutate mushrooms/packages; Operator cannot open accounts', async ({ page }) => {
  const state = await mockApi(page);
  await open(page, 'mushrooms', 'Operator'); await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm loại nấm' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Sửa / })).toHaveCount(0);
  await open(page, 'packages', 'Operator'); await expect(page.getByRole('table')).toContainText('Gói cơ bản');
  await expect(page.getByRole('table')).not.toContainText('Gói cũ');
  expect(state.calls.filter((call) => call.path === '/packages/all')).toHaveLength(0);
  await open(page, 'users', 'Operator'); await expect(page.getByText('Không có quyền truy cập')).toBeVisible();
  expect(state.calls.filter((call) => call.path === '/users')).toHaveLength(0);
});

test('Operator can create/edit rooms but cannot delete; Customer cannot access rooms', async ({ page }) => {
  await mockApi(page); await open(page, 'rooms', 'Operator');
  await expect(page.getByRole('button', { name: 'Thêm phòng nuôi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa Phòng bào ngư' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Xóa phòng/ })).toHaveCount(0);
  await open(page, 'rooms', 'Customer'); await expect(page.getByText('Không có quyền truy cập')).toBeVisible();
});

test('mushroom create validates numbers and URLs, preserves form after 409 then succeeds', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'mushrooms');
  await page.getByRole('button', { name: 'Thêm loại nấm' }).click();
  await dialog(page).getByLabel('Tên loại nấm').fill('Nấm mới');
  await dialog(page).getByLabel('Số ngày sinh trưởng').fill('1.5'); await save(page).click();
  await expect(dialog(page).getByText('Vui lòng nhập số nguyên.')).toBeVisible();
  expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  await dialog(page).getByLabel('Số ngày sinh trưởng').fill('28');
  await dialog(page).getByLabel('Sản lượng dự kiến').fill('0');
  await dialog(page).getByLabel('URL ảnh').fill('javascript:bad'); await save(page).click();
  await expect(dialog(page).getByText('Nhập URL bắt đầu bằng http:// hoặc https://.')).toBeVisible();
  await dialog(page).getByLabel('URL ảnh').fill('https://example.test/new.png');
  await page.route('**/api/mushroom-types', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 409, json: { error: { message: 'Tên loại nấm đã tồn tại.' } } }) : route.fallback());
  await save(page).click(); await expect(dialog(page).getByRole('alert')).toContainText('Tên loại nấm đã tồn tại.');
  await expect(dialog(page).getByLabel('Tên loại nấm')).toHaveValue('Nấm mới');
  await expect(dialog(page).getByLabel('Số ngày sinh trưởng')).toHaveValue('28');
  await page.unroute('**/api/mushroom-types');
  await save(page).click(); await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('table')).toContainText('Nấm mới');
  const created = state.calls.find((call) => call.method === 'POST');
  expect(created.body).toEqual({ typeName: 'Nấm mới', growthDays: 28, expectedYieldKg: 0, imageUrl: 'https://example.test/new.png', description: null });
});

test('mushroom edit prevents unsupported clearing; delete requires confirmation and shows in-use errors', async ({ page }) => {
  await mockApi(page); await open(page, 'mushrooms');
  await page.getByRole('button', { name: 'Sửa Nấm bào ngư' }).click();
  await dialog(page).getByLabel('URL ảnh').fill(''); await save(page).click();
  await expect(dialog(page).getByText(/API hiện chưa hỗ trợ xóa trắng/)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.route('**/api/mushroom-types/1', (route) => route.fulfill({ status: 409, json: { error: { message: 'Loại nấm đang được sử dụng.' } } }));
  await page.getByRole('button', { name: 'Xóa loại nấm Nấm bào ngư' }).click();
  await expect(dialog(page)).toContainText('Xóa loại nấm “Nấm bào ngư”?');
  await dialog(page).getByRole('button', { name: 'Xóa loại nấm', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Loại nấm đang được sử dụng.');
  await expect(page.getByRole('table')).toContainText('Nấm bào ngư');
});

test('package create maps numbers including zero price and formats VND', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'packages');
  await expect(page.getByRole('table')).toContainText('150.000');
  await page.getByRole('button', { name: 'Thêm gói thuê' }).click();
  await dialog(page).getByLabel('Tên gói thuê').fill('Gói mới');
  await dialog(page).getByLabel('Thời hạn').fill('30');
  await dialog(page).getByLabel('Giá mỗi khay').fill('0');
  await dialog(page).getByLabel('Số khay tối đa').fill('2'); await save(page).click();
  await expect(dialog(page)).toHaveCount(0); await expect(page.getByRole('table')).toContainText('Gói mới');
  expect(state.calls.find((call) => call.method === 'POST').body).toEqual({ packageName: 'Gói mới', durationDays: 30, pricePerTray: 0, maxTrays: 2, description: null });
});

test('package stop is not permanent delete; PUT can activate an old package', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'packages');
  await page.getByRole('button', { name: 'Ngừng áp dụng Gói cơ bản' }).click();
  await expect(dialog(page)).toContainText('Các đơn cũ và dữ liệu gói vẫn được giữ lại.');
  await dialog(page).getByRole('button', { name: 'Ngừng áp dụng', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('table').getByText('Gói cơ bản')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ngừng áp dụng Gói cơ bản' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sửa Gói cũ' }).click();
  await dialog(page).getByLabel('Trạng thái').selectOption('true'); await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(state.calls.find((call) => call.path === '/packages/2' && call.method === 'PUT').body.isActive).toBe(true);
});

test('room create/edit follows contract; room code is immutable and capacity is validated', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'rooms');
  await page.getByRole('button', { name: 'Thêm phòng nuôi' }).click();
  await dialog(page).getByLabel('Mã phòng').fill('R04'); await dialog(page).getByLabel('Tên phòng').fill('Phòng mới');
  await dialog(page).getByLabel('Sức chứa').fill('0'); await save(page).click();
  await expect(dialog(page).getByText('Giá trị phải từ 1 trở lên.')).toBeVisible();
  await dialog(page).getByLabel('Sức chứa').fill('10'); await save(page).click();
  await expect(dialog(page)).toHaveCount(0); await expect(page.getByRole('table')).toContainText('Phòng mới');
  expect(state.calls.find((call) => call.method === 'POST').body).toEqual({ roomCode: 'R04', roomName: 'Phòng mới', capacity: 10, status: 'Active', description: null });
  await page.getByRole('button', { name: 'Sửa Phòng bào ngư' }).click();
  await expect(dialog(page).getByLabel('Mã phòng')).toBeDisabled();
  await dialog(page).getByLabel('Sức chứa').fill('5'); await save(page).click();
  await expect(dialog(page).getByText('Giá trị phải từ 12 trở lên.')).toBeVisible();
  await dialog(page).getByLabel('Sức chứa').fill('25'); await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(state.calls.find((call) => call.method === 'PUT').body).not.toHaveProperty('roomCode');
});

test('room delete shows backend business error without removing the row', async ({ page }) => {
  await mockApi(page); await open(page, 'rooms');
  await page.route('**/api/rooms/1', (route) => route.fulfill({ status: 409, json: { error: { message: 'Phòng đang có 12 khay, không thể xóa.' } } }));
  await page.getByRole('button', { name: 'Xóa phòng Phòng bào ngư' }).click();
  await dialog(page).getByRole('button', { name: 'Xóa phòng', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Phòng đang có 12 khay');
  await expect(page.getByRole('table')).toContainText('Phòng bào ngư');
});

test('account pagination, search and role/status filters reset to page one', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'users');
  await expect(page.getByText('Trang 1 / 3')).toBeVisible(); await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(page.getByText('Trang 2 / 3')).toBeVisible();
  await page.getByLabel('Vai trò', { exact: true }).selectOption('Customer');
  await expect(page.getByText('Trang 1 / 3')).toBeVisible();
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('Disabled');
  await expect(page.getByRole('table')).toContainText('Người dùng 3');
  await page.getByLabel('Tìm kiếm tài khoản').fill('không tồn tại');
  await expect(page.getByText('Không có tài khoản phù hợp.', { exact: false })).toBeVisible();
  const last = state.calls.filter((call) => call.path === '/users').at(-1);
  expect(last.query.get('page')).toBe('1'); expect(last.query.get('status')).toBe('Disabled'); expect(last.query.get('role')).toBe('Customer');
});

test('slow old search cannot overwrite new results, even when injected client ignores abort', async ({ page }) => {
  await mockApi(page);
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/users?**', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (q === 'old') { await waiting; return route.fulfill({ json: { data: [{ ...users[1], FullName: 'Kết quả cũ' }], pagination: { total: 1 } } }); }
    if (q === 'new') return route.fulfill({ json: { data: [{ ...users[1], FullName: 'Kết quả mới' }], pagination: { total: 1 } } });
    return route.fallback();
  });
  await open(page, 'users', 'Admin', '&client=provided'); await expect(page.getByRole('table')).toBeVisible();
  const oldRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('q') === 'old');
  await page.getByLabel('Tìm kiếm tài khoản').fill('old');
  await oldRequest;
  await page.getByLabel('Tìm kiếm tài khoản').fill('new');
  await expect(page.getByRole('table')).toContainText('Kết quả mới');
  const oldResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get('q') === 'old');
  release(); await oldResponse;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('table')).not.toContainText('Kết quả cũ');
});

test('account creation sends role/password; editing never sends immutable email or hash', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'users');
  await page.getByRole('button', { name: 'Thêm tài khoản', exact: true }).click();
  await dialog(page).getByLabel('Họ tên').fill('Khách mới'); await dialog(page).getByLabel('Email').fill('new@example.test');
  await dialog(page).getByLabel('Mật khẩu ban đầu').fill('temporary-test-password'); await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  const payload = state.calls.find((call) => call.method === 'POST').body;
  expect(payload.role).toBe('Customer'); expect(payload.password).toBe('temporary-test-password'); expect(payload).not.toHaveProperty('PasswordHash');
  await page.getByRole('button', { name: 'Sửa Người dùng 2', exact: true }).click();
  await expect(dialog(page).getByLabel('Email')).toBeDisabled(); await dialog(page).getByLabel('Họ tên').fill('Tên đã sửa'); await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(state.calls.find((call) => call.method === 'PUT').body).not.toHaveProperty('email');
});

test('self-protection and explicit role change confirmation', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'users');
  await expect(page.getByRole('button', { name: 'Khóa Quản trị viên', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xóa mềm Quản trị viên', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sửa Quản trị viên', exact: true }).click();
  await expect(dialog(page).getByLabel('Vai trò')).toBeDisabled(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sửa Người dùng 2', exact: true }).click(); await dialog(page).getByLabel('Vai trò').selectOption('Operator');
  await save(page).click(); await expect(dialog(page).getByText('Vui lòng xác nhận việc đổi vai trò.')).toBeVisible();
  expect(state.calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  await dialog(page).getByRole('checkbox').check(); await save(page).click(); await expect(dialog(page)).toHaveCount(0);
  expect(state.calls.find((call) => call.method === 'PUT').body.role).toBe('Operator');
});

test('account lock, unlock and soft delete use correct confirmed endpoints', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'users');
  await page.getByRole('button', { name: 'Khóa Người dùng 2', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Khóa tài khoản', exact: true }).click(); await expect(dialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở khóa Người dùng 2', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Mở khóa tài khoản', exact: true }).click(); await expect(dialog(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa mềm Người dùng 2', exact: true }).click();
  await expect(dialog(page)).toContainText('lịch sử thuê và thanh toán vẫn được giữ lại');
  await dialog(page).getByRole('button', { name: 'Xóa mềm tài khoản', exact: true }).click(); await expect(dialog(page)).toHaveCount(0);
  expect(state.calls.filter((call) => call.method === 'PATCH').map((call) => call.body.status)).toEqual(['Disabled', 'Active']);
  expect(state.calls.some((call) => call.method === 'DELETE' && call.path === '/users/2')).toBe(true);
});

test('password reset validates and discards secret after successful confirmation', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'users');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu Người dùng 2', exact: true }).click();
  await dialog(page).getByLabel('Mật khẩu mới').fill('123'); await save(page).click();
  await expect(dialog(page).getByText('Mật khẩu phải có ít nhất 6 ký tự.')).toBeVisible();
  await dialog(page).getByLabel('Mật khẩu mới').fill('temporary-new-secret'); await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(state.calls.find((call) => call.path.endsWith('/password')).body).toEqual({ newPassword: 'temporary-new-secret' });
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await expect(page.locator('input[type=password]')).toHaveCount(0);
});

test('pending mutation disables submit/close and refreshes only after success', async ({ page }) => {
  const state = await mockApi(page); await open(page, 'rooms');
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/rooms/1', async (route) => { await gate; return route.fulfill({ json: { data: rooms[0] } }); });
  await page.getByRole('button', { name: 'Sửa Phòng bào ngư' }).click(); await save(page).click();
  await expect(dialog(page).getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
  await expect(dialog(page).getByRole('button', { name: 'Đóng hộp thoại' })).toBeDisabled();
  const reads = state.calls.filter((call) => call.method === 'GET').length;
  await page.keyboard.press('Escape'); await expect(dialog(page)).toBeVisible();
  expect(state.calls.filter((call) => call.method === 'GET').length).toBe(reads);
  release(); await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => state.calls.filter((call) => call.method === 'GET').length).toBeGreaterThan(reads);
});

test('401 delegates to host session handler; 403 shows denial without sample data', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { error: { message: 'Phiên đã hết hạn.' } } }));
  await open(page, 'rooms'); await expect(page.getByRole('alert')).toContainText('Phiên đã hết hạn.');
  await expect.poll(() => page.evaluate(() => window.bmUnauthorizedCount || 0)).toBeGreaterThan(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.unroute('**/api/**');
  await page.route('**/api/**', (route) => route.fulfill({ status: 403, json: { error: { message: 'Bạn không có quyền thực hiện thao tác này.' } } }));
  await open(page, 'mushrooms'); await expect(page.getByRole('alert')).toContainText('Bạn không có quyền');
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('failed load offers retry and empty list is honest', async ({ page }) => {
  let failed = true;
  await page.route('**/api/**', (route) => failed
    ? route.fulfill({ status: 500, json: { error: { message: 'Máy chủ tạm lỗi.' } } })
    : route.fulfill({ json: { data: [] } }));
  await open(page, 'mushrooms'); await expect(page.getByRole('alert')).toContainText('Máy chủ tạm lỗi.');
  failed = false; await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('Chưa có loại nấm nào.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('desktop/mobile layouts keep overflow inside table; dialog keyboard focus works', async ({ page }) => {
  await mockApi(page); await open(page, 'users'); await expect(page.getByRole('table')).toBeVisible();
  if (process.env.BM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.BM_SCREENSHOT_DIR}/users-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Thêm tài khoản', exact: true }).click();
  await expect(dialog(page).getByLabel('Họ tên')).toBeFocused();
  expect(await dialog(page).evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog(page)).toHaveCount(0);
  if (process.env.BM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.BM_SCREENSHOT_DIR}/users-mobile.png`, fullPage: true });
});
