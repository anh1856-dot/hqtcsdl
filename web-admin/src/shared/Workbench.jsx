import React, { useEffect, useId, useRef, useState } from 'react';
import { useSession } from './session.jsx';
import { formBody, text, timestamp, validate } from './model.mjs';

export const col = (key, label, render) => ({ key, label, render });
export const option = (value, label = text(value)) => ({
  value: String(value),
  label,
});
export function Notice({ error, success, retry }) {
  if (!error && !success) return null;
  return (
    <div
      className={`wa-notice ${error ? 'wa-error' : 'wa-success'}`}
      role={error ? 'alert' : 'status'}
    >
      <span>{error ? error.message : success}</span>
      {retry && (
        <button onClick={retry} type="button">
          Thử lại
        </button>
      )}
    </div>
  );
}
export function Page({ title, description, children, actions }) {
  return (
    <section className="wa-page">
      <header className="wa-page-title">
        <div>
          <p className="wa-eyebrow">MUSHROOM FARM / VẬN HÀNH</p>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        <div className="wa-actions">{actions}</div>
      </header>
      {children}
    </section>
  );
}
export function Table({ rows = [], columns, rowKey, label = 'Bảng dữ liệu' }) {
  if (!rows.length) return <p className="wa-empty">Chưa có dữ liệu phù hợp.</p>;
  return (
    <div
      className="wa-table-wrap"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="wa-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr key={rowKey ? r[rowKey] : index}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : text(r[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function LoadState({ resource, children }) {
  if (resource.loading)
    return (
      <p className="wa-empty" role="status">
        Đang tải dữ liệu…
      </p>
    );
  if (resource.error)
    return <Notice error={resource.error} retry={resource.reload} />;
  return children;
}
export function Updated({ at }) {
  return at ? (
    <p className="wa-muted wa-updated">Cập nhật giao diện: {timestamp(at)}</p>
  ) : null;
}
export function Pager({ page, total, pageSize = 20, onPage }) {
  return (
    <div className="wa-pager">
      <span>
        {total ?? '—'} kết quả · Trang {page}
      </span>
      <div className="wa-actions">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Trước
        </button>
        <button
          type="button"
          disabled={page * pageSize >= (total || 0)}
          onClick={() => onPage(page + 1)}
        >
          Sau
        </button>
      </div>
    </div>
  );
}
export function Filters({ fields, values, onChange }) {
  return (
    <div className="wa-filters">
      {fields.map((f) => (
        <label key={f.name}>
          <span>{f.label}</span>
          {f.options ? (
            <select
              aria-label={f.label}
              value={values[f.name] ?? ''}
              onChange={(e) => onChange(f.name, e.target.value)}
            >
              <option value="">Tất cả</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={f.label}
              type={f.type || 'search'}
              value={values[f.name] ?? ''}
              min={f.min}
              max={f.max}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
export function Modal({ title, busy = false, onClose, children, wide }) {
  const ref = useRef();
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    (
      el.querySelector('[data-autofocus]') ||
      el.querySelector('input:not(:disabled),select:not(:disabled)')
    )?.focus();
    return () => {
      if (el.open) el.close();
    };
  }, []);
  return (
    <dialog
      className={`wa-dialog ${wide ? 'wa-wide' : ''}`}
      ref={ref}
      aria-labelledby={id}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          aria-label="Đóng hộp thoại"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function ActionDialog({ action, onClose, onSaved }) {
  const { api } = useSession();
  const fields = action.fields || [];
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.initial ?? (f.type === 'checkbox' ? false : ''),
      ]),
    ),
  );
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const alive = useRef(true);
  const form = useRef();
  const prefix = useId();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (gate.current) return;
    const invalid = { ...validate(fields, values), ...action.check?.(values) };
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      form.current.elements.namedItem(Object.keys(invalid)[0])?.focus();
      return;
    }
    gate.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const body = action.body
        ? action.body(values)
        : fields.length
          ? formBody(fields, values)
          : undefined;
      const response = await api.request(action.path, {
        method: action.method || 'POST',
        body,
      });
      if (alive.current) onSaved(response);
    } catch (error) {
      if (alive.current) setFailure(error);
    } finally {
      gate.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Modal title={action.title} busy={busy} onClose={onClose}>
      <form ref={form} onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          {action.message && <p className="wa-muted">{action.message}</p>}
          <Notice error={failure} />
          <div className="wa-form-grid">
            {fields.map((f) => (
              <label
                key={f.name}
                className={f.wide ? 'wa-field-wide' : ''}
                htmlFor={`${prefix}-${f.name}`}
              >
                <span>
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
                {f.options ? (
                  <select
                    id={`${prefix}-${f.name}`}
                    aria-label={f.label}
                    name={f.name}
                    value={values[f.name]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  >
                    {!f.required && <option value="">Không chọn</option>}
                    {f.required && <option value="">Chọn…</option>}
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    id={`${prefix}-${f.name}`}
                    name={f.name}
                    rows={3}
                    value={values[f.name]}
                    maxLength={f.maxLength}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    id={`${prefix}-${f.name}`}
                    aria-label={f.label}
                    name={f.name}
                    type={f.type || 'text'}
                    value={f.type === 'checkbox' ? undefined : values[f.name]}
                    checked={f.type === 'checkbox' ? values[f.name] : undefined}
                    autoComplete={
                      f.type === 'password' ? 'new-password' : 'off'
                    }
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    maxLength={f.maxLength}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [f.name]:
                          f.type === 'checkbox'
                            ? e.target.checked
                            : e.target.value,
                      }))
                    }
                  />
                )}
                {f.hint && <small className="wa-muted">{f.hint}</small>}
                {errors[f.name] && (
                  <small className="wa-field-error" role="alert">
                    {errors[f.name]}
                  </small>
                )}
              </label>
            ))}
          </div>
          {errors.form && (
            <p role="alert" className="wa-field-error">
              {errors.form}
            </p>
          )}
          <footer>
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button
              className={action.danger ? 'wa-danger' : 'wa-primary'}
              type="submit"
            >
              {busy ? 'Đang xử lý…' : action.submitLabel || 'Xác nhận'}
            </button>
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}
export function Sheet({ record, fields }) {
  return (
    <dl className="wa-sheet">
      {fields.map(([key, label, format]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{format ? format(record[key]) : text(record[key])}</dd>
        </div>
      ))}
    </dl>
  );
}
export function useActions(reload) {
  const [action, setAction] = useState(null);
  const [success, setSuccess] = useState('');
  return {
    open: (a) => {
      setSuccess('');
      setAction(a);
    },
    success,
    dialog: action && (
      <ActionDialog
        key={action.title + action.path}
        action={action}
        onClose={() => setAction(null)}
        onSaved={(response) => {
          setSuccess('Đã thực hiện thành công.');
          setAction(null);
          reload?.(response);
        }}
      />
    ),
  };
}
