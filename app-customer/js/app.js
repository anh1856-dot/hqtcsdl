(function () {
  'use strict';

  //  Cấu hình & lưu trữ
  // Mở qua máy chủ giả (mock-server.js, cổng 3001) thì tự dùng chính nó làm API; còn lại dùng backend thật ở cổng 3000.
  const DEFAULT_API = (location.protocol.indexOf('http') === 0 && location.port === '3001') ? location.origin + '/api' : 'http://localhost:3000/api';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } },
  };
  const state = {
    api: store.get('api', DEFAULT_API),
    token: store.get('token', ''),
    user: null,
    tab: 'trays',
    detail: null,      // { type: 'tray', id } khi đang xem chi tiết
    authMode: 'login',
    rent: { packageId: null, count: 1, combo: '', method: 'EWallet' },
    chart: { metric: 'Temperature', range: 24 },
    unread: 0,
    timer: null,
    demo: !!window.MockApi && /[?&]demo(=1|=true)?(&|$)/.test(location.search),   // index.html?demo=1: dùng dữ liệu giả ngay trong trình duyệt
  };

  //Hằng số hiển thị 
  const STAGES = ['Inoculation', 'Incubation', 'Pinning', 'Fruiting', 'Harvest'];
  const STAGE_VI = { Inoculation: 'Cấy giống', Incubation: 'Ủ tơ', Pinning: 'Ra nụ', Fruiting: 'Quả thể', Harvest: 'Thu hoạch' };
  const TRAY_STATUS_VI = { Available: 'Trống', Rented: 'Đã thuê', Growing: 'Đang trồng', ReadyToHarvest: 'Sắp thu hoạch', Harvested: 'Đã thu hoạch', Maintenance: 'Bảo trì' };
  const STATE_VI = { Low: 'Thấp', High: 'Cao', Normal: 'Ổn định' };
  const METRICS = {
    Temperature: { label: 'Nhiệt độ', unit: '°C', key: 'Temperature', st: 'TempState', min: 'TempMin', max: 'TempMax', color: '#d9662b' },
    Humidity: { label: 'Độ ẩm', unit: '%', key: 'Humidity', st: 'HumState', min: 'HumMin', max: 'HumMax', color: '#2a7fb8' },
    CO2: { label: 'CO₂', unit: 'ppm', key: 'CO2', st: 'CO2State', min: 'CO2Min', max: 'CO2Max', color: '#7a6a3a' },
  };
  const NOTIF = {
    Alert: { ico: '⚠️', name: 'Cảnh báo' }, Progress: { ico: '🌱', name: 'Tiến độ' }, HarvestReady: { ico: '🧺', name: 'Sắp thu hoạch' },
    Rental: { ico: '🧾', name: 'Thuê khay' }, Delivery: { ico: '🚚', name: 'Giao nhận' }, System: { ico: '📢', name: 'Hệ thống' },
  };
  const DELIVERY_VI = { Pending: 'Chờ xử lý', Confirmed: 'Đã xác nhận', Shipping: 'Đang giao', Completed: 'Hoàn tất', Cancelled: 'Đã hủy' };
  const HARVEST_VI = { Scheduled: 'Đã lên lịch', Completed: 'Đã thu hoạch', Cancelled: 'Đã hủy' };
  const RENTAL_VI = { Pending: 'Chờ xử lý', Active: 'Đang thuê', Completed: 'Đã kết thúc', Cancelled: 'Đã hủy' };
  const PAY_VI = { Cash: 'Tiền mặt', BankTransfer: 'Chuyển khoản', EWallet: 'Ví điện tử', Card: 'Thẻ' };
  const PAY_STATUS_VI = { Pending: 'Chờ', Paid: 'Đã thanh toán', Failed: 'Thất bại', Refunded: 'Đã hoàn' };

  // Tiện ích 
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Giờ trong DB là giờ địa phương của máy chủ SQL nên hiển thị nguyên giá trị (timeZone UTC) để không bị lệch múi giờ.
  function fmtDate(v) {
    if (!v) return '–';
    const d = new Date(v);
    return isNaN(d) ? '–' : d.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
  }
  const p2 = (n) => String(n).padStart(2, '0');
  function fmtDateTime(v) {
    if (!v) return '–';
    const d = new Date(v);
    return isNaN(d) ? '–' : p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ' ' + p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1);
  }
  const fmtMoney = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
  const num = (v, d) => (v === null || v === undefined ? '–' : Number(v).toFixed(d === undefined ? 1 : d));
  const stageVi = (s) => STAGE_VI[s] || s || 'Chưa bắt đầu';
  const todayIso = () => new Date().toISOString().slice(0, 10);

  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.add('hidden'), isErr ? 4200 : 2400);
  }

  function openModal(html) {
    const m = $('#modal');
    m.innerHTML = '<div class="sheet">' + html + '</div>';
    m.classList.remove('hidden');
    m.onclick = (e) => { if (e.target === m) closeModal(); };
  }
  function closeModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }

  function confirmBox(title, text, okLabel) {
    return new Promise((resolve) => {
      openModal('<h2>' + esc(title) + '</h2><p class="muted">' + text + '</p>' +
        '<div class="actions"><button class="btn ghost" id="cNo">Hủy</button><button class="btn" id="cYes">' + esc(okLabel || 'Đồng ý') + '</button></div>');
      $('#cNo').onclick = () => { closeModal(); resolve(false); };
      $('#cYes').onclick = () => { closeModal(); resolve(true); };
    });
  }

  // Gọi API 
  async function demoApi(path, opts) {
    const isPublic = /^\/(auth\/(login|register)|packages)/.test(path);
    if (!isPublic && !window.MockApi.isValidToken(state.token)) { logout(true); throw new Error('Bạn chưa đăng nhập.'); }
    await new Promise((r) => setTimeout(r, 120));
    const out = window.MockApi.route(opts.method || 'GET', '/api' + path, opts.body || {}, state.token);
    if (out[0] >= 400) throw new Error(typeof out[1] === 'string' ? out[1] : 'Lỗi (' + out[0] + ')');
    return out[1];
  }

  async function api(path, opts) {
    opts = opts || {};
    if (state.demo) return demoApi(path, opts);
    const headers = { 'Content-Type': 'application/json' };
    if (state.token && opts.auth !== false) headers.Authorization = 'Bearer ' + state.token;
    let res;
    try {
      res = await fetch(state.api + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) {
      throw new Error('Không kết nối được máy chủ. Hãy chạy backend (npm run dev) và kiểm tra địa chỉ API ở màn hình đăng nhập.');
    }
    let body = null;
    try { body = await res.json(); } catch (e) { /* không có JSON */ }
    if (!res.ok) {
      if (res.status === 401 && opts.auth !== false) { logout(true); }
      throw new Error((body && body.error && body.error.message) || ('Lỗi máy chủ (' + res.status + ').'));
    }
    return body || {};
  }

  //    Khởi động & đăng nhập 
  async function boot() {
    bindGlobal();
    if (state.token) {
      try {
        const me = await api('/auth/me');
        if (me.data.Role !== 'Customer') throw new Error('Ứng dụng này dành cho khách hàng.');
        state.user = me.data;
        return enterApp();
      } catch (e) {
        state.token = ''; store.del('token');
      }
    }
    showAuth();
  }

  function showAuth(msg) {
    clearInterval(state.timer);
    $('#shell').classList.add('hidden');
    const a = $('#auth');
    a.classList.remove('hidden');
    const reg = state.authMode === 'register';
    a.innerHTML =
      '<div class="logo"><div class="mush">🍄</div><h2>Nấm Smart</h2><p>Thuê khay – theo dõi nấm của bạn từ xa</p></div>' +
      (state.demo ? '<div class="demo-box" style="margin:-6px 0 12px"><b>Chế độ demo</b> – dữ liệu giả, không cần máy chủ.<br>Đăng nhập: <b>an.le@example.test</b>, mật khẩu <b>123456</b>.</div>' : '') +
      '<form id="authForm" class="card" autocomplete="on">' +
      '<h3>' + (reg ? 'Tạo tài khoản' : 'Đăng nhập') + '</h3>' +
      (msg ? '<p class="error">' + esc(msg) + '</p>' : '') +
      '<p class="error hidden" id="authErr"></p>' +
      (reg ? '<label class="field"><span>Họ và tên</span><input type="text" name="fullName" required autocomplete="name"></label>' : '') +
      '<label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>' +
      '<label class="field"><span>Mật khẩu' + (reg ? ' (tối thiểu 6 ký tự)' : '') + '</span><input type="password" name="password" required autocomplete="' + (reg ? 'new-password' : 'current-password') + '"></label>' +
      (reg ? '<label class="field"><span>Số điện thoại (không bắt buộc)</span><input type="tel" name="phone" autocomplete="tel"></label>' +
        '<label class="field"><span>Địa chỉ (không bắt buộc)</span><input type="text" name="address" autocomplete="street-address"></label>' : '') +
      '<button class="btn block" type="submit">' + (reg ? 'Đăng ký' : 'Đăng nhập') + '</button>' +
      '<div class="switch">' + (reg ? 'Đã có tài khoản? <a data-action="auth-switch">Đăng nhập</a>' : 'Chưa có tài khoản? <a data-action="auth-switch">Đăng ký</a>') + '</div>' +
      '</form>' +
      '<details><summary>Cài đặt kết nối máy chủ</summary>' +
      '<label class="field mt"><span>Địa chỉ API</span><input type="url" id="apiUrl" value="' + esc(state.api) + '"></label>' +
      '<button class="btn ghost sm" type="button" data-action="save-api">Lưu địa chỉ</button>' +
      '<div class="demo-box">Tài khoản mẫu: <b>an.le@example.test</b><br>Mật khẩu mẫu xem trong <code>database/README.md</code>.</div>' +
      '</details>';
    $('#authForm').onsubmit = submitAuth;
  }

  async function submitAuth(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('button[type=submit]', e.target);
    const err = $('#authErr');
    err.classList.add('hidden');
    btn.disabled = true;
    try {
      let r;
      if (state.authMode === 'register') {
        r = await api('/auth/register', { method: 'POST', auth: false, body: {
          fullName: f.get('fullName'), email: f.get('email'), password: f.get('password'), phone: f.get('phone') || undefined, address: f.get('address') || undefined } });
      } else {
        r = await api('/auth/login', { method: 'POST', auth: false, body: { email: f.get('email'), password: f.get('password') } });
      }
      if (r.data.user.Role !== 'Customer') throw new Error('Ứng dụng này dành cho khách hàng. Tài khoản quản trị vui lòng dùng web quản lý.');
      state.token = r.data.token; store.set('token', state.token);
      state.user = r.data.user;
      enterApp();
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove('hidden');
    } finally { btn.disabled = false; }
  }

  function logout(expired) {
    state.token = ''; state.user = null; state.detail = null; state.tab = 'trays';
    store.del('token');
    showAuth(expired === true ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' : '');
  }

  function enterApp() {
    $('#auth').classList.add('hidden');
    $('#shell').classList.remove('hidden');
    state.tab = 'trays'; state.detail = null;
    go();
    refreshBadge();
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      refreshBadge();
      if (!state.detail && state.tab === 'trays' && document.visibilityState === 'visible') loadTab(true);
    }, 30000);
  }

  // Điều hướng 
  const TITLES = { trays: 'Khay của tôi', rent: 'Thuê khay', harvest: 'Thu hoạch & giao nhận', notif: 'Thông báo', me: 'Tài khoản' };
  function go(tab) {
    if (tab) { state.tab = tab; state.detail = null; }
    $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
    $('#title').textContent = state.detail ? 'Chi tiết khay' : TITLES[state.tab];
    $('#backBtn').classList.toggle('hidden', !state.detail);
    $('#main').scrollTop = 0;
    loadTab();
  }

  async function loadTab(silent) {
    const main = $('#main');
    if (!silent) main.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    const token = ++loadTab.seq;
    try {
      let html;
      if (state.detail) html = await viewTrayDetail(state.detail.id);
      else if (state.tab === 'trays') html = await viewTrays();
      else if (state.tab === 'rent') html = await viewRent();
      else if (state.tab === 'harvest') html = await viewHarvest();
      else if (state.tab === 'notif') html = await viewNotif();
      else html = await viewMe();
      if (token !== loadTab.seq) return;           // người dùng đã chuyển tab
      const keep = main.scrollTop;
      main.innerHTML = html;
      if (silent) main.scrollTop = keep;
      afterRender();
    } catch (e) {
      if (token !== loadTab.seq || !state.token) return;
      main.innerHTML = '<div class="empty"><span class="big">😕</span>' + esc(e.message) +
        '<div class="mt"><button class="btn ghost sm" data-action="refresh">Thử lại</button></div></div>';
    }
  }
  loadTab.seq = 0;

  async function refreshBadge() {
    try {
      const r = await api('/notifications?unreadOnly=true&pageSize=1');
      setBadge(r.unreadCount || 0);
    } catch (e) { /* bỏ qua */ }
  }
  function setBadge(n) {
    state.unread = n;
    const b = $('#badge');
    b.textContent = n > 99 ? '99+' : n;
    b.classList.toggle('hidden', !n);
  }

  //  Màn hình: Khay của tôi 
  function stageBar(stage) {
    const idx = STAGES.indexOf(stage);
    return '<div class="progress">' + STAGES.map((s, i) => '<i class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '"></i>').join('') + '</div>' +
      '<div class="stage-labels">' + STAGES.map((s, i) => '<span class="' + (i === idx ? 'cur' : '') + '">' + STAGE_VI[s] + '</span>').join('') + '</div>';
  }

  function daysText(t) {
    if (t.DaysToHarvest === null || t.DaysToHarvest === undefined) return t.ExpectedHarvestDate ? 'Dự kiến ' + fmtDate(t.ExpectedHarvestDate) : 'Chưa có lịch thu hoạch';
    if (t.DaysToHarvest <= 0) return 'Đến hạn thu hoạch';
    return 'Còn ' + t.DaysToHarvest + ' ngày (dự kiến ' + fmtDate(t.ExpectedHarvestDate) + ')';
  }

  function metricsBlock(e, withRange) {
    return '<div class="metrics">' + Object.keys(METRICS).map((k) => {
      const m = METRICS[k];
      const st = e[m.st] || 'Normal';
      const val = e[m.key];
      return '<div class="metric ' + (val === null || val === undefined ? 'Normal' : st) + '"><div class="v">' + num(val, k === 'CO2' ? 0 : 1) + '<small> ' + m.unit + '</small></div>' +
        '<div class="k">' + m.label + '</div>' +
        (val === null || val === undefined ? '' : '<div class="st">' + STATE_VI[st] + '</div>') +
        (withRange && e[m.min] !== undefined && e[m.min] !== null ? '<div class="range">' + num(e[m.min], 0) + ' – ' + num(e[m.max], 0) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  async function viewTrays() {
    const [trays, env] = await Promise.all([api('/my/trays'), api('/environment').catch(() => ({ data: [] }))]);
    const list = trays.data || [];
    const growing = list.filter(t => t.Status === 'Growing' || t.Status === 'ReadyToHarvest').length;
    const nearHarvest = list.filter(t => Number.isFinite(Number(t.DaysToHarvest)) && t.DaysToHarvest !== null && Number(t.DaysToHarvest) <= 7).length;
    const roomRows = env.data || [];
    const alerts = roomRows.filter(r => ['TempState','HumState','CO2State'].some(k => r[k] && r[k] !== 'Normal')).length;
    let html = '<div class="hero"><div class="hero-glow"></div><div class="hero-kicker"><span class="live-dot"></span> HỆ THỐNG ĐANG HOẠT ĐỘNG</div>' +
      '<div class="hero-title">Xin chào, ' + esc((state.user && state.user.FullName || 'bạn').split(' ').slice(-1)[0]) + ' 👋</div>' +
      '<p>Chăm sóc khu vườn nấm của bạn, mọi lúc mọi nơi.</p>' +
      '<div class="hero-actions"><button class="hero-button" data-action="goto" data-tab="rent">＋ Thuê khay mới</button><span>🍄 Nấm Smart Farm</span></div></div>' +
      '<div class="overview-head"><div><div class="overline">TỔNG QUAN</div><h2>Trang trại của bạn</h2></div><span class="overview-date">' + fmtDate(new Date().toISOString()) + '</span></div>' +
      '<div class="stats-grid">' +
      '<div class="stat-card stat-primary"><span class="stat-icon">▦</span><div class="stat-number">' + list.length + '</div><div class="stat-label">Khay đang thuê</div><span class="stat-foot">Đang quản lý</span></div>' +
      '<div class="stat-card"><span class="stat-icon">🌱</span><div class="stat-number">' + growing + '</div><div class="stat-label">Đang sinh trưởng</div><span class="stat-foot">Theo dõi mỗi ngày</span></div>' +
      '<div class="stat-card"><span class="stat-icon">🧺</span><div class="stat-number">' + nearHarvest + '</div><div class="stat-label">Sắp thu hoạch</div><span class="stat-foot">Trong 7 ngày</span></div>' +
      '<div class="stat-card"><span class="stat-icon">🌡</span><div class="stat-number">' + alerts + '</div><div class="stat-label">Phòng cảnh báo</div><span class="stat-foot">' + (alerts ? 'Cần chú ý' : 'Môi trường ổn định') + '</span></div></div>' +
      '<div class="quick-heading"><div><div class="overline">THEO DÕI TRỰC TIẾP</div><h2>Danh sách khay</h2></div><button class="text-button" data-action="refresh">↻ Cập nhật</button></div>';
    if (!list.length) {
      html += '<div class="empty"><span class="big">🌱</span>Bạn chưa có khay nào.<div class="mt row" style="justify-content:center">' +
        '<button class="btn sm" data-action="goto" data-tab="rent">Thuê khay</button>' +
        '<button class="btn ghost sm" data-action="link-tray">Nhập mã khay</button></div></div>';
      return html;
    }
    html += '<div class="row between tray-toolbar"><div class="small muted">' + list.length + ' khay đang được theo dõi</div>' +
      '<button class="btn ghost sm" data-action="link-tray">+ Nhập mã khay</button></div><div style="height:8px"></div>';
    html += list.map((t) => {
      const warn = Object.keys(METRICS).some((k) => t[METRICS[k].key] !== null && t[METRICS[k].key] !== undefined && roomState(env.data, t.RoomName, k) !== 'Normal');
      return '<div class="card tray" data-action="open-tray" data-id="' + esc(t.TrayId) + '">' +
        '<div class="tray-card-top"><span class="tray-avatar">🍄</span><div class="tray-title-wrap"><span class="code">' + esc(t.TrayCode) + '</span><span class="tray-subtitle">' + esc(t.TypeName || 'Chưa chọn loại nấm') + '</span></div>' +
        '<span class="chip ' + (t.Status === 'ReadyToHarvest' ? 'warn' : '') + '">' + esc(TRAY_STATUS_VI[t.Status] || t.Status) + '</span></div>' +
        '<div class="muted small tray-room">⌖ ' + esc(t.RoomName) + '</div>' +
        stageBar(t.Stage) +
        '<div class="small muted mt">' + esc(daysText(t)) + '</div>' +
        (t.Temperature !== null && t.Temperature !== undefined ? '<div class="small mt">🌡 ' + num(t.Temperature) + '°C · 💧 ' + num(t.Humidity) + '% · CO₂ ' + num(t.CO2, 0) + ' ppm' +
          (warn ? ' <span class="chip warn">Ngoài ngưỡng</span>' : '') + '</div>' : '') +
        '<div class="tray-cta">Xem chi tiết khay <span>→</span></div></div>'; 
    }).join('');
    return html;
  }

  function roomState(envRows, roomName, metricKey) {
    const row = (envRows || []).find((r) => r.RoomName === roomName);
    return row ? row[METRICS[metricKey].st] : 'Normal';
  }

  //  Màn hình: chi tiết khay 
  async function viewTrayDetail(id) {
    const [r, envAll] = await Promise.all([api('/my/trays/' + encodeURIComponent(id)), api('/environment').catch(() => ({ data: [] }))]);
    const t = r.data;
    const roomRow = (envAll.data || []).find((x) => x.RoomName === t.RoomName);   // /my/trays không trả RoomId nên tra theo tên phòng
    t.RoomId = roomRow ? roomRow.RoomId : null;
    const th = {};
    (t.thresholds || []).forEach((x) => { th[x.Metric] = x; });
    const env = { Temperature: t.Temperature, Humidity: t.Humidity, CO2: t.CO2 };
    Object.keys(METRICS).forEach((k) => {
      const m = METRICS[k], x = th[k], v = env[k];
      env[m.min] = x ? x.MinValue : null; env[m.max] = x ? x.MaxValue : null;
      env[m.st] = v === null || v === undefined || !x ? 'Normal' : (v < x.MinValue ? 'Low' : v > x.MaxValue ? 'High' : 'Normal');
    });
    state.detail.roomName = t.RoomName;

    let html = '<div class="card"><div class="row between"><span class="strong" style="font-size:18px">' + esc(t.TrayCode) + '</span>' +
      '<span class="chip">' + esc(TRAY_STATUS_VI[t.Status] || t.Status) + '</span></div>' +
      '<div class="muted small tray-room">⌖ ' + esc(t.RoomName) + '</div>' +
      stageBar(t.Stage) +
      '<div class="small mt"><b>Thu hoạch:</b> ' + esc(daysText(t)) + '</div>' +
      '<div class="small"><b>Hạn thuê:</b> đến ' + fmtDate(t.RentalEndDate) + '</div>' +
      (t.CameraUrl ? '<div class="mt"><a class="link" href="' + esc(t.CameraUrl) + '" target="_blank" rel="noopener noreferrer">📷 Xem camera trực tiếp</a></div>' : '') +
      '</div>';

    html += '<div class="section-title">Môi trường · ' + esc(t.RoomName) + '</div><div class="card">' +
      '<div class="small muted">Cập nhật: ' + fmtDateTime(t.EnvRecordedAt) + '</div>' + metricsBlock(env, true) +
      '<hr class="sep"><div class="row between"><div class="seg" id="metricSeg">' +
      Object.keys(METRICS).map((k) => '<button data-action="chart-metric" data-m="' + k + '" class="' + (state.chart.metric === k ? 'active' : '') + '">' + METRICS[k].label + '</button>').join('') + '</div>' +
      '<div class="seg">' + [[24, '24 giờ'], [168, '7 ngày']].map((x) => '<button data-action="chart-range" data-h="' + x[0] + '" class="' + (state.chart.range === x[0] ? 'active' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' +
      '<div id="chartBox" data-room="' + esc(t.RoomId || '') + '"><div class="loading"><span class="spinner"></span></div></div></div>';

    html += '<div class="section-title">Nhật ký sinh trưởng</div><div class="card">';
    if (!t.growthLogs || !t.growthLogs.length) html += '<div class="muted small">Chưa có nhật ký.</div>';
    else {
      html += '<ul class="timeline">' + t.growthLogs.map((l) => '<li><div class="strong">' + esc(stageVi(l.Stage)) + '</div>' +
        '<div class="small muted">' + fmtDateTime(l.LoggedAt) + '</div>' +
        (l.Note ? '<div>' + esc(l.Note) + '</div>' : '') +
        (l.ImageUrl && /^https?:\/\//i.test(l.ImageUrl) ? '<img loading="lazy" src="' + esc(l.ImageUrl) + '" alt="Ảnh khay">' : '') + '</li>').join('') + '</ul>';
    }
    html += '</div>';

    html += '<div class="section-title">Thu hoạch</div>';
    if (!t.harvests || !t.harvests.length) html += '<div class="card muted small">Chưa có lịch thu hoạch.</div>';
    else html += t.harvests.map((h) => '<div class="card"><div class="row between"><span class="strong">' + (h.Status === 'Completed' ? fmtDate(h.HarvestedAt) : 'Dự kiến ' + fmtDate(h.ScheduledDate)) + '</span>' +
      '<span class="chip ' + (h.Status === 'Completed' ? '' : 'gray') + '">' + esc(HARVEST_VI[h.Status] || h.Status) + '</span></div>' +
      (h.Status === 'Completed' ? '<div class="small">Khối lượng <b>' + num(h.WeightKg, 2) + ' kg</b> · loại ' + esc(h.Quality || '–') + '</div>' : '') +
      (h.DeliveryStatus ? '<div class="small muted">Giao nhận: ' + esc(DELIVERY_VI[h.DeliveryStatus] || h.DeliveryStatus) + '</div>' : '') + '</div>').join('');
    return html;
  }

  async function drawChart() {
    const box = $('#chartBox');
    if (!box) return;
    const roomId = box.dataset.room;
    if (!roomId) { box.innerHTML = '<div class="muted small mt">Chưa có dữ liệu biểu đồ.</div>'; return; }
    const m = METRICS[state.chart.metric];
    try {
      let r = await api('/environment/' + encodeURIComponent(roomId) + '/history?hours=' + state.chart.range + '&groupBy=hour');
      let pts = r.data || [];
      if (pts.length < 3) {   // ít dữ liệu theo giờ → lấy từng lần đo
        r = await api('/environment/' + encodeURIComponent(roomId) + '/history?hours=' + state.chart.range + '&groupBy=none');
        pts = r.data || [];
      }
      if (!$('#chartBox')) return;
      box.innerHTML = lineChart(pts, m);
    } catch (e) {
      if ($('#chartBox')) box.innerHTML = '<div class="muted small mt">' + esc(e.message) + '</div>';
    }
  }

  function lineChart(rows, m) {
    const data = rows.map((r) => ({ t: new Date(r.Time).getTime(), v: r[m.key] === null ? null : Number(r[m.key]) })).filter((p) => p.v !== null && !isNaN(p.t));
    if (data.length < 2) return '<div class="muted small mt">Chưa đủ dữ liệu để vẽ biểu đồ.</div>';
    const W = 420, H = 150, L = 34, R = 8, T = 10, B = 20;
    const vs = data.map((p) => p.v);
    let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    if (hi - lo < 1) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    const t0 = data[0].t, t1 = data[data.length - 1].t || t0 + 1;
    const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const line = data.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
    const area = line + ' L' + x(t1).toFixed(1) + ' ' + (H - B) + ' L' + x(t0).toFixed(1) + ' ' + (H - B) + ' Z';
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3, yy = y(v);
      grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="#e6e2d6"/><text x="' + (L - 4) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end">' + v.toFixed(m.key === 'CO2' ? 0 : 1) + '</text>';
    }
    const fmtT = (t) => { const d = new Date(t); return p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
    const last = data[data.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Biểu đồ ' + m.label + '">' + grid +
      '<path d="' + area + '" fill="' + m.color + '" opacity=".12"/><path d="' + line + '" fill="none" stroke="' + m.color + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="' + x(last.t).toFixed(1) + '" cy="' + y(last.v).toFixed(1) + '" r="3.5" fill="' + m.color + '"/>' +
      '<text x="' + L + '" y="' + (H - 5) + '">' + fmtT(t0) + '</text><text x="' + (W - R) + '" y="' + (H - 5) + '" text-anchor="end">' + fmtT(t1) + '</text></svg>' +
      '<div class="small muted center">' + m.label + ' (' + m.unit + ') · thấp nhất ' + Math.min.apply(null, vs).toFixed(1) + ' · cao nhất ' + Math.max.apply(null, vs).toFixed(1) + '</div>';
  }

  function linkTrayModal() {
    openModal('<h2>Nhập mã khay</h2><p class="muted small">Nhập mã khay in trên khay do trại nấm gán cho bạn (ví dụ TRAY-R01-013) để liên kết vào tài khoản.</p>' +
      '<p class="error hidden" id="mErr"></p><label class="field"><span>Mã khay</span><input type="text" id="trayCode" placeholder="TRAY-R01-013" autocapitalize="characters"></label>' +
      '<div class="actions"><button class="btn ghost" data-action="close">Hủy</button><button class="btn" id="mOk">Liên kết</button></div>');
    $('#mOk').onclick = async () => {
      const code = $('#trayCode').value.trim();
      if (!code) return showErr('Vui lòng nhập mã khay.');
      $('#mOk').disabled = true;
      try { await api('/rentals/link', { method: 'POST', body: { trayCode: code } }); closeModal(); toast('Đã liên kết khay ' + code.toUpperCase()); loadTab(); }
      catch (e) { showErr(e.message); $('#mOk').disabled = false; }
    };
  }
  function showErr(msg) { const e = $('#mErr'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } }

  // Màn hình: Thuê khay
  async function viewRent() {
    const [pk, av, rentals] = await Promise.all([
      api('/packages', { auth: false }), api('/trays/available'), api('/rentals?pageSize=20')]);
    const pkgs = pk.data || [], avail = av.data || [];
    state.cache = { pkgs, avail };
    const r = state.rent;
    if (!pkgs.find((p) => p.PackageId === r.packageId)) { r.packageId = pkgs.length ? pkgs[0].PackageId : null; r.count = 1; }
    let html = '<div class="page-intro rent-intro"><span class="overline">DỊCH VỤ TRANG TRẠI</span><h2>Chọn gói trồng nấm phù hợp</h2><p>Chọn loại nấm, số lượng khay và bắt đầu hành trình nuôi trồng của riêng bạn.</p></div><div class="section-title">Chọn gói thuê</div>'; 
    if (!pkgs.length) html += '<div class="empty">Hiện chưa có gói thuê nào.</div>';
    html += pkgs.map((p) => '<div class="card pkg ' + (p.PackageId === r.packageId ? 'sel' : '') + '" data-action="pick-pkg" data-id="' + p.PackageId + '">' +
      '<div class="row between"><span class="strong">' + esc(p.PackageName) + '</span><span class="price">' + fmtMoney(p.PricePerTray) + '<small class="muted"> /khay</small></span></div>' +
      '<div class="small muted">' + p.DurationDays + ' ngày · tối đa ' + p.MaxTrays + ' khay/đơn</div>' +
      (p.Description ? '<div class="small mt">' + esc(p.Description) + '</div>' : '') + '</div>').join('');

    if (pkgs.length) html += '<div id="rentForm">' + rentFormHtml() + '</div>';

    html += '<div class="section-title">Đơn thuê của tôi</div>';
    const rl = rentals.data || [];
    if (!rl.length) html += '<div class="card muted small">Bạn chưa có đơn thuê nào.</div>';
    else html += rl.map((x) => '<div class="card"><div class="row between"><span class="strong">Đơn #' + x.RentalId + ' · ' + esc(x.PackageName) + '</span>' +
      '<span class="chip ' + (x.Status === 'Active' ? '' : 'gray') + '">' + esc(RENTAL_VI[x.Status] || x.Status) + '</span></div>' +
      '<div class="small muted">' + fmtDate(x.StartDate) + ' → ' + fmtDate(x.EndDate) + ' · ' + x.TrayCount + ' khay · ' + fmtMoney(x.TotalAmount) + '</div>' +
      (x.TrayCodes ? '<div class="small">Khay: ' + esc(x.TrayCodes) + '</div>' : '') + '</div>').join('');
    return html;
  }

  function rentFormHtml() {
    const { pkgs, avail } = state.cache;
    const r = state.rent;
    const pkg = pkgs.find((p) => p.PackageId === r.packageId);
    if (!pkg) return '';
    const combo = r.combo !== '' ? avail[Number(r.combo)] : null;
    const totalAvail = avail.reduce((s, a) => s + a.AvailableTrays, 0);
    const maxCount = Math.max(0, Math.min(pkg.MaxTrays, combo ? combo.AvailableTrays : Math.max(0, ...avail.map(a => a.AvailableTrays))));
    if (r.count > maxCount) r.count = Math.max(1, maxCount);
    if (r.count < 1) r.count = 1;
    return '<div class="section-title">Thông tin thuê</div><div class="card">' +
      '<label class="field"><span>Phòng / loại nấm</span><select id="comboSel" data-action="pick-combo">' +
      '<option value="">Tự động chọn (còn ' + totalAvail + ' khay trống)</option>' +
      avail.map((a, i) => '<option value="' + i + '"' + (String(i) === String(r.combo) ? ' selected' : '') + '>' + esc(a.RoomName) + ' – ' + esc(a.TypeName || 'Chưa chọn loại') + ' (còn ' + a.AvailableTrays + ')</option>').join('') + '</select></label>' +
      '<div class="row between"><span>Số khay</span><div class="stepper"><button type="button" data-action="count" data-d="-1">−</button><b>' + r.count + '</b><button type="button" data-action="count" data-d="1">+</button></div></div>' +
      '<div class="small muted right">Tối đa ' + maxCount + ' khay</div>' +
      '<div class="section-title" style="margin-top:12px">Thanh toán</div><div class="pay-grid">' +
      Object.keys(PAY_VI).filter((k) => k !== 'Cash').map((k) => '<label><input type="radio" name="pay" value="' + k + '" data-action="pick-pay"' + (r.method === k ? ' checked' : '') + '>' + PAY_VI[k] + '</label>').join('') + '</div>' +
      '<hr class="sep"><div class="row between"><span class="muted">Tạm tính (' + r.count + ' × ' + fmtMoney(pkg.PricePerTray) + ')</span><span class="total">' + fmtMoney(pkg.PricePerTray * r.count) + '</span></div>' +
      '<button class="btn block mt" data-action="rent-submit"' + (maxCount < 1 ? ' disabled' : '') + '>' + (maxCount < 1 ? 'Hết khay trống' : 'Thuê ngay') + '</button>' +
      '<div class="small muted center mt">Thanh toán được giả lập, thành công ngay sau khi xác nhận.</div></div>';
  }

  function refreshRentForm() { const f = $('#rentForm'); if (f) f.innerHTML = rentFormHtml(); }

  async function submitRent() {
    const { pkgs, avail } = state.cache;
    const r = state.rent;
    const pkg = pkgs.find((p) => p.PackageId === r.packageId);
    const combo = r.combo !== '' ? avail[Number(r.combo)] : null;
    if (!pkg || !Number.isInteger(r.count) || r.count<1 || r.count>pkg.MaxTrays || (combo && r.count>combo.AvailableTrays)) return toast('Số lượng khay không hợp lệ.',true);
    const ok = await confirmBox('Xác nhận thuê khay',
      'Gói <b>' + esc(pkg.PackageName) + '</b> · ' + r.count + ' khay<br>Thời hạn ' + pkg.DurationDays + ' ngày<br>Thanh toán ' + esc(PAY_VI[r.method]) + ': <b>' + fmtMoney(pkg.PricePerTray * r.count) + '</b>', 'Thanh toán');
    if (!ok) return;
    try {
      const res = await api('/rentals', { method: 'POST', body: {
        packageId: pkg.PackageId, trayCount: r.count, paymentMethod: r.method,
        roomId: combo ? combo.RoomId : undefined, mushroomTypeId: combo && combo.MushroomTypeId ? combo.MushroomTypeId : undefined } });
      const codes = (res.data.trays || []).map((t) => t.TrayCode).filter(Boolean);
      toast('Thuê thành công' + (codes.length ? ': ' + codes.join(', ') : '') + '!');
      state.rent.count = 1; state.rent.combo = '';
      refreshBadge();
      go('trays');
    } catch (e) { toast(e.message, true); }
  }

  // Màn hình: Thu hoạch & giao nhận 
  async function viewHarvest() {
    const r = await api('/my/harvests');
    const list = r.data || [];
    if (!list.length) return '<div class="empty"><span class="big">🧺</span>Chưa có đợt thu hoạch nào.<br>Khi nấm đến hạn, lịch thu hoạch sẽ hiện ở đây.</div>';
    const done = list.filter((h) => h.Status === 'Completed');
    const sched = list.filter((h) => h.Status === 'Scheduled');
    const kg = done.reduce((s, h) => s + Number(h.WeightKg || 0), 0);
    let html = '<div class="card row between"><div><div class="muted small">Tổng sản lượng đã thu</div><div class="total">' + kg.toFixed(2) + ' kg</div></div>' +
      '<div class="right"><div class="muted small">Số đợt</div><div class="total">' + done.length + '</div></div></div>';
    if (sched.length) html += '<div class="section-title">Sắp thu hoạch</div>' + sched.map(harvestCard).join('');
    if (done.length) html += '<div class="section-title">Đã thu hoạch</div>' + done.map(harvestCard).join('');
    return html;
  }

  function harvestCard(h) {
    const hasReq = h.DeliveryRequestId && h.DeliveryStatus && h.DeliveryStatus !== 'Cancelled';
    let act = '';
    if (h.Status === 'Completed' && !hasReq) act = '<button class="btn sm mt" data-action="deliver" data-id="' + h.HarvestId + '" data-w="' + esc(h.WeightKg) + '" data-code="' + esc(h.TrayCode) + '">Nhận nấm / giao tận nơi</button>';
    if (hasReq) act = '<div class="small mt"><span class="chip blue">' + (h.RequestType === 'Pickup' ? 'Nhận tại trại' : 'Giao tận nơi') + '</span> <span class="chip ' + (h.DeliveryStatus === 'Completed' ? '' : 'warn') + '">' + esc(DELIVERY_VI[h.DeliveryStatus] || h.DeliveryStatus) + '</span></div>' +
      (h.DeliveryStatus === 'Pending' ? '<button class="btn danger sm mt" data-action="cancel-delivery" data-id="' + h.DeliveryRequestId + '">Hủy yêu cầu</button>' : '');
    return '<div class="card"><div class="row between"><span class="strong">' + esc(h.TrayCode) + ' · ' + esc(h.TypeName || 'Nấm') + '</span>' +
      '<span class="chip ' + (h.Status === 'Completed' ? '' : 'gray') + '">' + esc(HARVEST_VI[h.Status] || h.Status) + '</span></div>' +
      (h.Status === 'Completed'
        ? '<div class="small">Thu ngày ' + fmtDate(h.HarvestedAt) + ' · <b>' + num(h.WeightKg, 2) + ' kg</b> · loại ' + esc(h.Quality || '–') + '</div>'
        : '<div class="small muted">Dự kiến ' + fmtDate(h.ScheduledDate) + '</div>') + act + '</div>';
  }

  function deliverModal(id, weight, code) {
    const addr = (state.user && state.user.Address) || '', phone = (state.user && state.user.Phone) || '';
    openModal('<h2>Nhận nấm khay ' + esc(code) + '</h2><p class="muted small">Khối lượng ' + esc(weight) + ' kg.</p><p class="error hidden" id="mErr"></p>' +
      '<div class="pay-grid" style="margin-bottom:12px"><label><input type="radio" name="rt" value="Pickup" checked>Nhận tại trại</label><label><input type="radio" name="rt" value="Delivery">Giao tận nơi (+30.000đ)</label></div>' +
      '<div id="delFields" class="hidden"><label class="field"><span>Địa chỉ giao (để trống = dùng địa chỉ trong hồ sơ)</span><input type="text" id="dAddr" value="' + esc(addr) + '"></label>' +
      '<label class="field"><span>Số điện thoại người nhận</span><input type="tel" id="dPhone" value="' + esc(phone) + '"></label></div>' +
      '<label class="field"><span>Ngày mong muốn</span><input type="date" id="dDate" min="' + todayIso() + '"></label>' +
      '<div class="actions"><button class="btn ghost" data-action="close">Hủy</button><button class="btn" id="mOk">Gửi yêu cầu</button></div>');
    $$('input[name=rt]').forEach((i) => { i.onchange = () => $('#delFields').classList.toggle('hidden', $('input[name=rt]:checked').value !== 'Delivery'); });
    $('#mOk').onclick = async () => {
      const type = $('input[name=rt]:checked').value;
      const body = { harvestId: Number(id), requestType: type, preferredDate: $('#dDate').value || undefined };
      if (type === 'Delivery') { body.address = $('#dAddr').value.trim() || undefined; body.receiverPhone = $('#dPhone').value.trim() || undefined; }
      $('#mOk').disabled = true;
      try { await api('/deliveries', { method: 'POST', body }); closeModal(); toast('Đã gửi yêu cầu'); loadTab(); }
      catch (e) { showErr(e.message); $('#mOk').disabled = false; }
    };
  }

  // Màn hình: Thông báo 
  async function viewNotif() {
    const [n, prefs] = await Promise.all([api('/notifications?pageSize=50'), api('/notifications/preferences').catch(() => ({ data: [] }))]);
    setBadge(n.unreadCount || 0);
    const list = n.data || [];
    let html = '<div class="page-intro notif-intro"><span class="overline">TRUNG TÂM THÔNG BÁO</span><h2>Luôn nắm bắt tình hình</h2><p>Thông tin tiến độ, môi trường và lịch thu hoạch mới nhất.</p></div><div class="row between"><div class="section-title" style="margin:0">Gần đây</div>' +
      (n.unreadCount ? '<button class="btn ghost sm" data-action="read-all">Đọc tất cả (' + n.unreadCount + ')</button>' : '') + '</div><div style="height:8px"></div>';
    if (!list.length) html += '<div class="empty"><span class="big">🔔</span>Chưa có thông báo nào.</div>';
    html += list.map((x) => {
      const t = NOTIF[x.Type] || { ico: '📢' };
      return '<div class="card notif ' + (x.IsRead ? '' : 'unread') + '" data-action="read-notif" data-id="' + x.NotificationId + '" data-tray="' + esc(x.TrayId || '') + '">' +
        '<div class="ico">' + t.ico + '</div><div class="grow"><div class="strong">' + esc(x.Title) + '</div><div class="small">' + esc(x.Content) + '</div>' +
        '<div class="small muted">' + fmtDateTime(x.CreatedAt) + '</div></div><button class="del" data-action="del-notif" data-id="' + x.NotificationId + '" aria-label="Xóa">✕</button></div>';
    }).join('');
    const pl = prefs.data || [];
    if (pl.length) html += '<div class="section-title">Loại thông báo muốn nhận</div><div class="card">' + pl.map((p) =>
      '<div class="switch-row"><div><div>' + esc(p.DisplayName || (NOTIF[p.Type] || {}).name || p.Type) + '</div>' +
      (p.SystemEnabled ? '' : '<div class="small muted">Quản trị viên đã tắt loại này</div>') + '</div>' +
      '<label class="toggle"><input type="checkbox" data-action="pref" data-type="' + esc(p.Type) + '"' + (p.UserEnabled ? ' checked' : '') + (p.SystemEnabled ? '' : ' disabled') + '><i></i></label></div>').join('') + '</div>';
    return html;
  }

  //  Màn hình: Tài khoản 
  async function viewMe() {
    const [me, tx] = await Promise.all([api('/auth/me'), api('/my/transactions?pageSize=10').catch(() => ({ data: [] }))]);
    const u = state.user = me.data;
    let html = '<div class="page-intro account-intro"><span class="overline">HỒ SƠ CÁ NHÂN</span><h2>Tài khoản của tôi</h2><p>Thông tin, bảo mật và giao dịch của bạn.</p></div><div class="card row"><div style="font-size:38px">🧑‍🌾</div><div class="grow"><div class="strong" style="font-size:17px">' + esc(u.FullName) + '</div>' +
      '<div class="small muted">' + esc(u.Email) + '</div></div></div>' +
      '<div class="section-title">Thông tin cá nhân</div><form class="card" id="profileForm">' +
      '<label class="field"><span>Họ và tên</span><input type="text" name="fullName" value="' + esc(u.FullName) + '" required></label>' +
      '<label class="field"><span>Số điện thoại</span><input type="tel" name="phone" value="' + esc(u.Phone || '') + '"></label>' +
      '<label class="field"><span>Địa chỉ nhận hàng</span><input type="text" name="address" value="' + esc(u.Address || '') + '"></label>' +
      '<button class="btn block" type="submit">Lưu thay đổi</button></form>' +
      '<div class="section-title">Đổi mật khẩu</div><form class="card" id="pwForm">' +
      '<label class="field"><span>Mật khẩu hiện tại</span><input type="password" name="cur" autocomplete="current-password" required></label>' +
      '<label class="field"><span>Mật khẩu mới (tối thiểu 6 ký tự)</span><input type="password" name="nw" autocomplete="new-password" minlength="6" required></label>' +
      '<button class="btn ghost block" type="submit">Đổi mật khẩu</button></form>' +
      '<div class="section-title">Lịch sử thanh toán</div>';
    const rows = tx.data || [];
    if (!rows.length) html += '<div class="card muted small">Chưa có giao dịch.</div>';
    else html += '<div class="card">' + rows.map((p) => '<div class="switch-row"><div><div class="strong">' + esc(p.PackageName) + ' · ' + p.TrayCount + ' khay</div>' +
      '<div class="small muted">' + fmtDateTime(p.PaidAt) + ' · ' + esc(PAY_VI[p.Method] || p.Method) + '</div></div>' +
      '<div class="right"><div class="strong">' + fmtMoney(p.Amount) + '</div><div class="small muted">' + esc(PAY_STATUS_VI[p.Status] || p.Status) + '</div></div></div>').join('') + '</div>';
    html += '<button class="btn danger block mt" data-action="logout">Đăng xuất</button>' +
      '<div class="small muted center mt">' + (state.demo ? 'Chế độ demo (dữ liệu giả)' : 'Máy chủ: ' + esc(state.api)) + '</div>';
    return html;
  }

  function afterRender() {
    if (state.detail) drawChart();
    const pf = $('#profileForm');
    if (pf) pf.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(pf);
      try {
        const r = await api('/auth/me', { method: 'PUT', body: { fullName: f.get('fullName'), phone: f.get('phone'), address: f.get('address') } });
        state.user = r.data || state.user; toast('Đã lưu thông tin');
      } catch (ex) { toast(ex.message, true); }
    };
    const pw = $('#pwForm');
    if (pw) pw.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(pw);
      try { await api('/auth/me/password', { method: 'PUT', body: { currentPassword: f.get('cur'), newPassword: f.get('nw') } }); pw.reset(); toast('Đã đổi mật khẩu'); }
      catch (ex) { toast(ex.message, true); }
    };
  }

  // ---------- Xử lý bấm / nhập ----------
  function bindGlobal() {
    document.addEventListener('click', async (e) => {
      const tabBtn = e.target.closest('#tabbar button');
      if (tabBtn) return go(tabBtn.dataset.tab);
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const a = el.dataset.action;
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return;   // xử lý ở sự kiện change
      if (a === 'del-notif') e.stopPropagation();
      switch (a) {
        case 'back': state.detail = null; return go();
        case 'refresh': return loadTab();
        case 'goto': return go(el.dataset.tab);
        case 'close': return closeModal();
        case 'logout': if (await confirmBox('Đăng xuất', 'Bạn muốn đăng xuất khỏi tài khoản?', 'Đăng xuất')) logout(); return;
        case 'auth-switch': state.authMode = state.authMode === 'login' ? 'register' : 'login'; return showAuth();
        case 'save-api': {
          const v = $('#apiUrl').value.trim().replace(/\/+$/, '');
          if (!/^https?:\/\//i.test(v)) return toast('Địa chỉ phải bắt đầu bằng http:// hoặc https://', true);
          state.api = v; store.set('api', v); return toast('Đã lưu địa chỉ API');
        }
        case 'open-tray': state.detail = { id: el.dataset.id }; return go();
        case 'chart-metric': state.chart.metric = el.dataset.m; $$('#metricSeg button').forEach((b) => b.classList.toggle('active', b === el)); return drawChart();
        case 'chart-range': state.chart.range = Number(el.dataset.h); $$('[data-action=chart-range]').forEach((b) => b.classList.toggle('active', b === el)); return drawChart();
        case 'link-tray': return linkTrayModal();
        case 'pick-pkg': state.rent.packageId = Number(el.dataset.id); state.rent.count = 1;
          $$('.pkg').forEach((c) => c.classList.toggle('sel', c === el)); return refreshRentForm();
        case 'count': state.rent.count += Number(el.dataset.d); return refreshRentForm();
        case 'rent-submit': return submitRent();
        case 'deliver': return deliverModal(el.dataset.id, el.dataset.w, el.dataset.code);
        case 'cancel-delivery':
          if (!(await confirmBox('Hủy yêu cầu', 'Bạn chắc chắn muốn hủy yêu cầu nhận / giao nấm này?', 'Hủy yêu cầu'))) return;
          try { await api('/deliveries/' + el.dataset.id + '/cancel', { method: 'PATCH' }); toast('Đã hủy yêu cầu'); loadTab(); } catch (ex) { toast(ex.message, true); } return;
        case 'read-all': try { await api('/notifications/read-all', { method: 'PATCH' }); loadTab(true); } catch (ex) { toast(ex.message, true); } return;
        case 'read-notif':
          try { if (el.classList.contains('unread')) { await api('/notifications/' + el.dataset.id + '/read', { method: 'PATCH' }); el.classList.remove('unread'); setBadge(Math.max(0, state.unread - 1)); } } catch (ex) { /* bỏ qua */ }
          if (el.dataset.tray) { state.detail = { id: el.dataset.tray }; go(); }
          return;
        case 'del-notif':
          try { await api('/notifications/' + el.dataset.id, { method: 'DELETE' }); loadTab(true); } catch (ex) { toast(ex.message, true); } return;
        default: return;
      }
    });

    document.addEventListener('change', async (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'pick-combo') { state.rent.combo = el.value; state.rent.count = 1; refreshRentForm(); }
      else if (el.dataset.action === 'pick-pay') { state.rent.method = el.value; }
      else if (el.dataset.action === 'pref') {
        try { await api('/notifications/preferences', { method: 'PUT', body: { type: el.dataset.type, isEnabled: el.checked } }); toast('Đã cập nhật'); }
        catch (ex) { el.checked = !el.checked; toast(ex.message, true); }
      }
    });
  }

  boot();
})();
