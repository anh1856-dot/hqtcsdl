import React, { useState } from 'react';
import { useRentals } from './RentalsManagementProvider.jsx';
import { useRentalData } from './useRentalData.js';
import { calendarDate, isOverdue, money, PAYMENT_METHODS, PAYMENT_STATUSES, positiveId, RENTAL_STATUSES, TRAY_STATUSES } from './model.mjs';
import { Empty, Loading, Message, Status, Table } from './ui.jsx';
import ExtendRental from './ExtendRental.jsx';

const trayColumns = [
  { key: 'TrayCode', label: 'Mã khay', render: (row) => <strong className="rm-code">{row.TrayCode}</strong> },
  { key: 'RoomName', label: 'Phòng nuôi' },
  { key: 'Status', label: 'Trạng thái khay', render: (row) => <Status value={row.Status} labels={TRAY_STATUSES} /> },
  { key: 'IsActive', label: 'Gán khay', render: (row) => row.IsActive ? 'Đang gán' : 'Đã kết thúc gán' },
  { key: 'IsLinked', label: 'Liên kết với khách', render: (row) => row.IsLinked ? 'Đã liên kết' : 'Chưa liên kết' },
];
const paymentColumns = [
  { key: 'PaymentId', label: 'Mã thanh toán', render: (row) => `#${row.PaymentId}` },
  { key: 'Amount', label: 'Số tiền', render: (row) => <strong>{money(row.Amount)}</strong> },
  { key: 'Method', label: 'Phương thức', render: (row) => PAYMENT_METHODS[row.Method] || row.Method },
  { key: 'Status', label: 'Trạng thái', render: (row) => <Status value={row.Status} labels={PAYMENT_STATUSES} /> },
  { key: 'PaidAt', label: 'Ngày thanh toán', render: (row) => calendarDate(row.PaidAt) },
  { key: 'TransactionRef', label: 'Mã giao dịch' },
];

/** Optional standalone read-only content; requires RentalsManagementProvider. */
export function RentalDetails({ rentalId, onChanged }) {
  return <div className="rm-root"><RentalDetailsContent rentalId={rentalId} onChanged={onChanged} /></div>;
}

function RentalDetailsContent({ rentalId, onChanged }) {
  const { allowed } = useRentals();
  const id = positiveId(rentalId);
  const resource = useRentalData(`/rentals/${id}`, { enabled: id !== null, detail: true });
  // Giu thong bao gia han o day: tai lai chi tiet se dung lai phan gia han
  const [extended, setExtended] = useState(null);
  if (!allowed) return <div role="alert" className="rm-empty">Bạn không có quyền xem đơn thuê.</div>;
  if (!id) return <Empty title="Không tìm thấy đơn thuê">Mã đơn thuê không hợp lệ.</Empty>;
  if (resource.loading) return <Loading>Đang tải chi tiết đơn thuê…</Loading>;
  if (resource.error) return <div className="rm-detail-error">
    {resource.error.status === 404 && <h3>Không tìm thấy đơn thuê</h3>}
    <Message error={resource.error} retry={resource.reload} />
  </div>;
  const rental = resource.payload.data;
  return <div className="rm-details">
    <div className="rm-detail-top"><div><p className="rm-eyebrow">THÔNG TIN ĐƠN THUÊ</p><h3>Đơn #{rental.RentalId}</h3></div>
      <span><Status value={rental.Status} labels={RENTAL_STATUSES} />{isOverdue(rental) && <span className="rm-status rm-status-amber rm-overdue-badge">Quá hạn – chờ thu hoạch</span>}</span></div>
    <dl className="rm-facts">
      <div><dt>Khách hàng</dt><dd>{rental.CustomerName || '—'} <span className="rm-muted">(#{rental.CustomerId})</span></dd></div>
      <div><dt>Gói thuê</dt><dd>{rental.PackageName || '—'}</dd></div>
      <div><dt>Ngày bắt đầu</dt><dd>{calendarDate(rental.StartDate)}</dd></div>
      <div><dt>Ngày kết thúc</dt><dd>{calendarDate(rental.EndDate)}</dd></div>
      <div><dt>Số khay</dt><dd>{rental.TrayCount ?? '—'}</dd></div>
      <div><dt>Tổng tiền đơn</dt><dd className="rm-total">{money(rental.TotalAmount)}</dd></div>
    </dl>
    {extended && <Message>Đã gia hạn thêm {extended.ExtendedDays} ngày, đến {calendarDate(extended.EndDate)}. Đã thu {money(extended.Amount)}.</Message>}
    <ExtendRental rental={rental} onStart={() => setExtended(null)} onExtended={(data) => { setExtended(data); resource.reload(); onChanged?.(); }} />
    <section className="rm-detail-section"><h3>Các khay thuộc đơn</h3><p className="rm-muted">Trạng thái khay được hiển thị theo thông tin hiện tại.</p>
      {rental.trays.length ? <Table label="Khay thuộc đơn thuê" columns={trayColumns} rows={rental.trays} rowKey="TrayId" /> : <Empty title="Đơn chưa có thông tin khay" />}
    </section>
    <section className="rm-detail-section"><h3>Lịch sử thanh toán</h3>
      {rental.payments.length ? <Table label="Lịch sử thanh toán" columns={paymentColumns} rows={rental.payments} rowKey="PaymentId" /> : <Empty title="Chưa có giao dịch thanh toán" />}
    </section>
  </div>;
}
