export const ROLE_LABELS = { Admin: 'Quản trị viên', Operator: 'Nhân viên vận hành', Customer: 'Khách hàng' };
export const USER_STATUS_LABELS = { Active: 'Đang hoạt động', Disabled: 'Đã khóa' };
export const ROOM_STATUS_LABELS = { Active: 'Đang hoạt động', Maintenance: 'Bảo trì', Inactive: 'Ngừng hoạt động' };
export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
export const ROOM_STATUS_OPTIONS = Object.entries(ROOM_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export const formatMoney = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(Number(value));
export const formatNumber = (value) => value === null || value === undefined
  ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value));

export function validateFields(fields, values) {
  const errors = {};
  for (const field of fields) {
    const raw = values[field.name] ?? '';
    const text = String(raw).trim();
    if (field.required && !text) { errors[field.name] = 'Vui lòng nhập thông tin này.'; continue; }
    if (!text) continue;
    if (field.maxLength && String(raw).length > field.maxLength) errors[field.name] = `Tối đa ${field.maxLength} ký tự.`;
    if (field.type === 'number') {
      const number = Number(raw);
      if (!Number.isFinite(number) || (field.integer && !Number.isInteger(number))) {
        errors[field.name] = field.integer ? 'Vui lòng nhập số nguyên.' : 'Vui lòng nhập số hợp lệ.';
      } else if (field.min !== undefined && number < field.min) errors[field.name] = `Giá trị phải từ ${field.min} trở lên.`;
      else if (field.max !== undefined && number > field.max) errors[field.name] = `Giá trị tối đa là ${field.max}.`;
      else if (field.step === '0.01' && Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) {
        errors[field.name] = 'Chỉ nhập tối đa 2 chữ số thập phân.';
      }
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) errors[field.name] = 'Email không hợp lệ.';
    if (field.type === 'url') {
      try { if (!['http:', 'https:'].includes(new URL(text).protocol)) throw new Error(); }
      catch { errors[field.name] = 'Nhập URL bắt đầu bằng http:// hoặc https://.'; }
    }
    if (field.type === 'password' && String(raw).length < 6) errors[field.name] = 'Mật khẩu phải có ít nhất 6 ký tự.';
    if (field.options && !field.options.some((option) => String(option.value) === String(raw))) {
      errors[field.name] = 'Vui lòng chọn một giá trị hợp lệ.';
    }
  }
  return errors;
}

export function initialValues(fields, row) {
  return Object.fromEntries(fields.map((field) => [field.name,
    row ? (row[field.source] ?? '') : (field.defaultValue ?? ''),
  ]));
}

/** Only include API-supported fields. Some backend PUTs use COALESCE, so cannot clear nulls. */
export function fieldPayload(fields, values, row) {
  return Object.fromEntries(fields.filter((field) => !(row && field.createOnly)).map((field) => {
    const raw = values[field.name];
    const value = field.type === 'password' ? raw : String(raw ?? '').trim();
    return [field.name, value === '' ? null : field.type === 'number' ? Number(value)
      : field.type === 'boolean' ? value === 'true' : value];
  }));
}

export function buildUsersPath({ q = '', role = '', status = '', page = 1, pageSize = 10 }) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q.trim()) params.set('q', q.trim());
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  return `/users?${params}`;
}
