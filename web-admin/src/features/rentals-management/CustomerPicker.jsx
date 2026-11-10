import React, { useId, useState } from 'react';
import { customersPath } from './model.mjs';
import { useRentalData } from './useRentalData.js';
import { Empty, Loading, Message, Pagination } from './ui.jsx';

/** Search is explicitly for customers, with backend pagination; not a rental search. */
export default function CustomerPicker({ label, value, onChange, activeOnly = false, error, initialFocus = false }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState({ q: '', page: 1 });
  const regionId = useId();
  const resource = useRentalData(customersPath({ ...query, activeOnly }), { enabled: expanded });
  const rows = (resource.payload?.data || []).filter((row) => row.Role === 'Customer' && !row.IsDeleted && (!activeOnly || row.Status === 'Active'));
  return <div className="rm-customer-picker">
    <span className="rm-label">{label}{activeOnly ? ' *' : ''}</span>
    <div className="rm-picker-buttons"><button type="button" className="rm-button rm-picker-toggle" aria-label={label}
      aria-expanded={expanded} aria-controls={regionId} aria-invalid={Boolean(error)} data-rm-initial-focus={initialFocus || undefined}
      onClick={() => setExpanded((visible) => !visible)}>{value ? `${value.FullName} (#${value.UserId})` : 'Chọn khách hàng'}<span aria-hidden="true">⌄</span></button>
      {value && <button type="button" className="rm-link" aria-label={`Bỏ chọn ${label.toLowerCase()}`} onClick={() => onChange(null)}>Bỏ chọn</button>}
    </div>
    {error && <small className="rm-field-error" role="alert">{error}</small>}
    {expanded && <section className="rm-picker-results" id={regionId} aria-label={`Chọn ${label.toLowerCase()}`}>
      <label className="rm-field"><span>Tìm khách hàng theo tên, email hoặc số điện thoại</span><input type="search" value={query.q} maxLength={100}
        onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
        onChange={(event) => setQuery({ q: event.target.value, page: 1 })} /></label>
      <Message error={resource.error} retry={resource.reload} />
      {resource.loading ? <Loading /> : !resource.error && (rows.length ? <ul className="rm-customer-options">{rows.map((row) => <li key={row.UserId}>
        <button type="button" aria-label={`Chọn ${row.FullName} (#${row.UserId})`} onClick={() => { onChange(row); setExpanded(false); }}>
          <strong>{row.FullName}</strong><span>#{row.UserId} · {row.Email}{row.Status === 'Disabled' ? ' · Đã khóa' : ''}</span>
        </button></li>)}</ul> : <Empty title="Không có khách hàng phù hợp">Hãy thay đổi từ khóa tìm kiếm.</Empty>)}
      {resource.payload && <Pagination page={query.page} pageSize={10} total={resource.payload.pagination?.total || 0} loading={resource.loading}
        onPage={(page) => setQuery((old) => ({ ...old, page }))} />}
    </section>}
  </div>;
}
