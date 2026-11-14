import React, { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../shared/session.jsx';
import { Notice, Page, Sheet, useActions } from '../shared/Workbench.jsx';
import { timestamp } from '../shared/model.mjs';

export function Login() {
  const session = useSession();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  if (session.user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="wa-login">
      <section>
        <p className="wa-eyebrow">MUSHROOM FARM</p>
        <h1>Chào mừng trở lại</h1>
        <p>Đăng nhập để quản lý hoạt động trang trại.</p>
        <Notice error={error || session.error} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (gate.current) return;
            const form = e.currentTarget;
            const email = form.email.value.trim(),
              password = form.password.value;
            gate.current = true;
            setBusy(true);
            setError(null);
            try {
              await session.login(email, password);
              form.reset();
            } catch (failure) {
              setError(failure);
            } finally {
              gate.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="wa-primary" type="submit">
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </fieldset>
        </form>
        <p className="wa-muted">
          Dành cho quản trị viên và nhân viên vận hành. Liên hệ quản trị viên
          nếu tài khoản bị khóa.
        </p>
      </section>
    </main>
  );
}
export function Profile() {
  const { user, setUser } = useSession();
  const actions = useActions((response) => {
    if (response.data?.UserId) setUser(response.data);
  });
  return (
    <Page
      title="Hồ sơ của tôi"
      description="Thông tin tài khoản và bảo mật phiên đăng nhập."
      actions={
        <>
          <button
            onClick={() =>
              actions.open({
                title: 'Cập nhật hồ sơ',
                path: '/auth/me',
                method: 'PUT',
                fields: [
                  {
                    name: 'fullName',
                    label: 'Họ tên',
                    initial: user.FullName,
                    required: true,
                    maxLength: 100,
                  },
                  {
                    name: 'phone',
                    label: 'Số điện thoại',
                    initial: user.Phone || '',
                    maxLength: 15,
                  },
                  {
                    name: 'address',
                    label: 'Địa chỉ',
                    initial: user.Address || '',
                    maxLength: 255,
                  },
                  {
                    name: 'avatarUrl',
                    label: 'URL ảnh đại diện',
                    type: 'url',
                    initial: user.AvatarUrl || '',
                    maxLength: 500,
                  },
                ],
              })
            }
          >
            Sửa hồ sơ
          </button>
          <button
            onClick={() =>
              actions.open({
                title: 'Đổi mật khẩu',
                path: '/auth/me/password',
                method: 'PUT',
                fields: [
                  {
                    name: 'currentPassword',
                    label: 'Mật khẩu hiện tại',
                    type: 'password',
                    required: true,
                  },
                  {
                    name: 'newPassword',
                    label: 'Mật khẩu mới',
                    type: 'password',
                    required: true,
                  },
                ],
              })
            }
          >
            Đổi mật khẩu
          </button>
        </>
      }
    >
      <Notice success={actions.success} />
      <div className="wa-card">
        <Sheet
          record={user}
          fields={[
            ['FullName', 'Họ tên'],
            ['Email', 'Email'],
            ['Phone', 'Điện thoại'],
            ['Address', 'Địa chỉ'],
            ['Role', 'Vai trò'],
            ['LastLoginAt', 'Đăng nhập gần nhất', timestamp],
          ]}
        />
      </div>
      {actions.dialog}
    </Page>
  );
}
