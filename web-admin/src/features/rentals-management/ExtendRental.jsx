import React, { useRef, useState } from 'react';
import { useRentals } from './RentalsManagementProvider.jsx';
import { calendarDate, EXTEND_TERMS, extendQuote, isOverdue, money, PAYMENT_METHODS } from './model.mjs';
import { Message } from './ui.jsx';

/**
 * UC22 / BR14: nhan vien gia han don thue ho khach (POST /rentals/:id/extend).
 * Chi hien voi don dang thue; so tien uoc tinh khop cach tinh cua usp_ExtendRental.
 */
export default function ExtendRental({ rental, onStart, onExtended }) {
  const { request } = useRentals();
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState('1');
  const [method, setMethod] = useState('Cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const gate = useRef(false);

  if (rental.Status !== 'Active') return null;
  const overdue = isOverdue(rental);
  const quote = extendQuote(rental, terms);

  async function submit(event) {
    event.preventDefault();
    if (gate.current || !quote) return;
    gate.current = true;
    setBusy(true);
    setError(null);
    try {
      const payload = await request(`/rentals/${rental.RentalId}/extend`, {
        method: 'POST',
        body: { terms: Number(terms), paymentMethod: method },
      });
      setOpen(false);
      onExtended?.(payload.data);
    } catch (failure) {
      setError(failure);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  return <section className="rm-detail-section rm-extend" aria-label="Gia hạn đơn thuê">
    <h3>Gia hạn đơn thuê</h3>
    {overdue && <p className="rm-overdue" role="note">
      Đơn đã quá hạn ngày {calendarDate(rental.EndDate)} nhưng còn khay đang trồng, nên được giữ đến khi thu hoạch xong
      (không tính thêm phí). Gia hạn bây giờ sẽ tính từ hôm nay.
    </p>}
    {!open ? <button type="button" className="rm-button" onClick={() => { onStart?.(); setError(null); setOpen(true); }}>Gia hạn đơn</button>
      : <form className="rm-extend-form" onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <Message error={error} />
          <div className="rm-extend-grid">
            <label className="rm-field"><span>Số kỳ gia hạn ({rental.DurationDays} ngày / kỳ)</span>
              <select aria-label="Số kỳ gia hạn" value={terms} onChange={(e) => setTerms(e.target.value)}>
                {EXTEND_TERMS.map((n) => <option key={n} value={n}>{n} kỳ ({n * rental.DurationDays} ngày)</option>)}
              </select></label>
            <label className="rm-field"><span>Phương thức thanh toán</span>
              <select aria-label="Phương thức thanh toán gia hạn" value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
          </div>
          {quote && <p className="rm-extend-quote">
            Hết hạn mới (dự kiến): <strong>{calendarDate(quote.newEndDate)}</strong> · Số tiền: <strong>{money(quote.amount)}</strong>
            <span className="rm-muted"> ({money(rental.PricePerTray)} × {rental.TrayCount} khay × {terms} kỳ, theo giá gói hiện tại)</span>
          </p>}
          <div className="rm-actions">
            <button type="button" className="rm-button" onClick={() => setOpen(false)}>Hủy</button>
            <button type="submit" className="rm-button rm-primary">{busy ? 'Đang gia hạn…' : 'Xác nhận gia hạn'}</button>
          </div>
        </fieldset>
      </form>}
  </section>;
}
