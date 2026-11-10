import React, { useState } from 'react';
import { useBasicManagement } from './BasicManagementProvider.jsx';
import { useList } from './hooks.js';
import { ConfirmDialog, DataTable, EntityDialog, NoAccess, Notice, PageFrame } from './components.jsx';

export default function ResourcePage({ definition }) {
  const { role } = useBasicManagement();
  const allowed = definition.canView(role);
  const canEdit = definition.canEdit(role);
  const canDelete = definition.canDeleteRole ? definition.canDeleteRole(role) : canEdit;
  const list = useList(definition.listEndpoint?.(role) || definition.endpoint, allowed);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState(null);
  const [success, setSuccess] = useState('');
  const rows = (list.data?.data || []).filter((row) => {
    const matchesText = definition.searchKeys.some((key) => String(row[key] || '').toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN')));
    return matchesText && (!filter || definition.filter.match(row, filter));
  });
  function saved(message) { setDialog(null); setSuccess(message); list.reload(); }
  function open(value) { setSuccess(''); setDialog(value); }
  return <PageFrame title={definition.title} description={definition.description}
    action={allowed && canEdit && <button className="bm-button bm-button-primary" onClick={() => open({ type: 'edit' })}>
      <span aria-hidden="true">＋</span> {definition.addLabel}</button>}>
    {!allowed ? <NoAccess /> : <>
      <Notice success={success} /><Notice error={list.error} retry={list.reload} />
      <div className="bm-panel">
        <div className="bm-toolbar">
          <label className="bm-search"><span>Tìm kiếm</span><input type="search" value={search} placeholder={definition.searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)} /></label>
          {definition.filter && <label className="bm-filter"><span>{definition.filter.label}</span><select aria-label={definition.filter.label} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">Tất cả trạng thái</option>{definition.filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select></label>}
          <button className="bm-button" disabled={list.loading} onClick={list.reload}>Làm mới</button>
        </div>
        {list.data && <p className="bm-list-count">{rows.length} kết quả{search || filter ? ` / ${list.data.data.length} bản ghi` : ''}</p>}
        <DataTable columns={definition.columns} rows={rows} rowKey={definition.rowKey} loading={list.loading} error={list.error}
          emptyText={search || filter ? 'Không có dữ liệu phù hợp. Hãy thay đổi từ khóa hoặc bộ lọc.' : `Chưa có ${definition.singular} nào.`}
          actions={canEdit || canDelete ? (row) => <>
            {canEdit && <button className="bm-link-button" aria-label={`Sửa ${row[definition.nameKey]}`} onClick={() => open({ type: 'edit', row })}>Sửa</button>}
            {canDelete && (!definition.canDelete || definition.canDelete(row)) && <button className="bm-link-button bm-text-danger"
              aria-label={`${definition.deleteLabel} ${row[definition.nameKey]}`} onClick={() => open({ type: 'delete', row })}>{definition.deleteLabel}</button>}
          </> : undefined} />
      </div>
      {dialog?.type === 'edit' && <EntityDialog key={dialog.row?.[definition.rowKey] || 'new'}
        title={dialog.row ? `Sửa ${definition.singular}` : definition.addLabel} fields={definition.fields(dialog.row)} row={dialog.row}
        endpoint={dialog.row ? `${definition.endpoint}/${dialog.row[definition.rowKey]}` : definition.endpoint}
        method={dialog.row ? 'PUT' : 'POST'} onClose={() => setDialog(null)}
        onSaved={() => saved(dialog.row ? `Đã cập nhật ${definition.singular}.` : `Đã thêm ${definition.singular}.`)} />}
      {dialog?.type === 'delete' && <ConfirmDialog title={definition.deleteTitle} message={definition.deleteMessage(dialog.row)}
        endpoint={`${definition.endpoint}/${dialog.row[definition.rowKey]}`} confirmLabel={definition.deleteLabel}
        onClose={() => setDialog(null)} onSaved={() => saved(`Đã ${definition.deleteLabel.toLocaleLowerCase('vi-VN')}.`)} />}
    </>}
  </PageFrame>;
}
