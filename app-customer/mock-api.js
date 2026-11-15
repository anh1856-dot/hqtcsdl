/* Dữ liệu và "API giả" dùng chung cho mock-server.js (Node) và chế độ demo trong trình duyệt (index.html?demo=1).
   route(method, url, body) -> [httpStatus, bodyHoặcThôngBáoLỗi]. Cấu trúc trả về giống backend/API.md. */
(function (root) {
const now = () => new Date();
const iso = (d) => new Date(d).toISOString();
const daysFromNow = (n) => iso(Date.now() + n * 864e5);

const db = {
  user: { UserId: 1, FullName: 'Lê Văn An', Email: 'an.le@example.test', Phone: '0901234567', Address: '12 Nguyễn Huệ, Q.1, TP.HCM', Role: 'Customer', Status: 'Active' },
  rooms: [
    { RoomId: 1, RoomCode: 'R01', RoomName: 'Phòng A – Nấm sò', Temperature: 24.6, Humidity: 86, CO2: 780, TempMin: 20, TempMax: 28, HumMin: 80, HumMax: 95, CO2Min: 400, CO2Max: 1200 },
    { RoomId: 2, RoomCode: 'R02', RoomName: 'Phòng B – Nấm rơm', Temperature: 31.2, Humidity: 72, CO2: 900, TempMin: 28, TempMax: 34, HumMin: 80, HumMax: 90, CO2Min: 400, CO2Max: 1200 },
  ],
  trays: [
    { TrayId: 11, TrayCode: 'TRAY-R01-003', RoomName: 'Phòng A – Nấm sò', TypeName: 'Nấm sò', Status: 'Growing', Stage: 'Fruiting', DaysToHarvest: 4, RentalId: 5 },
    { TrayId: 12, TrayCode: 'TRAY-R01-004', RoomName: 'Phòng A – Nấm sò', TypeName: 'Nấm sò', Status: 'Growing', Stage: 'Pinning', DaysToHarvest: 9, RentalId: 5 },
    { TrayId: 21, TrayCode: 'TRAY-R02-001', RoomName: 'Phòng B – Nấm rơm', TypeName: 'Nấm rơm', Status: 'Rented', Stage: null, DaysToHarvest: null, RentalId: 5 },
  ],
  packages: [
    { PackageId: 1, PackageName: 'Gói 1 vụ', DurationDays: 30, PricePerTray: 150000, MaxTrays: 5, Description: 'Thuê 1 vụ nấm ngắn ngày, phù hợp dùng thử.' },
    { PackageId: 2, PackageName: 'Gói 3 tháng', DurationDays: 90, PricePerTray: 380000, MaxTrays: 10, Description: 'Trồng liên tiếp nhiều vụ, giá ưu đãi.' },
  ],
  available: [
    { RoomId: 1, RoomName: 'Phòng A – Nấm sò', MushroomTypeId: 1, TypeName: 'Nấm sò', AvailableTrays: 6 },
    { RoomId: 2, RoomName: 'Phòng B – Nấm rơm', MushroomTypeId: 2, TypeName: 'Nấm rơm', AvailableTrays: 3 },
  ],
  rentals: [{ RentalId: 5, PackageId: 2, PackageName: 'Gói 3 tháng', StartDate: daysFromNow(-20), EndDate: daysFromNow(70), TrayCount: 3, TotalAmount: 1140000, Status: 'Active', TrayCodes: 'TRAY-R01-003, TRAY-R01-004, TRAY-R02-001' }],
  payments: [{ PaymentId: 1, RentalId: 5, PackageName: 'Gói 3 tháng', TrayCount: 3, Amount: 1140000, Method: 'EWallet', Status: 'Paid', PaidAt: daysFromNow(-20) }],
  harvests: [
    { HarvestId: 1, TrayCode: 'TRAY-R01-001', TypeName: 'Nấm sò', ScheduledDate: daysFromNow(-6), HarvestedAt: daysFromNow(-6), WeightKg: 2.35, Quality: 'A', Status: 'Completed', DeliveryRequestId: null, RequestType: null, DeliveryStatus: null },
    { HarvestId: 2, TrayCode: 'TRAY-R01-002', TypeName: 'Nấm sò', ScheduledDate: daysFromNow(-13), HarvestedAt: daysFromNow(-13), WeightKg: 1.8, Quality: 'B', Status: 'Completed', DeliveryRequestId: 7, RequestType: 'Delivery', DeliveryStatus: 'Shipping' },
    { HarvestId: 3, TrayCode: 'TRAY-R01-003', TypeName: 'Nấm sò', ScheduledDate: daysFromNow(4), HarvestedAt: null, WeightKg: null, Quality: null, Status: 'Scheduled', DeliveryRequestId: null, RequestType: null, DeliveryStatus: null },
  ],
  notifications: [
    { NotificationId: 3, Type: 'Alert', Title: 'Cảnh báo độ ẩm', Content: 'Độ ẩm phòng B xuống 72%, thấp hơn ngưỡng 80%. Hệ thống đã bật phun sương.', TrayId: 21, IsRead: false, CreatedAt: iso(Date.now() - 36e5) },
    { NotificationId: 2, Type: 'HarvestReady', Title: 'Sắp đến ngày thu hoạch', Content: 'Khay TRAY-R01-003 dự kiến thu hoạch sau 4 ngày.', TrayId: 11, IsRead: false, CreatedAt: iso(Date.now() - 5 * 36e5) },
    { NotificationId: 1, Type: 'Delivery', Title: 'Cập nhật giao nhận', Content: 'Yêu cầu giao nấm #7 đang giao.', TrayId: null, IsRead: true, CreatedAt: iso(Date.now() - 30 * 36e5) },
  ],
  prefs: ['Alert', 'Progress', 'HarvestReady', 'Rental', 'Delivery', 'System'].map((t, i) => ({ Type: t, DisplayName: { Alert: 'Cảnh báo môi trường', Progress: 'Tiến độ sinh trưởng', HarvestReady: 'Sắp thu hoạch', Rental: 'Thuê khay', Delivery: 'Giao nhận', System: 'Thông báo hệ thống' }[t], SystemEnabled: t !== 'System', UserEnabled: true })),
};

// Dữ liệu demo chỉ sống trong RAM. Tài khoản mới được tách riêng theo UserId.
const passwords = new Map([[1, '123456']]);
const users = new Map([[db.user.Email, db.user]]);
const sessions = new Map();
const userPrefs = new Map();
let nextUserId = 2, nextRentalId = 6, nextTrayId = 100, nextPaymentId = 2, nextRequestId = 100;
const emailOf = v => String(v || '').trim().toLowerCase();
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validPhone = v => !v || /^0[0-9]{9}$/.test(v);
const allowedPayments = ['EWallet','BankTransfer','Card','Cash'];
const allowedRequests = ['Delivery','Pickup'];
const error = (code, message) => [code, message];
const safeUser = u => { const { Password, ...rest } = u; return {...rest}; };
function newToken(id) { const t = 'mock-' + id + '-' + Math.random().toString(36).slice(2) + Date.now().toString(36); sessions.set(t,id); return t; }
function ownerItems(arr, uid) { return arr.filter(x => (x.OwnerId || 1) === uid); }
// Khay được quản trị viên cấp trước và chưa gán cho khách hàng.
db.unassignedTrays = [{ TrayId: 31, TrayCode: 'TRAY-R01-013', RoomName: db.rooms[0].RoomName, TypeName: 'Nấm sò', Status: 'Rented', Stage: null, DaysToHarvest: null, RentalId: null }];
const stateOf = (v, lo, hi) => (v < lo ? 'Low' : v > hi ? 'High' : 'Normal');
function envRow(r) {
  return { ...r, RecordedAt: iso(now()),
    TempState: stateOf(r.Temperature, r.TempMin, r.TempMax), HumState: stateOf(r.Humidity, r.HumMin, r.HumMax), CO2State: stateOf(r.CO2, r.CO2Min, r.CO2Max) };
}
function customerTrays(uid) {
  return ownerItems(db.trays,uid).map((t) => {
    const r = db.rooms.find((x) => x.RoomName === t.RoomName);
    return { ...t, PlantedDate: daysFromNow(-25), ExpectedHarvestDate: t.DaysToHarvest === null ? null : daysFromNow(t.DaysToHarvest),
      RentalEndDate: daysFromNow(70), Temperature: r.Temperature, Humidity: r.Humidity, CO2: r.CO2, EnvRecordedAt: iso(now()), CameraUrl: null };
  });
}
function history(roomId, hours, groupBy) {
  const r = db.rooms.find((x) => x.RoomId === Number(roomId));
  if (!r) return null;
  const step = groupBy === 'hour' ? 3600e3 : 600e3;
  const out = [];
  for (let t = Date.now() - hours * 3600e3; t <= Date.now(); t += step) {
    const k = t / 3600e3;
    out.push({ Time: iso(t), Temperature: +(r.Temperature + Math.sin(k / 3) * 2 + Math.sin(k * 7) * 0.3).toFixed(2),
      Humidity: +(r.Humidity + Math.cos(k / 4) * 5).toFixed(2), CO2: +(r.CO2 + Math.sin(k / 2) * 120).toFixed(1) });
  }
  return out.slice(-400);
}

function route(method, url, body, authToken) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const uid = sessions.get(authToken);
  const currentUser = [...users.values()].find(x => x.UserId === uid);
  const [p, qs] = url.split('?');
  const q = new URLSearchParams(qs || '');
  const m = (re) => p.match(re);
  let g;
  if (method === 'POST' && p === '/api/auth/login') {
    const email = emailOf(body.email), u = users.get(email);
    if (!email || !body.password) return error(400,'Vui lòng nhập email và mật khẩu.');
    if (!u || passwords.get(u.UserId) !== body.password) return error(401,'Email hoặc mật khẩu không đúng.');
    return [200, {data:{token:newToken(u.UserId),user:safeUser(u)}}];
  }
  if (method === 'POST' && p === '/api/auth/register') {
    const email = emailOf(body.email), fullName = String(body.fullName||'').trim();
    if (!fullName || !validEmail(email) || typeof body.password !== 'string' || body.password.length < 6 || !validPhone(body.phone)) return error(400,'Vui lòng nhập tên, email, mật khẩu tối thiểu 6 ký tự và số điện thoại hợp lệ.');
    if (users.has(email)) return error(409,'Email này đã được đăng ký.');
    const user = {UserId:nextUserId++,FullName:fullName,Email:email,Phone:body.phone||'',Address:body.address||'',Role:'Customer',Status:'Active'};
    users.set(email,user); passwords.set(user.UserId,body.password);
    return [201,{data:{token:newToken(user.UserId),user:safeUser(user)}}];
  }
  if (p === '/api/packages' && method === 'GET') return [200,{data:db.packages}];
  if (p === '/api/health' && method === 'GET') return [200,{data:{status:'ok',mock:true}}];
  if (!currentUser) return error(401,'Bạn chưa đăng nhập hoặc phiên đăng nhập không hợp lệ.');
  if (p === '/api/auth/me') {
    if (method === 'PUT') {
      const name = String(body.fullName||'').trim();
      if (!name || !validPhone(body.phone)) return error(400,'Họ tên hoặc số điện thoại không hợp lệ.');
      Object.assign(currentUser,{FullName:name,Phone:body.phone||'',Address:String(body.address||'').trim()});
    } else if (method !== 'GET') return error(405,'Phương thức không hỗ trợ.');
    return [200,{data:safeUser(currentUser)}];
  }
  if (p === '/api/auth/me/password' && method === 'PUT') {
    if (body.currentPassword !== passwords.get(uid)) return error(400,'Mật khẩu hiện tại không đúng.');
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 6) return error(400,'Mật khẩu mới phải có ít nhất 6 ký tự.');
    if (body.newPassword === body.currentPassword) return error(400,'Mật khẩu mới phải khác mật khẩu cũ.');
    passwords.set(uid,body.newPassword);
    return [200,{data:{ok:true}}];
  }
  if (p === '/api/my/trays') return [200, { data: customerTrays(uid) }];
  if ((g = m(/^\/api\/my\/trays\/(\d+)$/))) {
    const t = customerTrays(uid).find((x) => x.TrayId === Number(g[1]));
    if (!t) return [404, 'Không tìm thấy khay trong danh sách khay bạn đang thuê.'];
    const r = db.rooms.find((x) => x.RoomName === t.RoomName);
    return [200, { data: { ...t,
      growthLogs: [
        { LogId: 3, Stage: t.Stage || 'Inoculation', Note: 'Nấm ra quả thể đều, màu đẹp.', ImageUrl: null, LoggedAt: daysFromNow(-1) },
        { LogId: 2, Stage: 'Pinning', Note: 'Bắt đầu ra nụ.', ImageUrl: null, LoggedAt: daysFromNow(-6) },
        { LogId: 1, Stage: 'Inoculation', Note: 'Cấy giống vào khay.', ImageUrl: null, LoggedAt: daysFromNow(-25) } ],
      harvests: db.harvests.filter((h) => h.TrayCode === t.TrayCode).map((h) => ({ ...h, DeliveryStatus: h.DeliveryStatus })),
      thresholds: [{ Metric: 'Temperature', MinValue: r.TempMin, MaxValue: r.TempMax }, { Metric: 'Humidity', MinValue: r.HumMin, MaxValue: r.HumMax }, { Metric: 'CO2', MinValue: r.CO2Min, MaxValue: r.CO2Max }] } }];
  }
  if (p === '/api/my/transactions') return [200, { data: ownerItems(db.payments,uid), pagination: { page: 1, pageSize: 10, total: ownerItems(db.payments,uid).length } }];
  if (p === '/api/my/harvests') return [200, { data: ownerItems(db.harvests,uid) }];
  if (p === '/api/environment') return [200, { data: db.rooms.map(envRow) }];
  if ((g = m(/^\/api\/environment\/(\d+)\/history$/))) { const hours=Number(q.get('hours')||24); if (!Number.isFinite(hours)||hours<1||hours>168) return error(400,'Khoảng thời gian không hợp lệ.'); const data=history(g[1],hours,q.get('groupBy')); return data ? [200,{data}] : error(404,'Không tìm thấy phòng.'); }
  if (p === '/api/trays/available') return [200, { data: db.available }];
  if (method === 'POST' && p === '/api/rentals') {
    const pkg = db.packages.find(x=>x.PackageId===Number(body.packageId));
    if (!pkg) return error(404,'Không tìm thấy gói thuê.');
    const n = body.trayCount;
    if (typeof n !== 'number' || !Number.isInteger(n) || n<1 || n>pkg.MaxTrays) return error(400,'Số khay phải là số nguyên từ 1 đến giới hạn gói thuê.');
    if (!allowedPayments.includes(body.paymentMethod)) return error(400,'Phương thức thanh toán không hợp lệ.');
    if (body.roomId !== undefined && (!Number.isInteger(body.roomId)||!db.available.some(x=>x.RoomId===body.roomId))) return error(400,'Phòng được chọn không tồn tại.');
    const pool=body.roomId===undefined ? db.available.find(x=>x.AvailableTrays>=n) : db.available.find(x=>x.RoomId===body.roomId);
    if (!pool || pool.AvailableTrays<n) return error(409,'Số lượng khay trống không đủ.');
    if (body.mushroomTypeId!==undefined && Number(body.mushroomTypeId)!==pool.MushroomTypeId) return error(400,'Loại nấm không khớp với phòng.');
    const rentalId=nextRentalId++;
    const codes=Array.from({length:n},(_,i)=>'TRAY-R0'+pool.RoomId+'-'+String(nextTrayId+i).padStart(3,'0'));
    const amount=n*pkg.PricePerTray;
    pool.AvailableTrays-=n;
    db.rentals.unshift({RentalId:rentalId,OwnerId:uid,PackageId:pkg.PackageId,PackageName:pkg.PackageName,StartDate:daysFromNow(0),EndDate:daysFromNow(pkg.DurationDays),TrayCount:n,TotalAmount:amount,Status:'Active',TrayCodes:codes.join(', ')});
    db.payments.unshift({PaymentId:nextPaymentId++,OwnerId:uid,RentalId:rentalId,PackageName:pkg.PackageName,TrayCount:n,Amount:amount,Method:body.paymentMethod,Status:'Paid',PaidAt:daysFromNow(0)});
    codes.forEach((c,i)=>db.trays.push({TrayId:nextTrayId++,OwnerId:uid,TrayCode:c,RoomName:pool.RoomName,TypeName:pool.TypeName,Status:'Rented',Stage:null,DaysToHarvest:null,RentalId:rentalId}));
    return [201,{data:{rentalId,trays:codes.map(TrayCode=>({TrayCode}))}}];
  }
  if (method === 'POST' && p === '/api/rentals/link') {
    const code=String(body.trayCode||'').trim().toUpperCase();
    if (!code) return error(400,'Vui lòng nhập mã khay.');
    if (db.trays.some(x=>x.TrayCode===code)) return error(409,'Khay này đã được liên kết với tài khoản.');
    const at=db.unassignedTrays.findIndex(x=>x.TrayCode===code);
    if (at<0) return error(404,'Mã khay không tồn tại hoặc chưa được cấp cho bạn.');
    const t=db.unassignedTrays.splice(at,1)[0];
    db.trays.push({...t,OwnerId:uid});
    return [200,{data:{TrayCode:code}}];
  }
  if (p === '/api/rentals') return [200, { data: ownerItems(db.rentals,uid), pagination: { page: 1, pageSize: 20, total: ownerItems(db.rentals,uid).length } }];
  if (method === 'POST' && p === '/api/deliveries') {
    const h=ownerItems(db.harvests,uid).find(x=>x.HarvestId===Number(body.harvestId));
    if (!h) return error(404,'Không tìm thấy đợt thu hoạch.');
    if (h.Status!=='Completed') return error(409,'Chỉ yêu cầu giao nhận khi đã thu hoạch.');
    if (h.DeliveryRequestId!==null) return error(409,'Đợt thu hoạch đã có yêu cầu giao nhận.');
    if (!allowedRequests.includes(body.requestType)) return error(400,'Hình thức nhận nấm không hợp lệ.');
    if (body.requestType==='Delivery' && (!String(body.address||'').trim() || !validPhone(body.receiverPhone))) return error(400,'Giao tận nơi cần địa chỉ và số điện thoại hợp lệ.');
    if (body.preferredDate && (!/^\d{4}-\d{2}-\d{2}$/.test(body.preferredDate) || Number.isNaN(Date.parse(body.preferredDate)))) return error(400,'Ngày mong muốn không hợp lệ.');
    Object.assign(h,{DeliveryRequestId:nextRequestId++,RequestType:body.requestType,DeliveryStatus:'Pending'});
    return [201,{data:{RequestId:h.DeliveryRequestId,Status:'Pending'}}];
  }
  if ((g=m(/^\/api\/deliveries\/(\d+)\/cancel$/)) && method==='PATCH') {
    const h=ownerItems(db.harvests,uid).find(x=>x.DeliveryRequestId===Number(g[1]));
    if (!h || h.DeliveryStatus!=='Pending') return error(409,'Chỉ hủy yêu cầu đang chờ xử lý.');
    Object.assign(h,{DeliveryRequestId:null,RequestType:null,DeliveryStatus:null});
    return [200,{data:{status:'Cancelled'}}];
  }
  if (p === '/api/notifications/preferences') {
    if (method==='GET') return [200,{data:userPrefs.get(uid) || (uid===1 ? db.prefs : db.prefs.map(x=>({...x,UserEnabled:true})))}];
    if (method!=='PUT' || typeof body.isEnabled!=='boolean') return error(400,'Dữ liệu thiết lập thông báo không hợp lệ.');
    if (!userPrefs.has(uid)) userPrefs.set(uid, (uid===1 ? db.prefs : db.prefs.map(x=>({...x,UserEnabled:true}))));
    const x=userPrefs.get(uid).find(i=>i.Type===body.type);
    if (!x || !x.SystemEnabled) return error(400,'Loại thông báo không thể thay đổi.');
    x.UserEnabled=body.isEnabled; return [200,{data:x}];
  }
  if (p === '/api/notifications/read-all' && method==='PATCH') { let count=0; ownerItems(db.notifications,uid).forEach(n=>{if(!n.IsRead){n.IsRead=true;count++;}});return [200,{data:{updated:count}}]; }
  if ((g=m(/^\/api\/notifications\/(\d+)\/read$/)) && method==='PATCH') { const n=ownerItems(db.notifications,uid).find(x=>x.NotificationId===Number(g[1])); if(!n)return error(404,'Thông báo không tồn tại.'); n.IsRead=true;return [200,{data:{}}]; }
  if ((g=m(/^\/api\/notifications\/(\d+)$/)) && method==='DELETE') { const before=db.notifications.length;db.notifications=db.notifications.filter(x=>x.NotificationId!==Number(g[1])||(x.OwnerId||1)!==uid);return before!==db.notifications.length ? [200,{data:{}}] : error(404,'Thông báo không tồn tại.'); }
  if (p === '/api/notifications' && method==='GET') {
    const own=ownerItems(db.notifications,uid);
    const list=q.get('unreadOnly')==='true' ? own.filter(n=>!n.IsRead) : own;
    return [200,{data:list,pagination:{page:1,pageSize:50,total:list.length},unreadCount:own.filter(n=>!n.IsRead).length}];
  }
  return [404, 'Không tìm thấy API (máy chủ giả): ' + method + ' ' + p];
}

  var api = { route: route, isValidToken: token => sessions.has(token) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MockApi = api;
})(typeof window !== 'undefined' ? window : globalThis);
