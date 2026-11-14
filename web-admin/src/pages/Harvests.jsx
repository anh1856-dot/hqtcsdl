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
import { date, deliveryNext, query, timestamp, vnd } from '../shared/model.mjs';

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
  return (
    <Page
      title="Thu hoạch"
      description="Lịch và kết quả thu hoạch; ghi nhận theo khay có lịch hợp lệ."
      actions={<button onClick={resource.reload}>Làm mới</button>}
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
