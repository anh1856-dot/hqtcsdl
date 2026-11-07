import React, { useState } from 'react';
import { useBasicManagement } from './BasicManagementProvider.jsx';
import { useList } from './hooks.js';
import { Badge, ConfirmDialog, DataTable, EntityDialog, NoAccess, Notice, PageFrame } from './components.jsx';
import { buildUsersPath, ROLE_LABELS, ROLE_OPTIONS, USER_STATUS_LABELS } from './model.mjs';

const passwordField = { name: 'password', label: 'Mật khẩu ban đầu', type: 'password', required: true, wide: true, hint: 'Ít nhất 6 ký tự. Chỉ dùng để tạo tài khoản này.' };
function userFields(row, self) {
  return [
    { name: 'fullName', source: 'FullName', label: 'Họ tên', required: true, maxLength: 100 },
    { name: 'email', source: 'Email', label: 'Email', type: 'email', required: true, maxLength: 100, createOnly: true, readOnly: Boolean(row), hint: row ? 'API không hỗ trợ đổi email.' : undefined },
    { name: 'role', source: 'Role', label: 'Vai trò', required: true, defaultValue: 'Customer', options: ROLE_OPTIONS, readOnly: self, hint: self ? 'Không thể tự hạ quyền của chính mình.' : undefined },
    { name: 'phone', source: 'Phone', label: 'Số điện thoại', type: 'tel', maxLength: 15 },
    { name: 'address', source: 'Address', label: 'Địa chỉ', type: 'textarea', maxLength: 255, wide: true },
    ...(!row ? [passwordField] : []),
  ];
}

const columns = [
  { key: 'FullName', label: 'Tài khoản', render: (row) => <><strong>{row.FullName}</strong><span className="bm-cell-secondary">{row.Email}</span></> },
  { key: 'Role', label: 'Vai trò', render: (row) => ROLE_LABELS[row.Role] || row.Role },
  { key: 'Phone', label: 'Số điện thoại' },
  { key: 'Status', label: 'Trạng thái', render: (row) => <Badge tone={row.Status === 'Active' ? 'green' : 'neutral'}>{USER_STATUS_LABELS[row.Status] || row.Status}</Badge> },
];

export function UsersPage() {
  const { role, userId } = useBasicManagement();
  const allowed = role === 'Admin' && userId != null;
  const [query, setQuery] = useState({ q: '', role: '', status: '', page: 1, pageSize: 10 });
  const [searchDraft, setSearchDraft] = useState('');
  const list = useList(buildUsersPath(query), allowed);
  const [dialog, setDialog] = useState(null);
  const [success, setSuccess] = useState('');
  const rows = list.data?.data || [];
  const pagination = list.data?.pagination;
  const total = pagination?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
  function changeFilter(key, value) { setQuery((old) => ({ ...old, [key]: value, page: 1 })); }
  function open(value) { setSuccess(''); setDialog(value); }
  function saved(message) {
    setDialog(null); setSuccess(message);
    // Deleting/locking the last matching row may empty the current page.
    if (query.page > 1) setQuery((old) => ({ ...old, page: 1 }));
    else list.reload();
  }
  const self = dialog?.row && String(dialog.row.UserId) === String(userId);
  return <PageFrame title="Quản lý tài khoản" description="Quản lý thông tin, vai trò và quyền truy cập của người dùng."
    action={allowed && <button className="bm-button bm-button-primary" onClick={() => open({ type: 'edit' })}><span aria-hidden="true">＋</span> Thêm tài khoản</button>}>
    {!allowed ? <NoAccess /> : <>
      <Notice success={success} /><Notice error={list.error} retry={list.reload} />
      <div className="bm-panel">
        <div className="bm-toolbar bm-toolbar-users">
          <form className="bm-search-form" onSubmit={(event) => { event.preventDefault(); changeFilter('q', searchDraft); }}>
            <label className="bm-search"><span>Tìm kiếm tài khoản</span><input type="search" placeholder="Tên, email hoặc số điện thoại…"
              value={searchDraft} onChange={(event) => { const value = event.target.value; setSearchDraft(value); changeFilter('q', value); }} /></label>
          </form>
          <label className="bm-filter"><span>Vai trò</span><select aria-label="Vai trò" value={query.role} onChange={(event) => changeFilter('role', event.target.value)}>
            <option value="">Tất cả vai trò</option>{ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="bm-filter"><span>Trạng thái</span><select aria-label="Trạng thái" value={query.status} onChange={(event) => changeFilter('status', event.target.value)}>
            <option value="">Tất cả trạng thái</option><option value="Active">Đang hoạt động</option><option value="Disabled">Đã khóa</option></select></label>
          <button className="bm-button" disabled={list.loading} onClick={list.reload}>Làm mới</button>
        </div>
        {list.data && <p className="bm-list-count">{total} tài khoản phù hợp</p>}
        <DataTable columns={columns} rows={rows} rowKey="UserId" loading={list.loading} error={list.error}
          emptyText="Không có tài khoản phù hợp. Hãy thử thay đổi từ khóa hoặc bộ lọc."
          actions={(row) => <>
            <button className="bm-link-button" aria-label={`Sửa ${row.FullName}`} onClick={() => open({ type: 'edit', row })}>Sửa</button>
            <button className="bm-link-button" aria-label={`Đặt lại mật khẩu ${row.FullName}`} onClick={() => open({ type: 'password', row })}>Đặt lại mật khẩu</button>
            {String(row.UserId) !== String(userId) && <>
              <button className="bm-link-button" aria-label={`${row.Status === 'Active' ? 'Khóa' : 'Mở khóa'} ${row.FullName}`}
                onClick={() => open({ type: 'status', row })}>{row.Status === 'Active' ? 'Khóa' : 'Mở khóa'}</button>
              <button className="bm-link-button bm-text-danger" aria-label={`Xóa mềm ${row.FullName}`} onClick={() => open({ type: 'delete', row })}>Xóa mềm</button>
            </>}
          </>} />
        {list.data && <div className="bm-pagination">
          <label>Hiển thị <select aria-label="Số tài khoản mỗi trang" value={query.pageSize} onChange={(event) => changeFilter('pageSize', Number(event.target.value))}>
            {[10, 20, 50].map((value) => <option key={value} value={value}>{value}</option>)}</select> / trang</label>
          <span>Trang {query.page}{total > 0 ? ` / ${lastPage}` : ''}</span>
          <div className="bm-row-actions"><button className="bm-button bm-button-small" disabled={query.page <= 1 || list.loading}
            onClick={() => setQuery((old) => ({ ...old, page: old.page - 1 }))}>Trước</button>
            <button className="bm-button bm-button-small" disabled={query.page >= lastPage || list.loading}
              onClick={() => setQuery((old) => ({ ...old, page: old.page + 1 }))}>Sau</button></div>
        </div>}
      </div>
      {dialog?.type === 'edit' && <EntityDialog key={dialog.row?.UserId || 'new'} title={dialog.row ? 'Sửa tài khoản' : 'Thêm tài khoản'}
        fields={userFields(dialog.row, self)} row={dialog.row} confirmRoleChange
        endpoint={dialog.row ? `/users/${dialog.row.UserId}` : '/users'} method={dialog.row ? 'PUT' : 'POST'}
        onClose={() => setDialog(null)} onSaved={() => saved(dialog.row ? 'Đã cập nhật tài khoản.' : 'Đã thêm tài khoản.')} />}
      {dialog?.type === 'password' && <EntityDialog title="Đặt lại mật khẩu" key={`password-${dialog.row.UserId}`}
        fields={[{ name: 'newPassword', label: 'Mật khẩu mới', type: 'password', required: true, wide: true, hint: 'Ít nhất 6 ký tự.' }]}
        note={`Bạn đang đặt lại mật khẩu cho “${dialog.row.FullName}”. Bấm Lưu thay đổi để xác nhận.`}
        endpoint={`/users/${dialog.row.UserId}/password`} method="PUT" onClose={() => setDialog(null)}
        onSaved={() => saved('Đã đặt lại mật khẩu.')} />}
      {dialog?.type === 'status' && <ConfirmDialog title={dialog.row.Status === 'Active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        message={`${dialog.row.Status === 'Active' ? 'Khóa' : 'Mở khóa'} tài khoản “${dialog.row.FullName}” (${dialog.row.Email})?`}
        endpoint={`/users/${dialog.row.UserId}/status`} method="PATCH" body={{ status: dialog.row.Status === 'Active' ? 'Disabled' : 'Active' }}
        confirmLabel={dialog.row.Status === 'Active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} dangerous={dialog.row.Status === 'Active'}
        onClose={() => setDialog(null)} onSaved={() => saved('Đã cập nhật trạng thái tài khoản.')} />}
      {dialog?.type === 'delete' && <ConfirmDialog title="Xóa mềm tài khoản" message={`Xóa mềm tài khoản “${dialog.row.FullName}”? Tài khoản sẽ mất quyền truy cập; lịch sử thuê và thanh toán vẫn được giữ lại.`}
        endpoint={`/users/${dialog.row.UserId}`} confirmLabel="Xóa mềm tài khoản" onClose={() => setDialog(null)} onSaved={() => saved('Đã xóa mềm tài khoản.')} />}
    </>}
  </PageFrame>;
}
