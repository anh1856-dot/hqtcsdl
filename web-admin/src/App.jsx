import React, { useEffect, useState } from 'react';
import {
  HashRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import {
  BasicManagementProvider,
  MushroomTypesPage,
  RentalPackagesPage,
  RoomsPage,
  UsersPage,
} from './features/basic-management/index.js';
import {
  RentalsManagementProvider,
  RentalsManagementPage,
} from './features/rentals-management/index.js';
import './features/basic-management/styles.css';
import './features/rentals-management/styles.css';
import { SessionProvider, useSession } from './shared/session.jsx';
import { useQuery } from './shared/data.jsx';
import { Notice, Page } from './shared/Workbench.jsx';
import { Login, Profile } from './pages/Account.jsx';
import { Dashboard, Reports } from './pages/Overview.jsx';
import { Trays } from './pages/Trays.jsx';
import { Harvests, Deliveries } from './pages/Harvests.jsx';
import { Environment, Alerts } from './pages/Environment.jsx';
import { Devices } from './pages/Devices.jsx';
import { Notifications, Settings } from './pages/Notifications.jsx';

const menu = [
  ['dashboard', 'Tổng quan'],
  ['rooms', 'Phòng nuôi'],
  ['trays', 'Khay & canh tác'],
  ['rentals', 'Đơn thuê'],
  ['harvests', 'Thu hoạch'],
  ['deliveries', 'Giao nhận'],
  ['environment', 'Môi trường'],
  ['alerts', 'Cảnh báo'],
  ['devices', 'Thiết bị & camera'],
  ['mushroom-types', 'Loại nấm'],
  ['packages', 'Gói thuê'],
  ['users', 'Tài khoản', true],
  ['reports', 'Báo cáo', true],
  ['notifications', 'Thông báo'],
  ['settings', 'Cấu hình'],
  ['profile', 'Hồ sơ'],
];
function StaffArea() {
  const session = useSession();
  if (session.checking)
    return (
      <main className="wa-empty" role="status">
        Đang xác minh phiên đăng nhập…
      </main>
    );
  if (session.error && !session.user && session.error.status !== 401)
    return (
      <main className="wa-login">
        <section>
          <Notice error={session.error} retry={session.retry} />
          <button onClick={session.logout}>Về đăng nhập</button>
        </section>
      </main>
    );
  if (!session.user) return <Navigate to="/login" replace />;
  return (
    <BasicManagementProvider
      currentUser={session.user}
      apiClient={session.api}
      onUnauthorized={session.logout}
    >
      <RentalsManagementProvider
        currentUser={session.user}
        apiClient={session.api}
        onUnauthorized={session.logout}
      >
        <Layout />
      </RentalsManagementProvider>
    </BasicManagementProvider>
  );
}
function Layout() {
  const { user, logout } = useSession();
  const [expanded, setExpanded] = useState(false);
  const notices = useQuery('/notifications?page=1&pageSize=1', { poll: 30000 });
  useEffect(() => {
    const refresh = () => notices.reload();
    window.addEventListener('mushroom-notifications-changed', refresh);
    return () =>
      window.removeEventListener('mushroom-notifications-changed', refresh);
  }, [notices.reload]);
  return (
    <div className="wa-shell">
      <aside className={expanded ? 'wa-sidebar wa-nav-open' : 'wa-sidebar'}>
        <NavLink
          to="/dashboard"
          className="wa-brand"
          onClick={() => setExpanded(false)}
        >
          <span aria-hidden="true">◒</span>
          <div>
            MUSHROOM FARM<small>Quản trị trang trại</small>
          </div>
        </NavLink>
        <nav aria-label="Điều hướng chính">
          {menu
            .filter(([, , admin]) => !admin || user.Role === 'Admin')
            .map(([path, label]) => (
              <NavLink
                key={path}
                to={'/' + path}
                onClick={() => setExpanded(false)}
              >
                {label}
              </NavLink>
            ))}
        </nav>
        <div className="wa-sidebar-footer">
          {user.Role === 'Admin' ? 'Quản trị viên' : 'Nhân viên vận hành'}
        </div>
      </aside>
      <div className="wa-main">
        <header className="wa-topbar">
          <button
            className="wa-menu-button"
            aria-label="Mở hoặc đóng menu"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            ☰
          </button>
          <span>Hệ thống quản lý nuôi trồng nấm</span>
          <div className="wa-actions">
            <NavLink
              to="/notifications"
              aria-label={`Thông báo: ${notices.payload?.unreadCount ?? 'chưa tải'} chưa đọc`}
            >
              Thông báo{' '}
              {notices.payload ? (
                <b className="wa-badge">{notices.payload.unreadCount}</b>
              ) : (
                '—'
              )}
            </NavLink>
            <NavLink to="/profile">{user.FullName}</NavLink>
            <button onClick={logout}>Đăng xuất</button>
          </div>
        </header>
        <main className="wa-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
function AdminOnly({ children }) {
  return useSession().user.Role === 'Admin' ? (
    children
  ) : (
    <Page title="Không có quyền truy cập">
      <p role="alert">Chức năng này chỉ dành cho quản trị viên.</p>
    </Page>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <HashRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<StaffArea />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route
              path="reports"
              element={
                <AdminOnly>
                  <Reports />
                </AdminOnly>
              }
            />
            <Route path="mushroom-types" element={<MushroomTypesPage />} />
            <Route path="packages" element={<RentalPackagesPage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route
              path="users"
              element={
                <AdminOnly>
                  <UsersPage />
                </AdminOnly>
              }
            />
            <Route path="rentals" element={<RentalsManagementPage />} />
            <Route path="trays" element={<Trays />} />
            <Route path="harvests" element={<Harvests />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="environment" element={<Environment />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="devices" element={<Devices />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route
              path="*"
              element={
                <Page title="Không tìm thấy trang">
                  <NavLink to="/dashboard">Về tổng quan</NavLink>
                </Page>
              }
            />
          </Route>
        </Routes>
      </HashRouter>
    </SessionProvider>
  );
}
