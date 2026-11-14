/*
 * Kiem thu nhanh cac luong chinh cua API (backend phai dang chay, database vua tao bang run_all.ps1).
 *   npm run test:api
 * Luu y: script co ghi du lieu that (tao don thue, tai khoan moi...). Chay lai run_all.ps1 de lam sach.
 */
require('dotenv').config();

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}/api`;
// Mat khau chung cua tai khoan mau (database/04_sample_data.sql)
const SAMPLE_PASSWORD = process.env.SAMPLE_PASSWORD || 'Mushroom@123';

let passed = 0;
let failed = 0;

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, type };
}

function check(name, condition, extra) {
  if (condition) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}

async function login(email) {
  const r = await call('POST', '/auth/login', { body: { email, password: SAMPLE_PASSWORD } });
  if (r.status !== 200) throw new Error(`Không đăng nhập được ${email}: ${JSON.stringify(r.data)}`);
  return r.data.data.token;
}

async function main() {
  console.log(`API: ${API}\n`);

  console.log('1. Hệ thống & đăng nhập');
  const health = await call('GET', '/health');
  check('GET /health', health.status === 200, health.data);
  const admin = await login('admin@mushroomfarm.test');
  const op = await login('operator1@mushroomfarm.test');
  const em = await login('em.vu@example.test');       // khach chua thue khay nao
  const dung = await login('dung.do@example.test');   // khach co khay chua lien ket
  check('Đăng nhập 4 tài khoản mẫu', admin && op && em && dung);
  const wrong = await call('POST', '/auth/login', { body: { email: 'admin@mushroomfarm.test', password: 'sai-mat-khau' } });
  check('Sai mật khẩu -> 401', wrong.status === 401, wrong.data);
  const noToken = await call('GET', '/auth/me');
  check('Không có token -> 401', noToken.status === 401);
  const me = await call('GET', '/auth/me', { token: em });
  check('GET /auth/me trả đúng vai trò Customer', me.data.data && me.data.data.Role === 'Customer', me.data);

  console.log('\n2. Phân quyền theo vai trò');
  const custUsers = await call('GET', '/users', { token: em });
  check('Khách gọi /users -> 403', custUsers.status === 403);
  const opUsers = await call('GET', '/users?role=Admin', { token: op });
  check('Operator chỉ thấy khách hàng', opUsers.status === 200 && opUsers.data.data.every((u) => u.Role === 'Customer'), opUsers.data);
  const adminUsers = await call('GET', '/users?pageSize=5', { token: admin });
  check('Admin xem danh sách tài khoản có phân trang', adminUsers.status === 200 && adminUsers.data.pagination.total >= 8, adminUsers.data);

  console.log('\n3. Khách thuê khay');
  const packages = await call('GET', '/packages');
  check('GET /packages (công khai)', packages.status === 200 && packages.data.data.length === 3);
  const avail = await call('GET', '/trays/available', { token: em });
  check('GET /trays/available', avail.status === 200 && avail.data.data.length > 0, avail.data);
  const tooMany = await call('POST', '/rentals', { token: em, body: { packageId: 1, trayCount: 5 } });
  check('Thuê vượt số khay của gói -> 400 (DB_50003)', tooMany.status === 400 && tooMany.data.error.code === 'DB_50003', tooMany.data);
  const rent = await call('POST', '/rentals', { token: em, body: { packageId: 1, trayCount: 1, roomId: 1 } });
  check('Thuê 1 khay phòng R01 -> 201', rent.status === 201 && rent.data.data.trays.length === 1, rent.data);
  const rentalId = rent.data.data && rent.data.data.rentalId;
  const trayId = rent.data.data && rent.data.data.trays[0].TrayId;
  const myTrays = await call('GET', '/my/trays', { token: em });
  check('Khay vừa thuê có trong /my/trays', myTrays.status === 200 && myTrays.data.data.some((t) => t.TrayId === trayId), myTrays.data);
  const otherRental = await call('GET', `/rentals/${rentalId}`, { token: dung });
  check('Khách khác xem đơn thuê -> 403', otherRental.status === 403);
  const tx = await call('GET', '/my/transactions', { token: em });
  check('Lịch sử giao dịch có thanh toán', tx.status === 200 && tx.data.data.length >= 1, tx.data);

  console.log('\n4. Đăng ký khay bằng mã');
  const linkOther = await call('POST', '/rentals/link', { token: em, body: { trayCode: 'TRAY-R03-002' } });
  check('Nhập mã khay của người khác -> 403 (DB_50007)', linkOther.status === 403, linkOther.data);
  const link = await call('POST', '/rentals/link', { token: dung, body: { trayCode: 'tray-r03-002' } });
  check('Khách Dung liên kết đúng khay của mình', link.status === 200 && link.data.data.TrayCode === 'TRAY-R03-002', link.data);

  console.log('\n5. Canh tác (Operator)');
  const start = await call('POST', `/trays/${trayId}/start`, { token: op, body: { mushroomTypeId: 1 } });
  check('Bắt đầu trồng khay vừa thuê', start.status === 200 && start.data.data.Status === 'Growing', start.data);
  const stage = await call('POST', `/trays/${trayId}/stage`, { token: op, body: { stage: 'Incubation', note: 'Tơ lan đều' } });
  check('Cập nhật giai đoạn Ủ tơ', stage.status === 200 && stage.data.data.Stage === 'Incubation', stage.data);
  const back = await call('POST', `/trays/${trayId}/stage`, { token: op, body: { stage: 'Inoculation' } });
  check('Cập nhật giai đoạn lùi -> 400', back.status === 400, back.data);
  const custStage = await call('POST', `/trays/${trayId}/stage`, { token: em, body: { stage: 'Pinning' } });
  check('Khách cập nhật giai đoạn -> 403', custStage.status === 403);
  const newTrays = await call('POST', '/trays', { token: op, body: { roomId: 3, quantity: 2 } });
  check('Tạo 2 khay mới, mã tự sinh', newTrays.status === 201 && newTrays.data.data.length === 2 && /^TRAY-R03-\d{3}$/.test(newTrays.data.data[0].TrayCode), newTrays.data);

  console.log('\n6. IoT & cảnh báo');
  const badKey = await call('POST', '/sensors/readings', { headers: { 'x-device-key': 'sai' }, body: { deviceCode: 'SEN-R01', humidity: 50 } });
  check('Sai khóa thiết bị -> 401', badKey.status === 401);
  // Dong canh bao do am cu cua R01 (neu co) de lan do sau tao canh bao moi
  const oldAlerts = await call('GET', '/alerts?roomId=1&pageSize=200', { token: op });
  for (const a of oldAlerts.data.data.filter((x) => x.Metric === 'Humidity' && x.Status !== 'Resolved')) {
    await call('PATCH', `/alerts/${a.AlertId}`, { token: op, body: { status: 'Resolved' } });
  }
  const reading = await call('POST', '/sensors/readings', {
    headers: { 'x-device-key': process.env.IOT_DEVICE_KEY },
    body: { deviceCode: 'SEN-R01', temperature: 25, humidity: 60, co2: 700 },
  });
  const mist = reading.data.data && reading.data.data.actuators.find((a) => a.DeviceType === 'MistSprayer');
  check('Gửi độ ẩm 60% -> máy phun sương R01 tự bật', reading.status === 201 && mist && mist.IsOn === true, reading.data);
  const alerts = await call('GET', '/alerts?status=Open&roomId=1', { token: op });
  const humAlert = alerts.data.data && alerts.data.data.find((a) => a.Metric === 'Humidity');
  check('Có cảnh báo độ ẩm đang mở ở R01', alerts.status === 200 && !!humAlert, alerts.data);
  const notif = await call('GET', '/notifications?unreadOnly=true', { token: em });
  check('Khách có khay ở R01 nhận thông báo cảnh báo', notif.status === 200 && notif.data.data.some((n) => n.Type === 'Alert'), notif.data);
  const ack = await call('PATCH', `/alerts/${humAlert && humAlert.AlertId}`, { token: op, body: { status: 'Acknowledged' } });
  check('Operator xác nhận cảnh báo', ack.status === 200 && ack.data.data.Status === 'Acknowledged', ack.data);
  const envCust = await call('GET', '/environment', { token: em });
  check('Khách chỉ thấy môi trường phòng có khay của mình', envCust.status === 200 && envCust.data.data.every((r) => r.RoomId === 1), envCust.data);
  const envForbidden = await call('GET', '/environment/2/history', { token: em });
  check('Khách xem lịch sử phòng không có khay -> 403', envForbidden.status === 403);
  const hist = await call('GET', '/environment/1/history?hours=48&groupBy=hour', { token: op });
  check('Lịch sử môi trường theo giờ', hist.status === 200 && hist.data.data.length > 0, hist.data);

  console.log('\n7. Điều khiển thiết bị');
  const devices = await call('GET', '/devices?roomId=1&type=Fan', { token: op });
  const fan = devices.data.data && devices.data.data[0];
  const control = await call('POST', `/devices/${fan && fan.DeviceId}/control`, { token: op, body: { command: 'ON', reason: 'Kiểm thử' } });
  check('Bật quạt thủ công -> AutoMode tắt', control.status === 200 && control.data.data.IsOn === true && control.data.data.AutoMode === false, control.data);
  const auto = await call('PATCH', `/devices/${fan && fan.DeviceId}/auto-mode`, { token: op, body: { autoMode: true } });
  check('Bật lại chế độ tự động', auto.status === 200 && auto.data.data.AutoMode === true, auto.data);

  console.log('\n8. Thu hoạch & giao nhận');
  const harvests = await call('GET', '/harvests?status=Scheduled', { token: op });
  check('Lịch thu hoạch', harvests.status === 200, harvests.data);
  const anLogin = await login('an.le@example.test');
  const myHarvests = await call('GET', '/my/harvests', { token: anLogin });
  const done = myHarvests.data.data && myHarvests.data.data.find((h) => h.Status === 'Completed');
  check('Khách An có đợt thu hoạch hoàn tất', !!done, myHarvests.data);
  const dupDelivery = await call('POST', '/deliveries', { token: anLogin, body: { harvestId: done && done.HarvestId, requestType: 'Pickup' } });
  check('Yêu cầu giao nhận trùng -> 409 (DB_50021)', dupDelivery.status === 409, dupDelivery.data);
  const deliveries = await call('GET', '/deliveries?status=Pending', { token: op });
  const d = deliveries.data.data && deliveries.data.data[0];
  const confirm = await call('PATCH', `/deliveries/${d && d.RequestId}/status`, { token: op, body: { status: 'Confirmed' } });
  check('Operator xác nhận giao nhận', confirm.status === 200 && confirm.data.data.Status === 'Confirmed', confirm.data);
  const badMove = await call('PATCH', `/deliveries/${d && d.RequestId}/status`, { token: op, body: { status: 'Pending' } });
  check('Chuyển trạng thái ngược -> 409', badMove.status === 409);

  console.log('\n9. Báo cáo');
  const dash = await call('GET', '/reports/dashboard', { token: op });
  check('Dashboard', dash.status === 200 && dash.data.data.ActiveRentals > 0, dash.data);
  const rev = await call('GET', '/reports/revenue', { token: admin });
  check('Báo cáo doanh thu theo gói', rev.status === 200 && rev.data.data.length > 0, rev.data);
  const csv = await call('GET', '/reports/revenue/monthly?format=csv', { token: admin });
  check('Xuất CSV', csv.status === 200 && csv.type.includes('text/csv') && csv.data.includes('Revenue'), csv.type);
  const opReport = await call('GET', '/reports/revenue', { token: op });
  check('Operator xem báo cáo doanh thu -> 403', opReport.status === 403);

  console.log('\n10. Tài khoản & thông báo');
  const email = `test${Date.now()}@example.test`;
  const reg = await call('POST', '/auth/register', { body: { fullName: 'Khách Kiểm Thử', email, password: '123456' } });
  check('Đăng ký tài khoản khách mới', reg.status === 201 && reg.data.data.token, reg.data);
  const dup = await call('POST', '/auth/register', { body: { fullName: 'Trùng', email, password: '123456' } });
  check('Đăng ký trùng email -> 409', dup.status === 409, dup.data);
  const newToken = reg.data.data && reg.data.data.token;
  const prof = await call('PUT', '/auth/me', { token: newToken, body: { phone: '0987654321', address: 'Thủ Đức' } });
  check('Cập nhật hồ sơ', prof.status === 200 && prof.data.data.Phone === '0987654321', prof.data);
  const pref = await call('PUT', '/notifications/preferences', { token: newToken, body: { type: 'Progress', isEnabled: false } });
  check('Tắt thông báo tiến độ', pref.status === 200, pref.data);
  const prefs = await call('GET', '/notifications/preferences', { token: newToken });
  check('Đọc lại cài đặt thông báo', prefs.data.data.find((p) => p.Type === 'Progress').UserEnabled === false, prefs.data);
  const newUserId = reg.data.data && reg.data.data.user.UserId;
  const lock = await call('PATCH', `/users/${newUserId}/status`, { token: admin, body: { status: 'Disabled' } });
  check('Admin khóa tài khoản', lock.status === 200, lock.data);
  const afterLock = await call('GET', '/auth/me', { token: newToken });
  check('Tài khoản bị khóa -> token cũ mất hiệu lực (401)', afterLock.status === 401);

  console.log('\n11. Đơn thuê hết hạn & gia hạn (BR14)');
  {
    // Loai nam sinh truong > 30 ngay (dai hon goi 1) va dang con khay trong
    const types = (await call('GET', '/mushroom-types', { token: op })).data.data || [];
    const availAll = (await call('GET', '/trays/available', { token: em })).data.data || [];
    const roomOfLong = availAll.find((r) => (types.find((t) => t.MushroomTypeId === r.MushroomTypeId) || {}).GrowthDays > 30);
    const linhChi = roomOfLong && types.find((t) => t.MushroomTypeId === roomOfLong.MushroomTypeId);
    check('Có khay trống của loại nấm sinh trưởng > 30 ngày để kiểm thử', !!linhChi, availAll);
    const tooShort = await call('POST', '/rentals', { token: em, body: { packageId: 1, mushroomTypeId: linhChi.MushroomTypeId } });
    check('Gói 30 ngày + loại nấm dài hơn -> 400 DB_50009', tooShort.status === 400 && tooShort.data.error.code === 'DB_50009', tooShort.data);

    const roomShort = await call('POST', '/rentals', { token: em, body: { packageId: 1, roomId: roomOfLong.RoomId } });
    check('Chọn phòng chỉ có nấm dài hơn gói -> 400 DB_50009', roomShort.status === 400 && roomShort.data.error.code === 'DB_50009', roomShort.data);

    const availPkg = await call('GET', '/trays/available?packageId=1', { token: em });
    check('/trays/available?packageId=1 không đếm khay nấm dài hơn gói',
      availPkg.status === 200 && !availPkg.data.data.some((r) => r.MushroomTypeId === linhChi.MushroomTypeId), availPkg.data);

    const freeLong = await call('GET', `/trays?roomId=${roomOfLong.RoomId}&status=Available`, { token: op });
    const longTray = (freeLong.data.data || [])[0];
    const assignShort = await call('POST', '/rentals/assign', {
      token: op, body: { customerId: me.data.data.UserId, packageId: 1, trayCode: longTray && longTray.TrayCode },
    });
    check('Operator gán khay nấm dài hơn gói -> 400 DB_50009', assignShort.status === 400 && assignShort.data.error.code === 'DB_50009', assignShort.data);

    const newRent = await call('POST', '/rentals', { token: em, body: { packageId: 1, trayCount: 1, roomId: 1 } });
    const rid = newRent.data.data && newRent.data.data.rentalId;
    check('Thuê gói 30 ngày cho nấm kịp thu hoạch', newRent.status === 201 && rid, newRent.data);
    const before = (await call('GET', `/rentals/${rid}`, { token: em })).data.data;

    const ext = await call('POST', `/rentals/${rid}/extend`, { token: em, body: { terms: 1 } });
    const after = (await call('GET', `/rentals/${rid}`, { token: em })).data.data;
    const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
    check('Khách gia hạn 1 kỳ: +30 ngày, thu 150.000đ',
      ext.status === 200 && Number(ext.data.data.Amount) === 150000
        && dayDiff(before.EndDate, after.EndDate) === 30, { ext: ext.data, before: before.EndDate, after: after.EndDate });
    check('Gia hạn ghi thêm thanh toán và cộng tổng tiền đơn',
      after.payments.length === 2 && Number(after.TotalAmount) === Number(before.TotalAmount) + 150000, after);

    const otherExt = await call('POST', `/rentals/${rid}/extend`, { token: dung, body: {} });
    check('Khách khác gia hạn đơn không phải của mình -> 403', otherExt.status === 403, otherExt.data);
    const badTerms = await call('POST', `/rentals/${rid}/extend`, { token: em, body: { terms: 0 } });
    check('Số kỳ gia hạn = 0 -> 400', badTerms.status === 400, badTerms.data);
    const noRental = await call('POST', '/rentals/999999/extend', { token: op, body: {} });
    check('Gia hạn đơn không tồn tại -> 404', noRental.status === 404, noRental.data);
    const opExt = await call('POST', `/rentals/${rid}/extend`, { token: op, body: { terms: 2 } });
    check('Operator gia hạn hộ 2 kỳ (thanh toán mặc định Cash)', opExt.status === 200 && Number(opExt.data.data.ExtendedDays) === 60, opExt.data);

    const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD theo gio may (khong lay ngay UTC)
    const rev = await call('GET', `/reports/revenue?from=${today}&to=${today}`, { token: admin });
    const pkg1 = (rev.data.data || []).find((r) => r.PackageId === 1);
    check('Báo cáo doanh thu không đếm trùng đơn khi gia hạn (có ExtensionCount)',
      rev.status === 200 && pkg1 && pkg1.ExtensionCount >= 2 && pkg1.RentalCount >= 1, rev.data);
  }

  console.log(`\nKết quả: ${passed} đạt, ${failed} lỗi`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Lỗi khi chạy kiểm thử:', err.message);
  process.exit(1);
});
