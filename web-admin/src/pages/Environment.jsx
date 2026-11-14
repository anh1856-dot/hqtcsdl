import React, { useState } from 'react';
import { useQuery } from '../shared/data.jsx';
import {
  col,
  Filters,
  LoadState,
  Notice,
  option,
  Page,
  Pager,
  Table,
  Updated,
  useActions,
} from '../shared/Workbench.jsx';
import { query, timestamp } from '../shared/model.mjs';
import { LineChart } from '../shared/Chart.jsx';
import { environmentColumns } from './Overview.jsx';

export function Environment() {
  const resource = useQuery('/environment', { poll: 30000 });
  const rooms = useQuery('/rooms');
  const [history, setHistory] = useState({
    roomId: '',
    hours: '24',
    groupBy: 'hour',
  });
  const timeline = useQuery(
    query(`/environment/${history.roomId}/history`, {
      hours: history.hours,
      groupBy: history.groupBy,
    }),
    { enabled: Boolean(history.roomId), poll: 60000 },
  );
  return (
    <Page
      title="Môi trường"
      description="Nhiệt độ, độ ẩm và CO₂. Không có số đo khác với dữ liệu cũ; cập nhật khi tab đang hiển thị."
      actions={
        <button
          onClick={() => {
            resource.reload();
            timeline.reload();
          }}
        >
          Làm mới
        </button>
      }
    >
      <LoadState resource={resource}>
        <Updated at={resource.updatedAt} />
        <div className="wa-card">
          <Table
            rows={resource.payload?.data || []}
            columns={environmentColumns}
            rowKey="RoomId"
          />
        </div>
      </LoadState>
      <section className="wa-card">
        <h2>Lịch sử môi trường</h2>
        <Notice error={rooms.error} retry={rooms.reload} />
        <div className="wa-filters">
          <label>
            Phòng nuôi
            <select
              aria-label="Phòng xem lịch sử"
              value={history.roomId}
              onChange={(e) =>
                setHistory((v) => ({ ...v, roomId: e.target.value }))
              }
            >
              <option value="">Chọn phòng</option>
              {(rooms.payload?.data || []).map((r) => (
                <option key={r.RoomId} value={r.RoomId}>
                  {r.RoomName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Khoảng thời gian
            <select
              aria-label="Khoảng thời gian"
              value={history.hours}
              onChange={(e) =>
                setHistory((v) => ({ ...v, hours: e.target.value }))
              }
            >
              {[
                ['24', '24 giờ'],
                ['72', '3 ngày'],
                ['168', '7 ngày'],
                ['2160', '90 ngày'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nhóm số đo
            <select
              aria-label="Nhóm số đo"
              value={history.groupBy}
              onChange={(e) =>
                setHistory((v) => ({ ...v, groupBy: e.target.value }))
              }
            >
              <option value="none">Từng thời điểm</option>
              <option value="hour">Trung bình theo giờ</option>
              <option value="day">Trung bình theo ngày</option>
            </select>
          </label>
        </div>
        {!history.roomId ? (
          <p className="wa-empty">Chọn phòng để xem biểu đồ.</p>
        ) : (
          <LoadState resource={timeline}>
            <Updated at={timeline.updatedAt} />
            <p className="wa-muted">
              API giới hạn tối đa 2.000 mốc; hãy nhóm theo giờ/ngày khi xem
              khoảng dài. Khoảng thiếu số đo không được thay bằng số 0.
            </p>
            <div className="wa-chart-grid">
              {[
                ['Temperature', 'Nhiệt độ', '°C'],
                ['Humidity', 'Độ ẩm', '%'],
                ['CO2', 'CO₂', 'ppm'],
              ].map(([metric, title, unit]) => (
                <LineChart
                  key={metric}
                  rows={timeline.payload?.data || []}
                  metric={metric}
                  title={title}
                  unit={unit}
                />
              ))}
            </div>
            <Table
              rows={timeline.payload?.data || []}
              columns={[
                col('Time', 'Thời điểm', (r) => timestamp(r.Time)),
                col('Temperature', 'Nhiệt độ (°C)'),
                col('Humidity', 'Độ ẩm (%)'),
                col('CO2', 'CO₂ (ppm)'),
              ]}
            />
          </LoadState>
        )}
      </section>
    </Page>
  );
}
export function Alerts() {
  const [filters, setFilters] = useState({
    roomId: '',
    status: '',
    severity: '',
    page: 1,
  });
  const resource = useQuery(query('/alerts', filters), { poll: 30000 });
  const rooms = useQuery('/rooms');
  const actions = useActions(resource.reload);
  return (
    <Page
      title="Cảnh báo môi trường"
      description="Tiếp nhận hoặc xử lý cảnh báo do hệ thống ghi nhận."
      actions={<button onClick={resource.reload}>Làm mới</button>}
    >
      <Notice success={actions.success} />
      <Notice error={rooms.error} retry={rooms.reload} />
      <Filters
        fields={[
          {
            name: 'roomId',
            label: 'Phòng',
            options: (rooms.payload?.data || []).map((r) =>
              option(r.RoomId, r.RoomName),
            ),
          },
          {
            name: 'status',
            label: 'Trạng thái',
            options: ['Open', 'Acknowledged', 'Resolved'].map((s) => option(s)),
          },
          {
            name: 'severity',
            label: 'Mức độ',
            options: ['Warning', 'Critical'].map((s) => option(s)),
          },
        ]}
        values={filters}
        onChange={(key, value) =>
          setFilters((v) => ({ ...v, [key]: value, page: 1 }))
        }
      />
      <LoadState resource={resource}>
        <Updated at={resource.updatedAt} />
        <div className="wa-card">
          <Table
            rows={resource.payload?.data || []}
            rowKey="AlertId"
            columns={[
              col('RoomName', 'Phòng'),
              col('Metric', 'Chỉ số'),
              col('Value', 'Giá trị'),
              col('Severity', 'Mức độ'),
              col('Message', 'Nội dung'),
              col('CreatedAt', 'Ghi nhận', (r) => timestamp(r.CreatedAt)),
              col('Status', 'Trạng thái'),
              col(
                'action',
                'Thao tác',
                (r) =>
                  r.Status !== 'Resolved' && (
                    <div className="wa-row-actions">
                      {(r.Status === 'Open'
                        ? ['Acknowledged', 'Resolved']
                        : ['Resolved']
                      ).map((status) => (
                        <button
                          key={status}
                          onClick={() =>
                            actions.open({
                              title:
                                status === 'Acknowledged'
                                  ? `Tiếp nhận cảnh báo #${r.AlertId}`
                                  : `Xử lý cảnh báo #${r.AlertId}`,
                              path: `/alerts/${r.AlertId}`,
                              method: 'PATCH',
                              message: r.Message,
                              body: () => ({ status }),
                            })
                          }
                        >
                          {status === 'Acknowledged' ? 'Tiếp nhận' : 'Đã xử lý'}
                        </button>
                      ))}
                    </div>
                  ),
              ),
            ]}
          />
          <Pager
            page={filters.page}
            total={resource.payload?.pagination?.total}
            onPage={(page) => setFilters((v) => ({ ...v, page }))}
          />
        </div>
      </LoadState>
      {actions.dialog}
    </Page>
  );
}
