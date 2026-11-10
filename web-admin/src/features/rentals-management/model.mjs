export const RENTAL_STATUSES = { Pending: 'Chờ xử lý', Active: 'Đang thuê', Completed: 'Đã kết thúc', Cancelled: 'Đã hủy' };
export const PAYMENT_METHODS = { Cash: 'Tiền mặt', BankTransfer: 'Chuyển khoản', EWallet: 'Ví điện tử', Card: 'Thẻ' };
export const PAYMENT_STATUSES = { Pending: 'Chờ thanh toán', Paid: 'Đã thanh toán', Failed: 'Thất bại', Refunded: 'Đã hoàn tiền' };
export const TRAY_STATUSES = { Available: 'Còn trống', Rented: 'Đã cho thuê', Growing: 'Đang trồng', ReadyToHarvest: 'Chờ thu hoạch', Harvested: 'Đã thu hoạch', Maintenance: 'Bảo trì' };

export function positiveId(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !/^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 2147483647 ? number : null;
}

export function rentalIdentity(user) {
  return { id: positiveId(user?.id ?? user?.UserId), role: user?.role ?? user?.Role ?? '' };
}

export function canManageRentals(user) {
  const { id, role } = rentalIdentity(user);
  return id !== null && ['Admin', 'Operator'].includes(role);
}

export function rentalsPath({ page = 1, pageSize = 10, status = '', customerId = '' } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) query.set('status', status);
  if (customerId) query.set('customerId', String(customerId));
  return `/rentals?${query}`;
}

export function customersPath({ q = '', page = 1, activeOnly = false } = {}) {
  const query = new URLSearchParams({ role: 'Customer', page: String(page), pageSize: '10' });
  if (activeOnly) query.set('status', 'Active');
  if (q.trim()) query.set('q', q.trim());
  return `/users?${query}`;
}

export function money(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—'
    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value));
}

/** SQL DATE is a calendar date: do not shift midnight according to browser timezone. */
export function calendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

export function validateAssignment({ customer, packageId, trayCode, paymentMethod }, packages, trays) {
  const errors = {};
  if (!positiveId(customer?.UserId) || customer.Role !== 'Customer' || customer.Status !== 'Active' || customer.IsDeleted) {
    errors.customer = 'Vui lòng chọn khách hàng đang hoạt động.';
  }
  if (!positiveId(packageId) || !packages.some((item) => Number(item.PackageId) === Number(packageId) && item.IsActive)) {
    errors.packageId = 'Vui lòng chọn gói thuê đang áp dụng.';
  }
  const code = String(trayCode || '').trim().toUpperCase();
  if (!code || code.length > 20 || !trays.some((item) => item.TrayCode === code && item.Status === 'Available')) {
    errors.trayCode = 'Vui lòng chọn mã khay còn trống trong danh sách mới nhất.';
  }
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, paymentMethod)) errors.paymentMethod = 'Phương thức thanh toán không hợp lệ.';
  return errors;
}

export function assignmentBody({ customer, packageId, trayCode, paymentMethod }) {
  return { customerId: Number(customer.UserId), packageId: Number(packageId), trayCode: trayCode.trim().toUpperCase(), paymentMethod };
}
