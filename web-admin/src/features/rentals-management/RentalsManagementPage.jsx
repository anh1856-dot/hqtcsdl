import React, { useState } from 'react';
import { useRentals } from './RentalsManagementProvider.jsx';
import { useRentalData } from './useRentalData.js';
import { calendarDate, money, RENTAL_STATUSES, rentalsPath } from './model.mjs';
import CustomerPicker from './CustomerPicker.jsx';
import AssignTrayDialog from './AssignTrayDialog.jsx';
import { RentalDetails } from './RentalDetails.jsx';
import { Empty, Loading, Message, Modal, Pagination, Status, Table } from './ui.jsx';

export function RentalsManagementPage() {
  const { allowed } = useRentals();
  const [filters, setFilters] = useState({ page: 1, pageSize: 10, status: '', customer: null });
  const [modal, setModal] = useState(null);
  const [created, setCreated] = useState(null);
  const resource = useRentalData(rentalsPath({ ...filters, customerId: filters.customer?.UserId }));
  const columns = [
    { key: 'RentalId', label: 'Mã đơn', render: (row) => <strong className="rm-code">#{row.RentalId}</strong> },
    { key: 'CustomerName', label: 'Khách hàng', render: (row) => <><strong>{row.CustomerName}</strong><span className="rm-secondary">Mã khách #{row.CustomerId}</span></> },
    { key: 'PackageName', label: 'Gói thuê' },
    { key: 'StartDate', label: 'Thời gian thuê', render: (row) => <>{calendarDate(row.StartDate)}<span className="rm-secondary">đến {calendarDate(row.EndDate)}</span></> },
    { key: 'TrayCount', label: 'Số khay' },
    { key: 'TotalAmount', label: 'Tổng tiền', render: (row) => <span className="rm-amount">{money(row.TotalAmount)}</span> },
    { key: 'Status', label: 'Trạng thái', render: (row) => <Status value={row.Status} labels={RENTAL_STATUSES} /> },
    { key: 'actions', label: 'Thao tác', render: (row) => <button type="button" className="rm-link" aria-label={`Xem đơn #${row.RentalId}`}
      onClick={() => setModal({ type: 'details', id: row.RentalId })}>Xem chi tiết</button> },
  ];
  function filter(field, value) { setFilters((old) => ({ ...old, [field]: value, page: 1 })); }
  function assignmentCreated(id) {
    setModal(null);
    setCreated({ id });
    if (filters.page !== 1) setFilters((old) => ({ ...old, page: 1 }));
    else resource.reload();
  }
  return <section className="rm-root rm-page" aria-label="Quản lý đơn thuê">
    <header className="rm-page-header"><div><p className="rm-eyebrow">QUẢN LÝ DỊCH VỤ</p><h1>Quản lý đơn thuê</h1>
      <p className="rm-subtitle">Theo dõi đơn thuê, thanh toán và gán khay cho khách hàng tại trại.</p></div>
      {allowed && <button type="button" className="rm-button rm-primary" onClick={() => { setCreated(null); setModal({ type: 'assign' }); }}><span aria-hidden="true">＋</span> Gán khay cho khách</button>}
    </header>
    {!allowed ? <div role="alert"><Empty title="Không có quyền truy cập">Trang này chỉ dành cho quản trị viên và nhân viên vận hành đã đăng nhập.</Empty></div> : <>
      {created && <Message>Đã gán khay và tạo đơn thuê{created.id ? ` #${created.id}` : ''}.
        {created.id ? <> <button type="button" className="rm-link" onClick={() => setModal({ type: 'details', id: created.id })}>Xem đơn #{created.id}</button></>
          : ' Máy chủ chưa trả mã đơn; hãy kiểm tra danh sách trước khi tạo thêm.'}</Message>}
      <Message error={resource.error} retry={resource.reload} />
      <div className="rm-panel"><div className="rm-toolbar">
        <label className="rm-field rm-status-filter"><span>Trạng thái đơn thuê</span><select aria-label="Trạng thái đơn thuê" value={filters.status} onChange={(event) => filter('status', event.target.value)}>
          <option value="">Tất cả trạng thái</option>{Object.entries(RENTAL_STATUSES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <CustomerPicker label="Lọc theo khách hàng" value={filters.customer} onChange={(customer) => filter('customer', customer)} />
        <button type="button" className="rm-button" disabled={resource.loading} onClick={resource.reload}>Làm mới</button>
      </div>
        {resource.loading ? <Loading>Đang tải danh sách đơn thuê…</Loading> : !resource.error && <>
          <p className="rm-list-summary">{resource.payload?.pagination?.total || 0} đơn thuê phù hợp</p>
          {resource.payload?.data.length ? <Table label="Danh sách đơn thuê" columns={columns} rows={resource.payload.data} rowKey="RentalId" />
            : <Empty title="Chưa có đơn thuê phù hợp">Hãy thay đổi bộ lọc hoặc gán khay để tạo đơn mới.</Empty>}
        </>}
        {resource.payload && <Pagination page={filters.page} pageSize={filters.pageSize} total={resource.payload.pagination?.total || 0} loading={resource.loading}
          onPage={(page) => setFilters((old) => ({ ...old, page }))} onPageSize={(size) => filter('pageSize', size)} />}
      </div>
      {modal?.type === 'assign' && <AssignTrayDialog onClose={() => setModal(null)} onCreated={assignmentCreated} />}
      {modal?.type === 'details' && <Modal title={`Chi tiết đơn thuê #${modal.id}`} wide onClose={() => setModal(null)}>
        <RentalDetails rentalId={modal.id} /><footer className="rm-modal-footer rm-details-footer">
          <button type="button" className="rm-button" onClick={() => setModal(null)}>Đóng</button></footer>
      </Modal>}
    </>}
  </section>;
}
