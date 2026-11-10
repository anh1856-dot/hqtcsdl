const { test, expect } = require('@playwright/test');

test.afterEach(async ({page},info) => {
  if (!process.env.QA_SCREENSHOTS_DIR || info.status !== 'passed') return;
  const name=info.title.includes('integrated route dashboard') ? 'dashboard' : info.title.includes('mobile menu') ? 'devices-mobile' : null;
  if (name) await page.screenshot({path:`${process.env.QA_SCREENSHOTS_DIR}/${process.env.QA_MODE || 'qa'}-${name}.png`,fullPage:true});
});

const user={UserId:1,FullName:'Người quản trị',Email:'admin@example.test',Role:'Admin',Status:'Active',Phone:null,Address:null};
const rooms=[{RoomId:1,RoomCode:'R01',RoomName:'Phòng A',Capacity:20,TrayCount:1,AvailableTrays:0,Status:'Active'}];
const types=[{MushroomTypeId:1,TypeName:'Nấm bào ngư',GrowthDays:28,ExpectedYieldKg:1.2}];
const packages=[{PackageId:1,PackageName:'Gói cơ bản',DurationDays:30,PricePerTray:150000,MaxTrays:5,IsActive:true}];
const trays=[{TrayId:1,TrayCode:'TRAY-R01-001',RoomId:1,RoomName:'Phòng A',MushroomTypeId:1,TypeName:'Nấm bào ngư',Status:'Growing',Stage:'Fruiting',CustomerName:'Khách thử',ExpectedHarvestDate:'2026-11-15'}];
const environment=[{RoomId:1,RoomCode:'R01',RoomName:'Phòng A',Temperature:25,Humidity:88,CO2:650,RecordedAt:'2026-11-10T09:59:00Z',TempState:'Normal',HumState:'Normal',CO2State:'Normal'}];
const devices=[{DeviceId:1,DeviceCode:'FAN-R01',DeviceName:'Quạt phòng A',DeviceType:'Fan',RoomId:1,RoomName:'Phòng A',Status:'Online',IsOn:false,AutoMode:true,IsSimulated:true,LastSeenAt:'2026-11-10T09:59:00Z'},{DeviceId:2,DeviceCode:'CAM-R01',DeviceName:'Camera phòng A',DeviceType:'Camera',RoomId:1,RoomName:'Phòng A',Status:'Online',IsOn:false,AutoMode:false,IsSimulated:true,StreamUrl:'rtsp://example.test/stream'}];
const notifications=[{NotificationId:1,Type:'Alert',Title:'Cảnh báo thử nghiệm',Content:'Nhiệt độ phòng A',IsRead:false,CreatedAt:'2026-11-10T09:00:00Z'}];
async function backend(page,role='Admin',{persist=true}={}) {
  if(persist) await page.addInitScript(() => sessionStorage.setItem('mushroom-admin.access-token','mock-session-only'));
  const state={calls:[],user:{...user,Role:role},trays:structuredClone(trays),devices:structuredClone(devices),notifications:structuredClone(notifications)};
  await page.route('**/api/**',async (route) => {
    const req=route.request(),url=new URL(req.url()),path=url.pathname.slice(4),method=req.method(),body=req.postDataJSON();
    state.calls.push({path,method,body,query:url.searchParams,origin:url.origin,auth:req.headers().authorization});
    const ok=(data,pagination) => route.fulfill({json:{data,...(pagination?{pagination}: {})}});
    if(path==='/auth/me') return ok(state.user);
    if(path==='/auth/login') return ok({user:state.user,token:'mock-session-only'});
    if(path==='/auth/me/password') return ok({message:'Đã đổi mật khẩu.'});
    if(path==='/rooms') return ok(rooms);
    if(path==='/mushroom-types') {if(method==='POST')return route.fulfill({status:201,json:{data:{...types[0],TypeName:body.typeName}}});return ok(types);}
    if(path.startsWith('/packages'))return ok(packages);
    if(path==='/users')return ok([{...user,UserId:4,FullName:'Khách thử',Role:'Customer'}],{total:1,page:1,pageSize:20});
    if(path==='/rentals')return ok([{RentalId:1,CustomerId:4,CustomerName:'Khách thử',PackageName:'Gói cơ bản',StartDate:'2026-11-01',EndDate:'2026-12-01',TrayCount:1,TotalAmount:150000,Status:'Active'}],{total:1,page:1,pageSize:10});
    if(path==='/trays')return ok(state.trays);
    if(path==='/trays/1')return ok({...state.trays[0],growthLogs:[],harvests:[]});
    if(/^\/trays\/1\/(stage|start|logs|status|harvest)$/.test(path)){if(path.endsWith('/stage')){state.trays[0].Stage=body.stage;state.trays[0].Status='ReadyToHarvest';}return ok({HarvestId:1,...body});}
    if(path==='/harvests')return ok([{HarvestId:1,TrayId:1,TrayCode:'TRAY-R01-001',RoomName:'Phòng A',TypeName:'Nấm bào ngư',ScheduledDate:'2026-11-10',Status:'Scheduled'}]);
    if(path==='/deliveries')return ok([{RequestId:1,TrayCode:'TRAY-R01-001',CustomerName:'Khách thử',RequestType:'Pickup',Status:'Pending',Fee:0}]);
    if(path==='/deliveries/1/status')return ok(body);
    if(path==='/environment')return ok(environment);
    if(path==='/environment/1/history')return ok([{Time:'2026-11-10T09:00:00Z',Temperature:24,Humidity:85,CO2:600},{Time:'2026-11-10T10:00:00Z',Temperature:25,Humidity:null,CO2:650}]);
    if(path==='/alerts')return ok([{AlertId:1,RoomId:1,RoomName:'Phòng A',Metric:'Temperature',Value:35,Severity:'Critical',Message:'Nhiệt độ cao',Status:'Open',CreatedAt:'2026-11-10T09:00:00Z'}],{total:1,page:1,pageSize:20});
    if(path==='/alerts/1')return ok(body);
    if(path==='/devices')return ok(state.devices);
    if(/^\/devices\/\d+$/.test(path))return ok(state.devices.find((r) => r.DeviceId===Number(path.split('/')[2])));
    if(path.endsWith('/commands'))return ok([{CommandId:1,Command:'ON',Source:'Auto',Status:'Executed',CreatedAt:'2026-11-10T09:00:00Z'}],{total:1,page:1,pageSize:20});
    if(path==='/devices/1/control'){state.devices[0].IsOn=body.command==='ON';state.devices[0].AutoMode=false;return ok(state.devices[0]);}
    if(path==='/devices/1/auto-mode'){state.devices[0].AutoMode=body.autoMode;return ok(state.devices[0]);}
    if(path==='/notifications'){const rows=state.notifications.filter((r) => url.searchParams.get('unreadOnly')!=='true'||!r.IsRead);return route.fulfill({json:{data:rows,pagination:{total:rows.length,page:1,pageSize:20},unreadCount:state.notifications.filter((r) => !r.IsRead).length}});}
    if(path==='/notifications/1/read'||path==='/notifications/read-all'){state.notifications[0].IsRead=true;return ok({updated:1});}
    if(path==='/notifications/preferences')return ok(method==='PUT'?body:[{Type:'Progress',DisplayName:'Tiến độ',SystemEnabled:true,UserEnabled:true}]);
    if(path==='/notifications/settings')return ok([{Type:'Progress',DisplayName:'Tiến độ',IsEnabled:true}]);
    if(path==='/notifications/settings/Progress')return ok(body);
    if(path==='/rooms/1/thresholds')return ok(method==='PUT'?body:[{Metric:'Temperature',MinValue:22,MaxValue:28},{Metric:'Humidity',MinValue:80,MaxValue:95},{Metric:'CO2',MinValue:400,MaxValue:1000}]);
    if(path==='/reports/dashboard')return ok({ActiveRentals:1,Customers:1,OpenAlerts:1,RevenueThisMonth:150000,HarvestKgThisMonth:2,PendingHarvests:1,PendingDeliveries:1,traysByStatus:[{Status:'Growing',Count:1}],environment,latestAlerts:[]});
    if(path.startsWith('/reports/')){if(url.searchParams.get('format')==='csv')return route.fulfill({body:'Revenue\r\n150000',contentType:'text/csv; charset=utf-8'});return ok([{PackageId:1,PackageName:'Gói cơ bản',RentalCount:1,TrayCount:1,Revenue:150000,Year:2026,Month:11,TypeName:'Nấm bào ngư',TotalKg:2}]);}
    throw new Error(`Unmocked API: ${method} ${path}`);
  });
  return state;
}
async function open(page,path) {await page.goto('/#/'+path);}
const dialog=(page) => page.getByRole('dialog');

test('login, restoration, profile, logout and reload do not expose admin before auth',async ({page}) => {
  const state=await backend(page,'Admin',{persist:false});await open(page,'trays');
  await expect(page.getByRole('heading',{name:'Chào mừng trở lại'})).toBeVisible();await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByLabel('Email',{exact:true}).fill('admin@example.test');await page.getByLabel('Mật khẩu',{exact:true}).fill('only-a-test-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tổng quan trang trại'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Tổng quan trang trại'})).toBeVisible();
  await page.getByRole('navigation').getByRole('link',{name:'Hồ sơ',exact:true}).click();await page.getByRole('button',{name:'Đổi mật khẩu',exact:true}).click();
  await dialog(page).getByLabel('Mật khẩu hiện tại',{exact:true}).fill('only-a-test-password');await dialog(page).getByLabel('Mật khẩu mới',{exact:true}).fill('new-test-password');await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);
  expect(state.calls.find((r) => r.path==='/auth/me/password').body.newPassword).toBe('new-test-password');
  await page.getByRole('button',{name:'Đăng xuất'}).click();await expect(page.getByRole('heading',{name:'Chào mừng trở lại'})).toBeVisible();expect(await page.evaluate(() => sessionStorage.getItem('mushroom-admin.access-token'))).toBeNull();
});

for(const [path,title] of [['mushroom-types','Quản lý loại nấm'],['packages','Quản lý gói thuê'],['rooms','Quản lý phòng nuôi'],['users','Quản lý tài khoản'],['rentals','Quản lý đơn thuê'],['dashboard','Tổng quan trang trại'],['reports','Báo cáo'],['trays','Khay & canh tác'],['harvests','Thu hoạch'],['deliveries','Giao nhận'],['environment','Môi trường'],['alerts','Cảnh báo môi trường'],['devices','Thiết bị & camera'],['notifications','Thông báo'],['settings','Cấu hình'],['profile','Hồ sơ của tôi']]) {
  test(`integrated route ${path} renders and refreshes`,async ({page}) => {const errors=[];page.on('pageerror',(e) => errors.push(e.message));await backend(page);await open(page,path);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();expect(errors).toEqual([]);});
}
test('Operator menu and direct route guards prevent Admin requests',async ({page}) => {
  const state=await backend(page,'Operator');await open(page,'dashboard');await expect(page.getByRole('navigation').getByRole('link',{name:'Báo cáo',exact:true})).toHaveCount(0);
  await open(page,'reports');await expect(page.getByRole('alert')).toContainText('chỉ dành cho quản trị viên');expect(state.calls.filter((r) => r.path==='/reports/revenue')).toHaveLength(0);
  await open(page,'settings');await expect(page.getByRole('heading',{name:'Thông báo cá nhân'})).toBeVisible();await expect(page.getByText('Thông báo toàn hệ thống',{exact:true})).toHaveCount(0);expect(state.calls.filter((r) => r.path==='/notifications/settings')).toHaveLength(0);
  await open(page,'devices');await expect(page.getByRole('button',{name:'Thêm thiết bị',exact:true})).toHaveCount(0);
});
test('Customer cannot enter staff app',async ({page}) => {await backend(page,'Customer');await open(page,'trays');await expect(page.getByRole('alert')).toContainText('chỉ dành cho Admin và Operator');await expect(page.getByRole('navigation')).toHaveCount(0);});

test('inherited module form uses shared authenticated API and preserves failure',async ({page}) => {
  const state=await backend(page);await open(page,'mushroom-types');await page.getByRole('button',{name:'Thêm loại nấm',exact:true}).click();await dialog(page).getByLabel('Tên loại nấm').fill('Nấm thử');await dialog(page).getByLabel('Số ngày sinh trưởng').fill('28');
  await page.route('**/api/mushroom-types',(r) => r.request().method()==='POST'?r.fulfill({status:409,json:{error:{message:'Tên bị trùng.'}}}):r.fallback());await dialog(page).getByRole('button',{name:'Lưu thay đổi'}).click();await expect(dialog(page).getByRole('alert')).toContainText('Tên bị trùng.');await expect(dialog(page).getByLabel('Tên loại nấm')).toHaveValue('Nấm thử');expect(state.calls[0].auth).toBe('Bearer mock-session-only');
});
test('cultivation allows only forward stages and creates no automatic writes',async ({page}) => {
  const state=await backend(page);await open(page,'trays');await expect(page.getByRole('button',{name:'Bắt đầu trồng',exact:true})).toBeDisabled();expect(state.calls.some((r) => r.method!=='GET')).toBe(false);
  await page.getByRole('button',{name:'Giai đoạn',exact:true}).click();await expect(dialog(page).getByLabel('Giai đoạn mới').getByRole('option')).toHaveCount(2);
  await dialog(page).getByLabel('Giai đoạn mới').selectOption('Harvest');await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);await expect(page.getByRole('region',{name:'Bảng dữ liệu'})).toContainText('Chờ thu hoạch');expect(state.calls.find((r) => r.path.endsWith('/stage')).body.stage).toBe('Harvest');
});
test('harvest validation and delivery transitions match backend',async ({page}) => {
  const state=await backend(page);await open(page,'harvests');await page.getByRole('button',{name:'Ghi nhận',exact:true}).click();await dialog(page).getByLabel('Khối lượng (kg)',{exact:true}).fill('-1');await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page).getByRole('alert')).toHaveCount(2);
  await dialog(page).getByLabel('Khối lượng (kg)',{exact:true}).fill('1.25');await dialog(page).getByLabel('Chất lượng',{exact:true}).selectOption('A');await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);expect(state.calls.find((r) => r.path.endsWith('/harvest')).body.weightKg).toBe(1.25);
  await open(page,'deliveries');await page.getByRole('button',{name:'Cập nhật trạng thái',exact:true}).click();await expect(dialog(page).getByLabel('Trạng thái tiếp theo').getByRole('option',{name:'Đang giao',exact:true})).toHaveCount(0);await dialog(page).getByLabel('Trạng thái tiếp theo').selectOption('Confirmed');await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);expect(state.calls.find((r) => r.path==='/deliveries/1/status').body.status).toBe('Confirmed');
});
test('environment history charts and alerts use real-shaped API responses',async ({page}) => {
  const state=await backend(page);await open(page,'environment');await page.getByLabel('Phòng xem lịch sử').selectOption('1');await expect(page.getByRole('img',{name:/Nhiệt độ:/})).toBeVisible();await expect(page.getByRole('img',{name:/Độ ẩm:/})).toHaveAttribute('aria-labelledby',/.+/);expect(state.calls.find((r) => r.path.endsWith('/history')).query.get('groupBy')).toBe('hour');
  await open(page,'alerts');await page.getByRole('button',{name:'Tiếp nhận',exact:true}).click();await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);expect(state.calls.find((r) => r.path==='/alerts/1').body.status).toBe('Acknowledged');
});
test('device controls require confirmation; RTSP never pretends to play',async ({page}) => {
  const state=await backend(page);await open(page,'devices');await page.getByRole('button',{name:'Bật thủ công',exact:true}).click();expect(state.calls.filter((r) => r.path.endsWith('/control'))).toHaveLength(0);await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);expect(state.calls.find((r) => r.path.endsWith('/control')).body.command).toBe('ON');
  await page.getByRole('row').filter({hasText:'CAM-R01'}).getByRole('button',{name:'Chi tiết',exact:true}).click();await expect(dialog(page).getByText(/RTSP và HLS/)).toBeVisible();await expect(dialog(page).locator('video')).toHaveCount(0);await expect(dialog(page)).toContainText('rtsp://example.test/stream');
});
test('notifications update bell; threshold validation blocks inverted min/max',async ({page}) => {
  const state=await backend(page);await open(page,'notifications');await page.getByRole('button',{name:'Đọc tất cả',exact:true}).click();await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);await expect(page.getByRole('link',{name:'Thông báo: 0 chưa đọc',exact:true})).toBeVisible();
  await open(page,'settings');await page.getByLabel('Phòng cấu hình ngưỡng').selectOption('1');await page.getByRole('button',{name:'Sửa ngưỡng'}).click();await dialog(page).getByLabel('Nhiệt độ (°C) · Tối thiểu',{exact:true}).fill('50');await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page).getByRole('alert')).toContainText('tối thiểu phải nhỏ hơn');expect(state.calls.filter((r) => r.path==='/rooms/1/thresholds'&&r.method==='PUT')).toHaveLength(0);
  await dialog(page).getByLabel('Nhiệt độ (°C) · Tối thiểu',{exact:true}).fill('22');await dialog(page).getByRole('button',{name:'Xác nhận'}).click();await expect(dialog(page)).toHaveCount(0);expect(state.calls.find((r) => r.path==='/rooms/1/thresholds'&&r.method==='PUT').body).toHaveLength(3);
});
test('CSV downloads carry auth; 403 preserves session and 401 ends it',async ({page}) => {
  const state=await backend(page);await open(page,'reports');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất CSV'}).click();expect((await download).suggestedFilename()).toBe('bao-cao-revenue.csv');expect(state.calls.find((r) => r.query.get('format')==='csv').auth).toBe('Bearer mock-session-only');expect(state.calls.find((r) => r.query.get('format')==='csv').origin).toBe(process.env.TEST_API_ORIGIN || 'http://localhost:3000');
  await page.route('**/api/reports/revenue',(r) => r.fulfill({status:403,json:{error:{message:'Không đủ quyền báo cáo.'}}}));await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Không đủ quyền báo cáo.');await expect(page.getByRole('button',{name:'Đăng xuất'})).toBeVisible();
  await page.route('**/api/trays',(r) => r.fulfill({status:401,json:{error:{message:'Hết phiên.'}}}));await open(page,'trays');await expect(page.getByRole('heading',{name:'Chào mừng trở lại'})).toBeVisible();
});
test('mobile menu, nested refresh and dialogs fit viewport',async ({page}) => {
  const errors=[];page.on('pageerror',(e) => errors.push(e.message));await backend(page);await page.setViewportSize({width:390,height:844});await open(page,'dashboard');await page.getByRole('button',{name:'Mở hoặc đóng menu'}).click();await page.getByRole('navigation').getByRole('link',{name:'Thiết bị & camera',exact:true}).click();await page.getByRole('button',{name:'Thêm thiết bị',exact:true}).click();await expect(dialog(page)).toBeVisible();expect(await dialog(page).evaluate((e) => e.getBoundingClientRect().width <= innerWidth)).toBe(true);await page.keyboard.press('Escape');await expect(dialog(page)).toHaveCount(0);expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.reload();await expect(page.getByRole('heading',{name:'Thiết bị & camera',exact:true})).toBeVisible();expect(errors).toEqual([]);
});

test('pending shared mutation blocks double submit and Escape',async ({page}) => {
  await backend(page);let posts=0,release;const gate=new Promise((resolve) => {release=resolve;});
  await page.route('**/api/devices/1/control',async (r) => {posts++;await gate;return r.fulfill({json:{data:{DeviceId:1}}});});
  await open(page,'devices');await page.getByRole('button',{name:'Bật thủ công',exact:true}).click();await dialog(page).getByRole('button',{name:'Xác nhận'}).click();
  await expect(dialog(page).getByRole('button',{name:'Đang xử lý…'})).toBeDisabled();await expect(dialog(page).getByRole('button',{name:'Đóng hộp thoại'})).toBeDisabled();
  await dialog(page).locator('form').evaluate((f) => {f.requestSubmit();f.requestSubmit();});await page.keyboard.press('Escape');await expect(dialog(page)).toBeVisible();expect(posts).toBe(1);release();await expect(dialog(page)).toHaveCount(0);expect(posts).toBe(1);
});
test('late shared list response never overwrites newer filter even without transport abort',async ({page}) => {
  await page.addInitScript(() => {const original=window.fetch.bind(window);window.fetch=(url,options={}) => original(url,{...options,signal:undefined});});
  await backend(page);let release;const gate=new Promise((resolve) => {release=resolve;});
  await page.route('**/api/trays?**',async (route) => {const q=new URL(route.request().url()).searchParams.get('q');if(q==='old'){await gate;return route.fulfill({json:{data:[{...trays[0],TrayCode:'OLD-RESULT'}]}});}if(q==='new')return route.fulfill({json:{data:[{...trays[0],TrayCode:'NEW-RESULT'}]}});return route.fallback();});
  await open(page,'trays');await expect(page.getByRole('table')).toBeVisible();const started=page.waitForRequest((r) => new URL(r.url()).searchParams.get('q')==='old');await page.getByLabel('Tìm mã khay hoặc tên khách').fill('old');await started;
  await page.getByLabel('Tìm mã khay hoặc tên khách').fill('new');await expect(page.getByRole('table')).toContainText('NEW-RESULT');const response=page.waitForResponse((r) => new URL(r.url()).searchParams.get('q')==='old');release();await response;await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));await expect(page.getByRole('table')).toContainText('NEW-RESULT');await expect(page.getByRole('table')).not.toContainText('OLD-RESULT');
});
test('polling waits for pending request and stops after navigation',async ({page}) => {
  await backend(page);await page.clock.install();let calls=0,release;const gate=new Promise((resolve) => {release=resolve;});
  await page.route('**/api/environment',async (route) => {calls++;await gate;return route.fulfill({json:{data:environment}});});
  await open(page,'environment');await expect(page.getByText('Đang tải dữ liệu…',{exact:true}).first()).toBeVisible();await page.clock.runFor(100);const baseline=calls;expect(baseline).toBeGreaterThan(0);await page.clock.fastForward(90000);expect(calls).toBe(baseline);
  release();await expect(page.getByRole('table')).toBeVisible();await open(page,'profile');await expect(page.getByRole('heading',{name:'Hồ sơ của tôi'})).toBeVisible();const count=calls;await page.clock.fastForward(90000);expect(calls).toBe(count);
});
