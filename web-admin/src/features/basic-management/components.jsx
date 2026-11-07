import React, { useEffect, useId, useRef, useState } from 'react';
import { useMutation } from './hooks.js';
import { fieldPayload, initialValues, validateFields } from './model.mjs';

export function Notice({ error, success, retry }) {
  if (!error && !success) return null;
  return <div className={`bm-notice ${error ? 'bm-notice-error' : 'bm-notice-success'}`} role={error ? 'alert' : 'status'}>
    <span>{error ? error.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.' : success}</span>
    {retry && <button type="button" className="bm-button bm-button-small" onClick={retry}>Thử lại</button>}
  </div>;
}

export function PageFrame({ title, description, action, children }) {
  return <section className="bm-root" aria-label={title}>
    <header className="bm-page-header">
      <div><p className="bm-eyebrow">QUẢN LÝ CƠ BẢN</p><h1>{title}</h1><p className="bm-subtitle">{description}</p></div>
      {action}
    </header>
    {children}
  </section>;
}

export function NoAccess() {
  return <div className="bm-empty" role="alert"><h2>Không có quyền truy cập</h2><p>Tài khoản hiện tại không được phép sử dụng trang này.</p></div>;
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`bm-badge bm-badge-${tone}`}>{children}</span>;
}

export function DataTable({ columns, rows, rowKey, actions, loading, error, emptyText = 'Chưa có dữ liệu.' }) {
  if (loading) return <div className="bm-empty" role="status"><span className="bm-spinner" aria-hidden="true" /> Đang tải dữ liệu…</div>;
  if (error) return null;
  if (!rows.length) return <div className="bm-empty"><h2>Chưa có kết quả</h2><p>{emptyText}</p></div>;
  return <div className="bm-table-scroll" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang trên màn hình nhỏ">
    <table className="bm-table"><thead><tr>{columns.map((col) => <th key={col.key} scope="col">{col.label}</th>)}
      {actions && <th scope="col" className="bm-actions-heading">Thao tác</th>}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[rowKey]}>{columns.map((col) => <td key={col.key}>
        {col.render ? col.render(row) : row[col.key] || '—'}
      </td>)}{actions && <td><div className="bm-row-actions">{actions(row)}</div></td>}</tr>)}</tbody>
    </table>
  </div>;
}

function Dialog({ title, busy, onClose, children }) {
  const dialog = useRef(null);
  const headingId = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const initialFocus = element.querySelector('[data-bm-initial-focus]')
      || element.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
    initialFocus?.focus();
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog className="bm-dialog bm-root" ref={dialog} aria-labelledby={headingId} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="bm-dialog-heading"><h2 id={headingId}>{title}</h2>
      <button type="button" className="bm-icon-button" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}>×</button>
    </div>{children}
  </dialog>;
}

export function Field({ field, value, onChange, error, disabled }) {
  const id = useId();
  const props = {
    id, name: field.name, value, disabled, required: field.required,
    onChange: (event) => onChange(event.target.value),
    'aria-invalid': Boolean(error),
    'aria-describedby': (error || field.hint) ? `${id}-help` : undefined,
    maxLength: field.maxLength,
  };
  return <div className={`bm-field ${field.wide ? 'bm-field-wide' : ''}`}>
    <label htmlFor={id}>{field.label}{field.required && <span className="bm-required"> *</span>}</label>
    {field.options ? <select {...props}>{field.options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      : field.type === 'textarea' ? <textarea {...props} rows={3} />
        : <input {...props} type={field.type || 'text'} min={field.min} max={field.max} step={field.step}
          autoComplete={field.type === 'password' ? 'new-password' : field.autoComplete || 'off'} />}
    {(error || field.hint) && <small id={`${id}-help`} className={error ? 'bm-field-error' : 'bm-hint'}>{error || field.hint}</small>}
  </div>;
}

export function EntityDialog({ title, fields, row, endpoint, method, onClose, onSaved, note, confirmRoleChange = false }) {
  const [values, setValues] = useState(() => initialValues(fields, row));
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation();
  const roleChanged = confirmRoleChange && row && values.role !== row.Role;
  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateFields(fields.filter((field) => !field.readOnly), values);
    // These endpoints cannot clear values because their PUT uses COALESCE.
    for (const field of fields) {
      if (row && field.keepWhenEmpty && row[field.source] != null && row[field.source] !== '' && !String(values[field.name] ?? '').trim()) {
        nextErrors[field.name] = 'API hiện chưa hỗ trợ xóa trắng trường này. Hãy giữ hoặc nhập giá trị mới.';
      }
    }
    if (roleChanged && !confirmed) nextErrors.confirmation = 'Vui lòng xác nhận việc đổi vai trò.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    await mutation.run(endpoint, { method, body: fieldPayload(fields, values, row) }, onSaved);
  }
  return <Dialog title={title} busy={mutation.busy} onClose={onClose}>
    <form onSubmit={submit} noValidate>
      <fieldset className="bm-fieldset" disabled={mutation.busy}>
        {note && <p className="bm-dialog-note">{note}</p>}
        <Notice error={mutation.error} />
        <div className="bm-form-grid">{fields.map((field) => <Field key={field.name} field={field}
          value={values[field.name]} disabled={field.readOnly}
          onChange={(value) => { setValues((old) => ({ ...old, [field.name]: value })); if (field.name === 'role') setConfirmed(false); }}
          error={errors[field.name]} />)}</div>
        {roleChanged && <div className="bm-confirm-check"><label><input name="confirmation" type="checkbox" checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)} /> Tôi xác nhận đổi vai trò của tài khoản này.</label>
          {errors.confirmation && <p className="bm-field-error" role="alert">{errors.confirmation}</p>}</div>}
        <footer className="bm-dialog-footer"><button className="bm-button" type="button" onClick={onClose}>Hủy</button>
          <button className="bm-button bm-button-primary" type="submit">{mutation.busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></footer>
      </fieldset>
    </form>
  </Dialog>;
}

export function ConfirmDialog({ title, message, endpoint, method = 'DELETE', body, confirmLabel = 'Xác nhận', onClose, onSaved, dangerous = true }) {
  const mutation = useMutation();
  return <Dialog title={title} busy={mutation.busy} onClose={onClose}>
    <form onSubmit={(event) => { event.preventDefault(); mutation.run(endpoint, { method, body }, onSaved); }}>
      <fieldset className="bm-fieldset" disabled={mutation.busy}>
        <p className="bm-dialog-note">{message}</p><Notice error={mutation.error} />
        <footer className="bm-dialog-footer"><button type="button" className="bm-button" onClick={onClose} data-bm-initial-focus>Hủy</button>
          <button type="submit" className={`bm-button ${dangerous ? 'bm-button-danger' : 'bm-button-primary'}`}>
            {mutation.busy ? 'Đang xử lý…' : confirmLabel}</button></footer>
      </fieldset>
    </form>
  </Dialog>;
}
