import React from 'react';
import { Badge } from './components.jsx';
import { formatMoney, formatNumber, ROOM_STATUS_LABELS, ROOM_STATUS_OPTIONS } from './model.mjs';

const description = { name: 'description', source: 'Description', label: 'Mô tả', type: 'textarea', maxLength: 500, wide: true, keepWhenEmpty: true };
const positiveInteger = { type: 'number', integer: true, min: 1, max: 2147483647, step: '1', required: true };
const nameField = (name, source, label) => ({ name, source, label, required: true, maxLength: 100 });
const roomBadge = (row) => <Badge tone={row.Status === 'Active' ? 'green' : row.Status === 'Maintenance' ? 'amber' : 'neutral'}>
  {ROOM_STATUS_LABELS[row.Status] || row.Status}</Badge>;

export const mushroomDefinition = {
  title: 'Quản lý loại nấm', description: 'Danh mục giống nấm, thời gian sinh trưởng và sản lượng dự kiến.',
  singular: 'loại nấm', addLabel: 'Thêm loại nấm', endpoint: '/mushroom-types', rowKey: 'MushroomTypeId', nameKey: 'TypeName',
  searchPlaceholder: 'Tìm tên loại nấm…', searchKeys: ['TypeName', 'Description'],
  canView: (role) => ['Admin', 'Operator', 'Customer'].includes(role), canEdit: (role) => role === 'Admin',
  columns: [
    { key: 'TypeName', label: 'Tên loại nấm', render: (row) => <strong>{row.TypeName}</strong> },
    { key: 'GrowthDays', label: 'Sinh trưởng', render: (row) => `${formatNumber(row.GrowthDays)} ngày` },
    { key: 'ExpectedYieldKg', label: 'Sản lượng / khay', render: (row) => row.ExpectedYieldKg == null ? '—' : `${formatNumber(row.ExpectedYieldKg)} kg` },
    { key: 'Description', label: 'Mô tả' },
  ],
  fields: () => [
    nameField('typeName', 'TypeName', 'Tên loại nấm'),
    { ...positiveInteger, name: 'growthDays', source: 'GrowthDays', label: 'Số ngày sinh trưởng' },
    { name: 'expectedYieldKg', source: 'ExpectedYieldKg', label: 'Sản lượng dự kiến (kg/khay)', type: 'number', min: 0, max: 9999.99, step: '0.01', keepWhenEmpty: true },
    { name: 'imageUrl', source: 'ImageUrl', label: 'URL ảnh', type: 'url', maxLength: 500, keepWhenEmpty: true },
    description,
  ],
  deleteTitle: 'Xóa loại nấm', deleteLabel: 'Xóa loại nấm',
  deleteMessage: (row) => `Xóa loại nấm “${row.TypeName}”? Loại nấm đang được khay sử dụng sẽ không thể xóa.`,
};

export const packageDefinition = {
  title: 'Quản lý gói thuê', description: 'Thiết lập thời hạn và giá thuê. Giá mới áp dụng cho các đơn thuê mới.',
  singular: 'gói thuê', addLabel: 'Thêm gói thuê', endpoint: '/packages',
  listEndpoint: (role) => role === 'Admin' ? '/packages/all' : '/packages',
  rowKey: 'PackageId', nameKey: 'PackageName', searchPlaceholder: 'Tìm tên gói thuê…', searchKeys: ['PackageName', 'Description'],
  canView: () => true, canEdit: (role) => role === 'Admin',
  filter: { label: 'Trạng thái gói', options: [{ value: 'true', label: 'Đang áp dụng' }, { value: 'false', label: 'Đã ngừng' }], match: (row, value) => String(Boolean(row.IsActive)) === value },
  columns: [
    { key: 'PackageName', label: 'Tên gói', render: (row) => <strong>{row.PackageName}</strong> },
    { key: 'DurationDays', label: 'Thời hạn', render: (row) => `${formatNumber(row.DurationDays)} ngày` },
    { key: 'PricePerTray', label: 'Giá / khay', render: (row) => <span className="bm-money">{formatMoney(row.PricePerTray)}</span> },
    { key: 'MaxTrays', label: 'Khay tối đa', render: (row) => formatNumber(row.MaxTrays) },
    { key: 'IsActive', label: 'Trạng thái', render: (row) => <Badge tone={row.IsActive ? 'green' : 'neutral'}>{row.IsActive ? 'Đang áp dụng' : 'Đã ngừng'}</Badge> },
  ],
  fields: (row) => [
    nameField('packageName', 'PackageName', 'Tên gói thuê'),
    { ...positiveInteger, name: 'durationDays', source: 'DurationDays', label: 'Thời hạn (ngày)' },
    { name: 'pricePerTray', source: 'PricePerTray', label: 'Giá mỗi khay (VNĐ)', type: 'number', min: 0, max: 999999999999, integer: true, step: '1', required: true },
    { ...positiveInteger, name: 'maxTrays', source: 'MaxTrays', label: 'Số khay tối đa', defaultValue: '1' },
    ...(row ? [{ name: 'isActive', source: 'IsActive', label: 'Trạng thái', type: 'boolean', options: [
      { value: 'true', label: 'Đang áp dụng' }, { value: 'false', label: 'Đã ngừng áp dụng' },
    ] }] : []),
    description,
  ],
  deleteTitle: 'Ngừng áp dụng gói thuê', deleteLabel: 'Ngừng áp dụng',
  canDelete: (row) => Boolean(row.IsActive),
  deleteMessage: (row) => `Ngừng áp dụng gói “${row.PackageName}”? Khách hàng sẽ không thể chọn gói cho đơn mới. Các đơn cũ và dữ liệu gói vẫn được giữ lại.`,
};

export const roomDefinition = {
  title: 'Quản lý phòng nuôi', description: 'Quản lý thông tin phòng, sức chứa và số lượng khay hiện có.',
  singular: 'phòng nuôi', addLabel: 'Thêm phòng nuôi', endpoint: '/rooms', rowKey: 'RoomId', nameKey: 'RoomName',
  searchPlaceholder: 'Tìm mã hoặc tên phòng…', searchKeys: ['RoomCode', 'RoomName'],
  canView: (role) => ['Admin', 'Operator'].includes(role), canEdit: (role) => ['Admin', 'Operator'].includes(role),
  canDeleteRole: (role) => role === 'Admin',
  filter: { label: 'Trạng thái phòng', options: ROOM_STATUS_OPTIONS, match: (row, value) => row.Status === value },
  columns: [
    { key: 'RoomCode', label: 'Mã phòng', render: (row) => <span className="bm-code">{row.RoomCode}</span> },
    { key: 'RoomName', label: 'Tên phòng', render: (row) => <strong>{row.RoomName}</strong> },
    { key: 'Capacity', label: 'Sức chứa', render: (row) => `${formatNumber(row.Capacity)} khay` },
    { key: 'TrayCount', label: 'Khay hiện có', render: (row) => formatNumber(row.TrayCount) },
    { key: 'AvailableTrays', label: 'Khay trống', render: (row) => formatNumber(row.AvailableTrays) },
    { key: 'Status', label: 'Trạng thái', render: roomBadge },
  ],
  fields: (row) => [
    { name: 'roomCode', source: 'RoomCode', label: 'Mã phòng', required: true, maxLength: 10, createOnly: true, readOnly: Boolean(row), hint: row ? 'Mã phòng không thể thay đổi.' : 'Tối đa 10 ký tự, mã sẽ được viết hoa.' },
    nameField('roomName', 'RoomName', 'Tên phòng'),
    { ...positiveInteger, min: row?.TrayCount > 0 ? row.TrayCount : 1, name: 'capacity', source: 'Capacity', label: 'Sức chứa (khay)' },
    { name: 'status', source: 'Status', label: 'Trạng thái', defaultValue: 'Active', options: ROOM_STATUS_OPTIONS, required: true },
    { ...description, keepWhenEmpty: false },
  ],
  deleteTitle: 'Xóa phòng nuôi', deleteLabel: 'Xóa phòng',
  deleteMessage: (row) => `Xóa phòng “${row.RoomName}” (${row.RoomCode})? Phòng có khay, thiết bị hoặc dữ liệu liên quan sẽ không thể xóa.`,
};
