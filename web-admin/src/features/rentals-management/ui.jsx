import React, { useEffect, useId, useRef } from 'react';

export function Message({ error, children, retry }) {
  if (!error && !children) return null;
  return <div className={`rm-message ${error ? 'rm-error' : 'rm-success'}`} role={error ? 'alert' : 'status'}>
    <span>{error ? error.message || 'Không thể thực hiện yêu cầu.' : children}</span>
    {retry && <button type="button" className="rm-button rm-small" onClick={retry}>Thử lại</button>}
  </div>;
}

export function Loading({ children = 'Đang tải dữ liệu…' }) {
  return <div className="rm-empty" role="status"><span className="rm-spinner" aria-hidden="true" />{children}</div>;
}

export function Empty({ title = 'Chưa có dữ liệu', children }) {
  return <div className="rm-empty"><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

export function Status({ value, labels }) {
  return <span className={`rm-status ${['Active', 'Paid', 'Available'].includes(value) ? 'rm-status-green' : value === 'Pending' ? 'rm-status-amber' : ''}`}>
    {labels[value] || value || '—'}</span>;
}

export function Modal({ title, busy = false, onClose, children, wide = false }) {
  const reference = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = reference.current;
    element.showModal();
    (element.querySelector('[data-rm-initial-focus]') || element.querySelector('[data-rm-close]'))?.focus();
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog ref={reference} className={`rm-root rm-modal ${wide ? 'rm-modal-wide' : ''}`} aria-labelledby={titleId} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="rm-modal-header"><h2 id={titleId}>{title}</h2>
      <button type="button" className="rm-close" aria-label="Đóng hộp thoại" data-rm-close disabled={busy} onClick={onClose}>×</button>
    </header>{children}
  </dialog>;
}

export function Table({ label, columns, rows, rowKey }) {
  return <div className="rm-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="rm-table"><thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[rowKey]}>{columns.map((column) => <td key={column.key}>
        {column.render ? column.render(row) : row[column.key] ?? '—'}
      </td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export function Pagination({ page, pageSize, total, loading, onPage, onPageSize }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return <div className="rm-pagination">
    {onPageSize ? <label>Số dòng mỗi trang <select aria-label="Số dòng mỗi trang" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
      {[10, 20, 50].map((size) => <option value={size} key={size}>{size}</option>)}</select></label> : <span>{total} khách hàng phù hợp</span>}
    <span>Trang {page}{total > 0 ? ` / ${last}` : ''}</span>
    <div className="rm-actions"><button type="button" className="rm-button rm-small" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Trước</button>
      <button type="button" className="rm-button rm-small" disabled={loading || page >= last} onClick={() => onPage(page + 1)}>Sau</button></div>
  </div>;
}
