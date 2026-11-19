import React, { useState } from 'react';
import { useQuery } from '../shared/data.jsx';
import {
  col,
  Filters,
  LoadState,
  Notice,
  option,
  Page,
  Table,
  useActions,
} from '../shared/Workbench.jsx';
import { date, deliveryNext, query, schedulableTrays, timestamp, todayIso, vnd } from '../shared/model.mjs';

export function Harvests() {
  const [filters, setFilters] = useState({
    status: 'Scheduled',
    from: '',
    to: '',
  });
  const badDates = filters.from && filters.to && filters.from > filters.to;
  const resource = useQuery(query('/harvests', filters), {
    enabled: !badDates,
  });
  const actions = useActions(resource.reload);
  // Khay dang trong de chon khi lap lich (UC36)
  const trays = useQuery('/trays');
  const scheduled = new Set(
    (resource.payload?.data || [])
      .filter((r) => r.Status === 'Scheduled')
      .map((r) => r.TrayId),
  );
  const futureDate = (values) =>
    values.scheduledDate && values.scheduledDate < todayIso()
      ? { scheduledDate: 'Ngày thu hoạch phải từ hôm nay trở đi.' }
      : {};
  const dateField = (initial) => ({
    name: 'scheduledDate',
    label: 'Ngày thu hoạch',
    type: 'date',
    min: todayIso(),
    required: true,
    initial,
  });
  const noteField = {
    name: 'note',
    label: 'Ghi chú',
    type: 'textarea',
    maxLength: 500,
  };
  function openSchedule() {
    const options = schedulableTrays(trays.payload?.data || []).map((t) => ({
      value: String(t.TrayId),
      label: `${t.TrayCode} · ${t.RoomName}${t.CustomerName ? ' · ' + t.CustomerName : ''}${
        t.ExpectedHarvestDate ? ' · dự kiến ' + date(t.ExpectedHarvestDate) : ''
      }${scheduled.has(t.TrayId) ? ' (đã có lịch, sẽ đổi ngày)' : ''}`,
    }));
    actions.open({
      title: 'Lập lịch thu hoạch',
      path: '/harvests',
      message:
        'Chỉ lập lịch cho khay đang trồng. Khay đã có lịch đang chờ thì lịch cũ được đổi sang ngày mới. Khách thuê nhận thông báo.',
      submitLabel: 'Lập lịch',
      fields: [
        { name: 'trayId', label: 'Khay', options, required: true, wide: true },
        dateField(todayIso()),
        noteField,
      ],
      check: (values) =>
        options.length ? futureDate(values) : { form: 'Không có khay nào đang trồng.' },
      body: (values) => ({
        trayId: Number(values.trayId),
        scheduledDate: values.scheduledDate,
        note: values.note.trim() || undefined,
      }),
    });
  }
  return (
    <Page
      title="Thu hoạch"
      description="Lịch và kết quả thu hoạch; lập lịch cho khay đang trồng, ghi nhận theo khay có lịch hợp lệ."
      actions={
        <>
          <button
            className="wa-primary"
            disabled={trays.loading || Boolean(trays.error)}
            title={trays.error ? 'Không tải được danh sách khay' : undefined}
            onClick={openSchedule}
          >
            Lập lịch thu hoạch
          </button>
          <button onClick={resource.reload}>Làm mới</button>
        </>
      }
    >
      <Notice success={actions.success} />
      <Filters
        fields={[
          {
            name: 'status',
            label: 'Trạng thái',
            options: ['Scheduled', 'Completed', 'Cancelled'].map((s) =>
              option(s),
            ),
          },
          { name: 'from', label: 'Từ ngày', type: 'date' },
          { name: 'to', label: 'Đến ngày', type: 'date' },
        ]}
        values={filters}
        onChange={(key, value) => setFilters((v) => ({ ...v, [key]: value }))}
      />
      {badDates ? (
        <Notice
          error={new Error('Ngày bắt đầu phải không lớn hơn ngày kết thúc.')}
        />
      ) : (
        <LoadState resource={resource}>
          <div className="wa-card">
            <Table
              rows={resource.payload?.data || []}
              rowKey="HarvestId"
              columns={[
                col('TrayCode', 'Mã khay'),
                col('RoomName', 'Phòng'),
                col('TypeName', 'Loại nấm'),
                col('CustomerName', 'Khách hàng'),
                col('ScheduledDate', 'Lịch thu hoạch', (r) =>
                  date(r.ScheduledDate),
                ),
                col('HarvestedAt', 'Đã thu hoạch lúc', (r) =>
                  timestamp(r.HarvestedAt),
                ),
                col('WeightKg', 'Khối lượng (kg)'),
                col('Quality', 'Chất lượng'),
                col('Status', 'Trạng thái'),
                col('Note', 'Ghi chú'),
                col('action', 'Thao tác', (r) =>
                  r.Status === 'Scheduled' ? (
                    <div className="wa-row-actions">
                    <button
                      onClick={() =>
                        actions.open({
                          title: `Ghi nhận thu hoạch ${r.TrayCode}`,
                          path: `/trays/${r.TrayId}/harvest`,
                          message:
                            'Ghi kết quả vào lịch thu hoạch đang chờ của khay. Không thể sửa kết quả qua API hiện tại.',
                          fields: [
                            {
                              name: 'weightKg',
                              label: 'Khối lượng (kg)',
                              type: 'number',
                              step: '0.01',
                              min: 0,
                              max: 9999,
                              required: true,
                            },
                            {
                              name: 'quality',
                              label: 'Chất lượng',
                              options: ['A', 'B', 'C'].map((s) => option(s, s)),
                              required: true,
                            },
                            {
                              name: 'note',
                              label: 'Ghi chú',
                              type: 'textarea',
                              maxLength: 500,
                            },
                          ],
                        })
                      }
                    >
                      Ghi nhận
                    </button>
                    <button
                      onClick={() =>
                        actions.open({
                          title: `Đổi lịch thu hoạch ${r.TrayCode}`,
                          path: '/harvests',
                          message: `Lịch hiện tại: ${date(r.ScheduledDate)}. Khách thuê nhận thông báo ngày mới.`,
                          submitLabel: 'Đổi lịch',
                          fields: [dateField(String(r.ScheduledDate || '').slice(0, 10)), noteField],
                          check: futureDate,
                          body: (values) => ({
                            trayId: r.TrayId,
                            scheduledDate: values.scheduledDate,
                            note: values.note.trim() || undefined,
                          }),
                        })
                      }
                    >
                      Đổi lịch
                    </button>
                    <button
                      className="wa-text-danger"
                      onClick={() =>
                        actions.open({
                          title: `Hủy lịch thu hoạch ${r.TrayCode}`,
                          path: `/harvests/${r.HarvestId}/cancel`,
                          method: 'PATCH',
                          danger: true,
                          submitLabel: 'Hủy lịch',
                          message:
                            'Hủy lịch đang chờ (ví dụ khay chậm phát triển). Muốn thu hoạch sau này cần lập lịch lại.',
                          fields: [{ ...noteField, label: 'Lý do' }],
                          body: (values) => ({ note: values.note.trim() || undefined }),
                        })
                      }
                    >
                      Hủy lịch
                    </button>
                    </div>
                  ) : (
                    'Đã kết thúc xử lý'
                  ),
                ),
              ]}
            />
          </div>
        </LoadState>
      )}
      {actions.dialog}
    </Page>
  );
}
export function Deliveries() {
  const [status, setStatus] = useState('');
  const resource = useQuery(query('/deliveries', { status }));
  const actions = useActions(resource.reload);
  return (
    <Page
      title="Giao nhận"
      description="Xử lý yêu cầu nhận tại trại hoặc giao tận nơi đã có trong hệ thống."
      actions={<button onClick={resource.reload}>Làm mới</button>}
    >
      <Notice success={actions.success} />
      <Filters
        fields={[
          {
            name: 'status',
            label: 'Trạng thái',
            options: Object.keys(deliveryNext).map((s) => option(s)),
          },
        ]}
        values={{ status }}
        onChange={(_, value) => setStatus(value)}
      />
      <LoadState resource={resource}>
        <div className="wa-card">
          <Table
            rows={resource.payload?.data || []}
            rowKey="RequestId"
            columns={[
              col('RequestId', 'Mã yêu cầu'),
              col('TrayCode', 'Khay'),
              col('CustomerName', 'Khách hàng'),
              col('RequestType', 'Hình thức'),
              col('Address', 'Địa chỉ'),
              col('ReceiverPhone', 'Điện thoại'),
              col('WeightKg', 'Khối lượng (kg)'),
              col('Fee', 'Phí', (r) => vnd(r.Fee)),
              col('PreferredDate', 'Ngày mong muốn', (r) =>
                date(r.PreferredDate),
              ),
              col('Status', 'Trạng thái'),
              col('action', 'Thao tác', (r) =>
                deliveryNext[r.Status]?.length ? (
                  <button
                    onClick={() =>
                      actions.open({
                        title: `Cập nhật giao nhận #${r.RequestId}`,
                        path: `/deliveries/${r.RequestId}/status`,
                        method: 'PATCH',
                        message:
                          'Xác nhận thay đổi trạng thái và gửi thông báo trong hệ thống cho khách.',
                        fields: [
                          {
                            name: 'status',
                            label: 'Trạng thái tiếp theo',
                            required: true,
                            options: deliveryNext[r.Status].map((s) =>
                              option(s),
                            ),
                          },
                        ],
                      })
                    }
                  >
                    Cập nhật trạng thái
                  </button>
                ) : (
                  'Không còn bước tiếp theo'
                ),
              ),
            ]}
          />
        </div>
      </LoadState>
      {actions.dialog}
    </Page>
  );
}
