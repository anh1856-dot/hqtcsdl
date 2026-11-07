import React, { useEffect, useId, useRef, useState } from 'react';
import CustomerPicker from './CustomerPicker.jsx';
import { useRentals } from './RentalsManagementProvider.jsx';
import { useRentalData } from './useRentalData.js';
import { assignmentBody, PAYMENT_METHODS, positiveId, validateAssignment } from './model.mjs';
import { Loading, Message, Modal } from './ui.jsx';

export default function AssignTrayDialog({ onClose, onCreated }) {
  const { request } = useRentals();
  const packages = useRentalData('/packages');
  const trays = useRentalData('/trays?status=Available');
  const [values, setValues] = useState({ customer: null, packageId: '', trayCode: '', paymentMethod: 'Cash' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [phase, setPhase] = useState('edit');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const reviewHeading = useRef(null);
  const form = useRef(null);
  const prefix = useId();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (phase === 'review') reviewHeading.current?.focus();
    else form.current?.querySelector('[data-rm-initial-focus]')?.focus();
  }, [phase]);
  const activePackages = (packages.payload?.data || []).filter((item) => item.IsActive);
  const availableTrays = (trays.payload?.data || []).filter((item) => item.Status === 'Available');
  const choicesReady = Boolean(packages.payload && trays.payload && !packages.loading && !trays.loading && !packages.error && !trays.error);
  const chosenPackage = activePackages.find((item) => Number(item.PackageId) === Number(values.packageId));
  function change(field, value) { setValues((old) => ({ ...old, [field]: value })); setErrors((old) => ({ ...old, [field]: undefined })); }
  async function submit(event) {
    event.preventDefault();
    if (locked.current || !choicesReady) return;
    const validation = validateAssignment(values, activePackages, availableTrays);
    setErrors(validation);
    if (Object.keys(validation).length) {
      const first = Object.keys(validation)[0];
      (first === 'customer' ? form.current.querySelector('[data-rm-initial-focus]') : form.current.elements.namedItem(first))?.focus();
      setPhase('edit');
      return;
    }
    if (phase === 'edit') { setFailure(null); setPhase('review'); return; }
    locked.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const result = await request('/rentals/assign', { method: 'POST', body: assignmentBody(values) });
      if (alive.current) onCreated(positiveId(result?.data?.rentalId));
    } catch (error) {
      if (alive.current) { setFailure(error); setPhase('edit'); }
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return <Modal title="Gán khay cho khách hàng" busy={busy} onClose={onClose}>
    <form ref={form} className="rm-assignment" onSubmit={submit} noValidate>
      <fieldset className="rm-fieldset" disabled={busy}>
        <Message error={failure} />
        {phase === 'edit' ? <>
          <p className="rm-help">Mỗi lần gán tạo một đơn thuê cho một khay. Hệ thống hiện ghi nhận thanh toán giả lập ngay khi gán.</p>
          <CustomerPicker label="Khách hàng nhận khay" value={values.customer} onChange={(customer) => change('customer', customer)} activeOnly initialFocus error={errors.customer} />
          <Message error={packages.error} retry={packages.reload} /><Message error={trays.error} retry={trays.reload} />
          {packages.loading || trays.loading ? <Loading>Đang tải gói thuê và khay trống…</Loading> : <>
            <div className="rm-form-grid">
              <label className="rm-field" htmlFor={`${prefix}-package`}><span>Gói thuê đang áp dụng *</span>
                <select id={`${prefix}-package`} aria-label="Gói thuê đang áp dụng" name="packageId" value={values.packageId} required disabled={!packages.payload}
                  aria-invalid={Boolean(errors.packageId)} aria-describedby={`${prefix}-package-help`}
                  onChange={(event) => change('packageId', event.target.value)}>
                  <option value="">Chọn gói thuê</option>{activePackages.map((item) => <option value={item.PackageId} key={item.PackageId}>{item.PackageName} · {item.DurationDays} ngày</option>)}
                </select><small className={errors.packageId ? 'rm-field-error' : 'rm-muted'} id={`${prefix}-package-help`}>
                  {errors.packageId || (!activePackages.length && packages.payload ? 'Chưa có gói thuê đang áp dụng.' : 'Tổng tiền chính thức được lấy từ đơn do máy chủ tạo.')}</small>
              </label>
              <label className="rm-field" htmlFor={`${prefix}-tray`}><span>Mã khay còn trống *</span>
                <select id={`${prefix}-tray`} aria-label="Mã khay còn trống" name="trayCode" value={values.trayCode} required disabled={!trays.payload}
                  aria-invalid={Boolean(errors.trayCode)} aria-describedby={`${prefix}-tray-help`}
                  onChange={(event) => change('trayCode', event.target.value)}>
                  <option value="">Chọn mã khay</option>{availableTrays.map((item) => <option value={item.TrayCode} key={item.TrayId}>{item.TrayCode} · {item.RoomName}</option>)}
                </select><small className={errors.trayCode ? 'rm-field-error' : 'rm-muted'} id={`${prefix}-tray-help`}>
                  {errors.trayCode || (!availableTrays.length && trays.payload ? 'Hiện không có khay trống.' : 'Khay có thể được người khác thuê trước khi bạn xác nhận.')}</small>
              </label>
              <label className="rm-field" htmlFor={`${prefix}-method`}><span>Phương thức thanh toán *</span>
                <select id={`${prefix}-method`} aria-label="Phương thức thanh toán" name="paymentMethod" value={values.paymentMethod} required aria-invalid={Boolean(errors.paymentMethod)}
                  onChange={(event) => change('paymentMethod', event.target.value)}>
                  {Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>{errors.paymentMethod && <small className="rm-field-error">{errors.paymentMethod}</small>}
              </label>
            </div>
            <button type="button" className="rm-link rm-refresh-choices" onClick={() => { packages.reload(); trays.reload(); }}>Cập nhật gói và khay trống</button>
          </>}
        </> : <section className="rm-review" aria-label="Xác nhận thông tin gán khay">
          <h3 ref={reviewHeading} tabIndex={-1}>Kiểm tra trước khi tạo đơn</h3>
          <dl className="rm-facts">
            <div><dt>Khách hàng</dt><dd>{values.customer.FullName} (#{values.customer.UserId})</dd></div>
            <div><dt>Gói thuê</dt><dd>{chosenPackage?.PackageName}</dd></div>
            <div><dt>Mã khay</dt><dd>{values.trayCode}</dd></div>
            <div><dt>Phương thức thanh toán</dt><dd>{PAYMENT_METHODS[values.paymentMethod]}</dd></div>
          </dl>
          <p className="rm-help">Xác nhận sẽ tạo đơn thuê một khay và ghi nhận thanh toán giả lập. Máy chủ quyết định số tiền và kiểm tra khay còn trống.</p>
        </section>}
        <footer className="rm-modal-footer">
          <button type="button" className="rm-button" onClick={phase === 'review' ? () => setPhase('edit') : onClose}>{phase === 'review' ? 'Quay lại chỉnh sửa' : 'Hủy'}</button>
          <button type="submit" className="rm-button rm-primary" disabled={busy || !choicesReady || !activePackages.length || !availableTrays.length}>
            {busy ? 'Đang tạo đơn…' : phase === 'review' ? 'Xác nhận gán khay' : 'Kiểm tra thông tin'}</button>
        </footer>
      </fieldset>
    </form>
  </Modal>;
}
