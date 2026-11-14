export const labels = {
  Admin: 'Quản trị viên',
  Operator: 'Nhân viên vận hành',
  Customer: 'Khách hàng',
  Available: 'Còn trống',
  Rented: 'Đã cho thuê',
  Growing: 'Đang trồng',
  ReadyToHarvest: 'Chờ thu hoạch',
  Harvested: 'Đã thu hoạch',
  Maintenance: 'Bảo trì',
  Inoculation: 'Cấy giống',
  Incubation: 'Ủ tơ',
  Pinning: 'Ra nụ',
  Fruiting: 'Phát triển quả thể',
  Harvest: 'Sẵn sàng thu hoạch',
  Active: 'Đang hoạt động',
  Inactive: 'Ngừng hoạt động',
  Pending: 'Chờ xử lý',
  Confirmed: 'Đã xác nhận',
  Shipping: 'Đang giao',
  Completed: 'Hoàn tất',
  Cancelled: 'Đã hủy',
  Scheduled: 'Đã lên lịch',
  Open: 'Mới',
  Acknowledged: 'Đã tiếp nhận',
  Resolved: 'Đã xử lý',
  Warning: 'Cảnh báo',
  Critical: 'Nghiêm trọng',
  Online: 'Trực tuyến',
  Offline: 'Ngoại tuyến',
  Error: 'Lỗi',
  Sensor: 'Cảm biến',
  MistSprayer: 'Phun sương',
  Fan: 'Quạt',
  Heater: 'Sưởi',
  GrowLight: 'Đèn trồng',
  Camera: 'Camera',
  Temperature: 'Nhiệt độ',
  Humidity: 'Độ ẩm',
  CO2: 'CO₂',
  Normal: 'Bình thường',
  Low: 'Thấp',
  High: 'Cao',
  Pickup: 'Nhận tại trại',
  Delivery: 'Giao tận nơi',
  ON: 'Bật',
  OFF: 'Tắt',
  Manual: 'Thủ công',
  Auto: 'Tự động',
  Sent: 'Đã gửi',
  Executed: 'Đã thực thi (theo hệ thống)',
  Failed: 'Thất bại',
  Alert: 'Cảnh báo môi trường',
  Progress: 'Tiến độ',
  HarvestReady: 'Sẵn sàng thu hoạch',
  Rental: 'Thuê khay',
  System: 'Hệ thống',
  Paid: 'Đã thanh toán',
};
export const deliveryNext = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipping', 'Completed', 'Cancelled'],
  Shipping: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};
export const stages = [
  'Inoculation',
  'Incubation',
  'Pinning',
  'Fruiting',
  'Harvest',
];
export const actuators = ['MistSprayer', 'Fan', 'Heater', 'GrowLight'];
export const text = (v) =>
  v == null || v === ''
    ? '—'
    : typeof v === 'boolean'
      ? v
        ? 'Có'
        : 'Không'
      : labels[v] || String(v);
export const vnd = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(v);
export const date = (v) =>
  v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—';
export const timestamp = (v) =>
  v && !Number.isNaN(Date.parse(v))
    ? new Date(v).toLocaleString('vi-VN')
    : 'Chưa có dữ liệu';
export function query(path, values) {
  const params = new URLSearchParams(
    Object.entries(values).filter(([, v]) => v !== '' && v != null),
  );
  return path + (params.size ? '?' + params : '');
}
export function readingState(recordedAt, now = Date.now()) {
  if (!recordedAt || Number.isNaN(Date.parse(recordedAt)))
    return 'Chưa có dữ liệu';
  return now - Date.parse(recordedAt) > 5 * 60000
    ? 'Dữ liệu cũ (>5 phút)'
    : 'Dữ liệu gần đây';
}
export function validate(fields, values) {
  const errors = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.required && !String(value ?? '').trim())
      errors[field.name] = 'Thông tin bắt buộc.';
    else if (value !== '' && value != null) {
      if (
        field.type === 'number' &&
        (!Number.isFinite(Number(value)) ||
          (field.integer && !Number.isInteger(Number(value))) ||
          (field.min != null && Number(value) < field.min) ||
          (field.max != null && Number(value) > field.max))
      )
        errors[field.name] =
          'Giá trị số không hợp lệ hoặc ngoài khoảng cho phép.';
      if (
        field.type === 'number' &&
        field.step === '0.01' &&
        Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) >
          0.000001
      )
        errors[field.name] = 'Chỉ nhập tối đa hai chữ số thập phân.';
      if (
        field.options &&
        !field.options.some((o) => String(o.value) === String(value))
      )
        errors[field.name] = 'Lựa chọn không hợp lệ.';
      if (field.type === 'password' && String(value).length < 6)
        errors[field.name] = 'Mật khẩu cần ít nhất 6 ký tự.';
      if (field.type === 'url') {
        try {
          if (!['http:', 'https:'].includes(new URL(value).protocol))
            throw new Error();
        } catch {
          errors[field.name] = 'URL phải bắt đầu bằng http:// hoặc https://.';
        }
      }
    }
  }
  return errors;
}
export function formBody(fields, values) {
  return Object.fromEntries(
    fields
      .filter((f) => !(f.omitEmpty && values[f.name] === ''))
      .map((f) => [
        f.name,
        f.type === 'checkbox'
          ? Boolean(values[f.name])
          : values[f.name] === ''
            ? null
            : f.type === 'number'
              ? Number(values[f.name])
              : f.type === 'password'
                ? values[f.name]
                : String(values[f.name] ?? '').trim(),
      ]),
  );
}
