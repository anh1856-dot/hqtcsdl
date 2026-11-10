// These are browser tests against explicit mocks, never a replacement for live API data.
const { test, expect } = require('@playwright/test');

const sampleCustomers = Array.from({ length: 23 }, (_, index) => ({ UserId: index + 4, FullName: `Khách hàng ${index + 1}`, Email: `customer${index + 1}@example.test`, Role: 'Customer', Status: index === 22 ? 'Disabled' : 'Active', IsDeleted: false }));
const samplePackages = [{ PackageId: 1, PackageName: 'Gói cơ bản', DurationDays: 30, PricePerTray: 150000, IsActive: true }, { PackageId: 2, PackageName: 'Gói đã ngừng', DurationDays: 60, IsActive: false }];
const sampleTrays = [{ TrayId: 11, TrayCode: 'TRAY-R01-001', RoomName: 'Phòng A', Status: 'Available' }, { TrayId: 12, TrayCode: 'TRAY-R01-002', RoomName: 'Phòng A', Status: 'Available' }, { TrayId: 13, TrayCode: 'TRAY-R01-003', RoomName: 'Phòng B', Status: 'Rented' }];
const sampleRentals = Array.from({ length: 24 }, (_, index) => ({ RentalId: 24 - index, CustomerId: index % 2 ? 5 : 4, CustomerName: index % 2 ? 'Khách hàng 2' : 'Khách hàng 1', PackageId: 1, PackageName: 'Gói cơ bản', StartDate: '2026-11-07T00:00:00.000Z', EndDate: '2026-12-07T00:00:00.000Z', TrayCount: 2, TotalAmount: 777000, Status: ['Active', 'Completed', 'Pending', 'Cancelled'][index % 4] }));

async function mockApi(page) {
  const state = { customers: structuredClone(sampleCustomers), packages: structuredClone(samplePackages), trays: structuredClone(sampleTrays), rentals: structuredClone(sampleRentals), calls: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(4);
    const method = request.method();
    const body = request.postDataJSON();
    const query = url.searchParams;
    state.calls.push({ path, method, body, query, authorization: request.headers().authorization });
    const paged = (data) => {
      const number = Number(query.get('page') || 1), size = Number(query.get('pageSize') || 10);
      return { data: data.slice((number - 1) * size, number * size), pagination: { page: number, pageSize: size, total: data.length } };
    };
    if (path === '/rentals' && method === 'GET') {
      let rows = state.rentals;
      if (query.get('status')) rows = rows.filter((item) => item.Status === query.get('status'));
      if (query.get('customerId')) rows = rows.filter((item) => item.CustomerId === Number(query.get('customerId')));
      return route.fulfill({ json: paged(rows) });
    }
    if (/^\/rentals\/\d+$/.test(path) && method === 'GET') {
      const row = state.rentals.find((item) => item.RentalId === Number(path.split('/')[2]));
      if (!row) return route.fulfill({ status: 404, json: { error: { message: 'Không tìm thấy đơn thuê.' } } });
      return route.fulfill({ json: { data: { ...row, DurationDays: 30, PricePerTray: 150000,
        trays: [{ ...state.trays[0], IsActive: true, IsLinked: false }],
        payments: [{ PaymentId: 1, Amount: row.TotalAmount, Method: 'Cash', Status: 'Paid', PaidAt: '2026-11-07T10:00:00Z', TransactionRef: 'SIM-MOCK-1' }],
      } } });
    }
    if (path === '/users' && method === 'GET') {
      let rows = state.customers.filter((item) => item.Role === 'Customer');
      if (query.get('status')) rows = rows.filter((item) => item.Status === query.get('status'));
      if (query.get('q')) rows = rows.filter((item) => item.FullName.toLowerCase().includes(query.get('q').toLowerCase()));
      return route.fulfill({ json: paged(rows) });
    }
    if (path === '/packages' && method === 'GET') return route.fulfill({ json: { data: state.packages.filter((item) => item.IsActive) } });
    if (path === '/trays' && method === 'GET') return route.fulfill({ json: { data: state.trays.filter((item) => item.Status === query.get('status')) } });
    if (path === '/rentals/assign' && method === 'POST') {
      const customer = state.customers.find((item) => item.UserId === body.customerId);
      state.trays.find((item) => item.TrayCode === body.trayCode).Status = 'Rented';
      state.rentals.unshift({ ...sampleRentals[0], RentalId: 101, CustomerId: customer.UserId, CustomerName: customer.FullName, TrayCount: 1, TotalAmount: 321000 });
      return route.fulfill({ status: 201, json: { data: { rentalId: 101 } } });
    }
    throw new Error(`Unexpected API ${method} ${path}`);
  });
  return state;
}
const modal = (page) => page.getByRole('dialog');
async function visit(page, query = '') { await page.goto(`/?${query}`); }
async function openAssignment(page) { await page.getByRole('button', { name: 'Gán khay cho khách', exact: true }).click(); }
async function fillAssignment(page) {
  await modal(page).getByRole('button', { name: 'Khách hàng nhận khay', exact: true }).click();
  await modal(page).getByRole('button', { name: 'Chọn Khách hàng 1 (#4)', exact: true }).click();
  await modal(page).getByLabel('Gói thuê đang áp dụng', { exact: true }).selectOption('1');
  await modal(page).getByLabel('Mã khay còn trống', { exact: true }).selectOption('TRAY-R01-001');
  await modal(page).getByLabel('Phương thức thanh toán', { exact: true }).selectOption('BankTransfer');
}
async function review(page) { await modal(page).getByRole('button', { name: 'Kiểm tra thông tin', exact: true }).click(); }
async function confirm(page) { await modal(page).getByRole('button', { name: 'Xác nhận gán khay', exact: true }).click(); }

for (const role of ['Admin', 'Operator']) test(`${role} reads rentals with real field mapping and no automatic writes`, async ({ page }) => {
  const state = await mockApi(page); await visit(page, `role=${role}`);
  await expect(page.getByRole('heading', { name: 'Quản lý đơn thuê', exact: true })).toBeVisible();
  const table = page.getByRole('region', { name: 'Danh sách đơn thuê' });
  await expect(table).toContainText('#24'); await expect(table).toContainText('777.000'); await expect(table).toContainText('07/11/2026');
  await expect(page.getByRole('button', { name: 'Gán khay cho khách', exact: true })).toBeVisible();
  expect(state.calls.every((call) => call.method === 'GET' && call.path === '/rentals')).toBe(true);
  expect(state.calls[0].authorization).toBe('Bearer mock-verification-only');
});

for (const query of ['role=Customer', 'role=guest', 'role=Admin&userId=-1']) test(`denies access without administrative identity: ${query}`, async ({ page }) => {
  const state = await mockApi(page); await visit(page, query);
  await expect(page.getByRole('alert')).toContainText('Không có quyền truy cập');
  await expect(page.getByRole('button', { name: 'Gán khay cho khách', exact: true })).toHaveCount(0);
  expect(state.calls).toHaveLength(0);
});

test('pagination and status/page-size filters use server parameters and reset page one', async ({ page }) => {
  const state = await mockApi(page); await visit(page);
  await expect(page.getByText('Trang 1 / 3')).toBeVisible(); await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(page.getByText('Trang 2 / 3')).toBeVisible();
  await page.getByLabel('Trạng thái đơn thuê', { exact: true }).selectOption('Completed');
  await expect(page.getByText('Trang 1 / 1')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Danh sách đơn thuê' })).toContainText('Đã kết thúc');
  await page.getByLabel('Số dòng mỗi trang', { exact: true }).selectOption('20');
  await expect.poll(() => state.calls.at(-1).query.get('pageSize')).toBe('20');
  expect(state.calls.at(-1).query.get('page')).toBe('1'); expect(state.calls.at(-1).query.get('status')).toBe('Completed');
  expect(state.calls.at(-1).query.has('q')).toBe(false);
});

test('customer filter searches and paginates customers, then sends customerId to rentals', async ({ page }) => {
  const state = await mockApi(page); await visit(page);
  await page.getByRole('button', { name: 'Lọc theo khách hàng', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Chọn lọc theo khách hàng', exact: true });
  await expect(picker.getByText('Trang 1 / 3')).toBeVisible(); await picker.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(picker.getByText('Trang 2 / 3')).toBeVisible();
  await picker.getByLabel('Tìm khách hàng theo tên, email hoặc số điện thoại').fill('Khách hàng 23');
  await picker.getByRole('button', { name: 'Chọn Khách hàng 23 (#26)', exact: true }).click();
  await expect.poll(() => state.calls.filter((call) => call.path === '/rentals').at(-1).query.get('customerId')).toBe('26');
  const search = state.calls.filter((call) => call.path === '/users').at(-1);
  expect(search.query.get('page')).toBe('1'); expect(search.query.has('status')).toBe(false);
  await page.getByRole('button', { name: 'Bỏ chọn lọc theo khách hàng' }).click();
  await expect(page.getByRole('region', { name: 'Danh sách đơn thuê' })).toContainText('#24');
});

test('details show backend totals, trays and payments without mutation controls', async ({ page }) => {
  await mockApi(page); await visit(page); await page.getByRole('button', { name: 'Xem đơn #24', exact: true }).click();
  await expect(modal(page).getByText('Tổng tiền đơn', { exact: true })).toBeVisible();
  await expect(modal(page)).toContainText('777.000'); await expect(modal(page)).not.toContainText('150.000');
  await expect(modal(page).getByRole('region', { name: 'Khay thuộc đơn thuê' })).toContainText('TRAY-R01-001');
  await expect(modal(page).getByRole('region', { name: 'Lịch sử thanh toán' })).toContainText('SIM-MOCK-1');
  await expect(modal(page).getByRole('button', { name: /Hủy đơn|Hoàn tiền|Sửa đơn/ })).toHaveCount(0);
});

test('details have loading, 404 and retry; standalone detail validates IDs', async ({ page }) => {
  await mockApi(page); let failed = true;
  await page.route('**/api/rentals/24', (route) => failed ? route.fulfill({ status: 404, json: { error: { message: 'Không tìm thấy đơn thuê.' } } }) : route.fallback());
  await visit(page); await page.getByRole('button', { name: 'Xem đơn #24', exact: true }).click();
  await expect(modal(page).getByRole('heading', { name: 'Không tìm thấy đơn thuê', exact: true })).toBeVisible();
  failed = false; await modal(page).getByRole('button', { name: 'Thử lại' }).click();
  await expect(modal(page).getByText('Tổng tiền đơn', { exact: true })).toBeVisible();
  await visit(page, 'view=detail&rentalId=invalid'); await expect(page.getByText('Mã đơn thuê không hợp lệ.')).toBeVisible();
});

test('assignment loads exact active options and validates required fields before review', async ({ page }) => {
  const state = await mockApi(page); await visit(page); await openAssignment(page);
  await expect(modal(page).getByLabel('Gói thuê đang áp dụng', { exact: true })).toContainText('Gói cơ bản');
  await expect(modal(page).getByLabel('Gói thuê đang áp dụng', { exact: true })).not.toContainText('Gói đã ngừng');
  await expect(modal(page).getByLabel('Mã khay còn trống', { exact: true })).not.toContainText('TRAY-R01-003');
  await review(page); await expect(modal(page).getByText('Vui lòng chọn khách hàng đang hoạt động.')).toBeVisible();
  await expect(modal(page).getByText('Vui lòng chọn gói thuê đang áp dụng.')).toBeVisible();
  await expect(modal(page).getByText('Vui lòng chọn mã khay còn trống trong danh sách mới nhất.')).toBeVisible();
  await modal(page).getByRole('button', { name: 'Khách hàng nhận khay', exact: true }).click();
  await expect(modal(page).getByRole('button', { name: 'Chọn Khách hàng 1 (#4)', exact: true })).toBeVisible();
  const userCall = state.calls.filter((call) => call.path === '/users').at(-1);
  expect(userCall.query.get('role')).toBe('Customer'); expect(userCall.query.get('status')).toBe('Active');
  expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  expect(state.calls.some((call) => call.path === '/trays' && call.query.get('status') === 'Available')).toBe(true);
});

test('assignment requires confirmation, sends exact body and opens the newly created order', async ({ page }) => {
  const state = await mockApi(page); await visit(page); await openAssignment(page); await fillAssignment(page); await review(page);
  await expect(modal(page).getByRole('heading', { name: 'Kiểm tra trước khi tạo đơn' })).toBeFocused();
  expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  await modal(page).getByRole('button', { name: 'Quay lại chỉnh sửa' }).click();
  await expect(modal(page).getByLabel('Phương thức thanh toán', { exact: true })).toHaveValue('BankTransfer');
  await review(page); await confirm(page); await expect(modal(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Đã gán khay và tạo đơn thuê #101.');
  expect(state.calls.find((call) => call.method === 'POST').body).toEqual({ customerId: 4, packageId: 1, trayCode: 'TRAY-R01-001', paymentMethod: 'BankTransfer' });
  await page.getByRole('status').getByRole('button', { name: 'Xem đơn #101', exact: true }).click();
  await expect(modal(page)).toContainText('321.000');
});

test('409 preserves form; refreshing choices prevents resubmitting a newly rented tray', async ({ page }) => {
  const state = await mockApi(page);
  await page.route('**/api/rentals/assign', (route) => { state.trays[0].Status = 'Rented'; return route.fulfill({ status: 409, json: { error: { code: 'DB_50006', message: 'Khay đã được khách khác thuê.' } } }); });
  await visit(page); await openAssignment(page); await fillAssignment(page); await review(page); await confirm(page);
  await expect(modal(page).getByRole('alert')).toContainText('Khay đã được khách khác thuê.');
  await expect(modal(page).getByLabel('Gói thuê đang áp dụng', { exact: true })).toHaveValue('1');
  await expect(modal(page).getByLabel('Mã khay còn trống', { exact: true })).toHaveValue('TRAY-R01-001');
  await expect(modal(page).getByRole('button', { name: 'Khách hàng nhận khay', exact: true })).toContainText('Khách hàng 1');
  await modal(page).getByRole('button', { name: 'Cập nhật gói và khay trống' }).click();
  await expect(modal(page).getByLabel('Mã khay còn trống', { exact: true }).getByRole('option', { name: /TRAY-R01-001/ })).toHaveCount(0);
  await review(page); await expect(modal(page).getByText('Vui lòng chọn mã khay còn trống trong danh sách mới nhất.')).toBeVisible();
});

test('pending POST disables controls and Escape and prevents duplicate submission', async ({ page }) => {
  await mockApi(page); let posts = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/rentals/assign', async (route) => { posts++; await gate; return route.fulfill({ status: 201, json: { data: { rentalId: 101 } } }); });
  await visit(page); await openAssignment(page); await fillAssignment(page); await review(page); await confirm(page);
  await expect(modal(page).getByRole('button', { name: 'Đang tạo đơn…' })).toBeDisabled();
  await expect(modal(page).getByRole('button', { name: 'Đóng hộp thoại' })).toBeDisabled();
  await modal(page).locator('form').evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
  await page.keyboard.press('Escape'); await expect(modal(page)).toBeVisible(); expect(posts).toBe(1);
  release(); await expect(modal(page)).toHaveCount(0); expect(posts).toBe(1);
});

test('empty choices cannot submit and choice errors offer retry without fake options', async ({ page }) => {
  await mockApi(page); let failed = true;
  await page.route('**/api/packages', (route) => failed ? route.fulfill({ status: 500, json: { error: { message: 'Không tải được gói thuê.' } } }) : route.fulfill({ json: { data: [] } }));
  await visit(page); await openAssignment(page);
  await expect(modal(page).getByRole('alert')).toContainText('Không tải được gói thuê.');
  await expect(modal(page).getByRole('button', { name: 'Kiểm tra thông tin' })).toBeDisabled();
  failed = false; await modal(page).getByRole('button', { name: 'Thử lại' }).click();
  await expect(modal(page).getByText('Chưa có gói thuê đang áp dụng.')).toBeVisible();
  await expect(modal(page).getByRole('button', { name: 'Kiểm tra thông tin' })).toBeDisabled();
});

test('network failure while assigning reports unconfirmed outcome without automatic retry', async ({ page }) => {
  await mockApi(page); let posts = 0;
  await page.route('**/api/rentals/assign', (route) => { posts++; return route.abort('failed'); });
  await visit(page); await openAssignment(page); await fillAssignment(page); await review(page); await confirm(page);
  await expect(modal(page).getByRole('alert')).toContainText('kiểm tra danh sách đơn trước khi gửi lại');
  await expect(modal(page).getByLabel('Mã khay còn trống', { exact: true })).toHaveValue('TRAY-R01-001');
  expect(posts).toBe(1); await expect(page.getByText('Đã gán khay và tạo đơn thuê', { exact: false })).toHaveCount(0);
});

test('empty rentals and failed list loads are honest and retryable', async ({ page }) => {
  let failed = true;
  await page.route('**/api/**', (route) => failed ? route.abort('failed') : route.fulfill({ json: { data: [], pagination: { total: 0 } } }));
  await visit(page); await expect(page.getByRole('alert')).toContainText('Không thể kết nối máy chủ');
  await expect(page.getByRole('table')).toHaveCount(0); failed = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có đơn thuê phù hợp' })).toBeVisible();
});

test('401 calls host session callback and 403 displays permission errors', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: { error: { message: 'Phiên đã hết hạn.' } } }));
  await visit(page, 'client=provided'); await expect(page.getByRole('alert')).toContainText('Phiên đã hết hạn.');
  await expect.poll(() => page.evaluate(() => window.rmExpired || 0)).toBeGreaterThan(0);
  await page.unroute('**/api/**'); await page.route('**/api/**', (route) => route.fulfill({ status: 403, json: { error: { message: 'Không có quyền truy cập API.' } } }));
  await visit(page); await expect(page.getByRole('alert')).toContainText('Không có quyền truy cập API.'); await expect(page.getByRole('table')).toHaveCount(0);
});

test('slow previous rental filters cannot overwrite current results with an uncancellable client', async ({ page }) => {
  await mockApi(page); let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/rentals?**', async (route) => {
    const status = new URL(route.request().url()).searchParams.get('status');
    if (status === 'Pending') { await gate; return route.fulfill({ json: { data: [{ ...sampleRentals[0], RentalId: 800, Status: 'Pending' }], pagination: { total: 1 } } }); }
    if (status === 'Completed') return route.fulfill({ json: { data: [{ ...sampleRentals[0], RentalId: 900, Status: 'Completed' }], pagination: { total: 1 } } });
    return route.fallback();
  });
  await visit(page, 'client=provided'); await expect(page.getByRole('table')).toBeVisible();
  const started = page.waitForRequest((request) => new URL(request.url()).searchParams.get('status') === 'Pending');
  await page.getByLabel('Trạng thái đơn thuê', { exact: true }).selectOption('Pending'); await started;
  await page.getByLabel('Trạng thái đơn thuê', { exact: true }).selectOption('Completed'); await expect(page.getByRole('table')).toContainText('#900');
  const finished = page.waitForResponse((response) => new URL(response.url()).searchParams.get('status') === 'Pending'); release(); await finished;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('table')).toContainText('#900'); await expect(page.getByRole('table')).not.toContainText('#800');
});

test('identity changes clear administrative dialogs and cached information', async ({ page }) => {
  const state = await mockApi(page); await visit(page); await openAssignment(page);
  await page.evaluate(() => window.rmSetUser({ UserId: 30, Role: 'Customer' }));
  await expect(modal(page)).toHaveCount(0); await expect(page.getByRole('alert')).toContainText('Không có quyền truy cập');
  const count = state.calls.length; await expect(page.getByRole('table')).toHaveCount(0); expect(state.calls.length).toBe(count);
});

test('missing created ID never invents a detail link or sends another POST', async ({ page }) => {
  await mockApi(page); let posts = 0;
  await page.route('**/api/rentals/assign', (route) => { posts++; return route.fulfill({ status: 201, json: { data: {} } }); });
  await visit(page); await openAssignment(page); await fillAssignment(page); await review(page); await confirm(page);
  await expect(modal(page)).toHaveCount(0); await expect(page.getByRole('status')).toContainText('Máy chủ chưa trả mã đơn');
  await expect(page.getByRole('status').getByRole('button')).toHaveCount(0); expect(posts).toBe(1);
});

test('responsive list and modal stay within mobile viewport with keyboard focus and no page errors', async ({ page }) => {
  const failures = []; page.on('pageerror', (error) => failures.push(error.message));
  await mockApi(page); await visit(page); await expect(page.getByRole('table')).toBeVisible();
  if (process.env.RM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.RM_SCREENSHOT_DIR}/rentals-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openAssignment(page); await expect(modal(page).getByRole('button', { name: 'Khách hàng nhận khay', exact: true })).toBeFocused();
  expect(await modal(page).evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
  if (process.env.RM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.RM_SCREENSHOT_DIR}/assignment-mobile.png`, fullPage: true });
  await page.keyboard.press('Escape'); await expect(modal(page)).toHaveCount(0);
  expect(failures).toEqual([]);
});
