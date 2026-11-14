import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '../shared/data.jsx';
import { useSession } from '../shared/session.jsx';
import {
  col,
  Filters,
  LoadState,
  Notice,
  Page,
  Table,
  Updated,
} from '../shared/Workbench.jsx';
import {
  date,
  query,
  readingState,
  text,
  timestamp,
  vnd,
} from '../shared/model.mjs';
import { LineChart } from '../shared/Chart.jsx';

export const environmentColumns = [
  col('RoomName', 'Phòng'),
  col('Temperature', 'Nhiệt độ (°C)'),
  col('Humidity', 'Độ ẩm (%)'),
  col('CO2', 'CO₂ (ppm)'),
  col('RecordedAt', 'Ghi nhận', (r) => timestamp(r.RecordedAt)),
  col('freshness', 'Tình trạng dữ liệu', (r) => readingState(r.RecordedAt)),
  col('TempState', 'Nhiệt độ / ngưỡng', (r) =>
    r.RecordedAt && r.Temperature != null
      ? text(r.TempState)
      : 'Chưa có dữ liệu',
  ),
  col('HumState', 'Độ ẩm / ngưỡng', (r) =>
    r.RecordedAt && r.Humidity != null ? text(r.HumState) : 'Chưa có dữ liệu',
  ),
  col('CO2State', 'CO₂ / ngưỡng', (r) =>
    r.RecordedAt && r.CO2 != null ? text(r.CO2State) : 'Chưa có dữ liệu',
  ),
];
export function Dashboard() {
  const resource = useQuery('/reports/dashboard', { poll: 30000 });
  const data = resource.payload?.data;
  const cards = [
    ['ActiveRentals', 'Đơn đang thuê'],
    ['Customers', 'Khách hàng'],
    ['OpenAlerts', 'Cảnh báo chưa xử lý'],
    ['RevenueThisMonth', 'Doanh thu tháng này', vnd],
    ['HarvestKgThisMonth', 'Sản lượng tháng này (kg)'],
    ['PendingHarvests', 'Lịch thu hoạch'],
    ['PendingDeliveries', 'Giao nhận đang chờ'],
  ];
  const trayRows = data?.traysByStatus || [];
  const max = Math.max(1, ...trayRows.map((r) => r.Count));
  return (
    <Page
      title="Tổng quan trang trại"
      description="Số liệu từ hệ thống; tự làm mới mỗi 30 giây khi tab đang hiển thị."
      actions={<button onClick={resource.reload}>Làm mới</button>}
    >
      <LoadState resource={resource}>
        {data && (
          <>
            <Updated at={resource.updatedAt} />
            <div className="wa-stats">
              {cards.map(([key, label, format]) => (
                <article key={key}>
                  <span>{label}</span>
                  <strong>
                    {format ? format(data[key]) : text(data[key])}
                  </strong>
                </article>
              ))}
            </div>
            <div className="wa-card">
              <h2>Phân bố trạng thái khay</h2>
              {trayRows.length ? (
                trayRows.map((r) => (
                  <div className="wa-bar-row" key={r.Status}>
                    <span>{text(r.Status)}</span>
                    <div>
                      <i style={{ width: `${(r.Count / max) * 100}%` }} />
                    </div>
                    <strong>{r.Count}</strong>
                  </div>
                ))
              ) : (
                <p className="wa-empty">Chưa có khay.</p>
              )}
              <Link to="/trays">Quản lý khay →</Link>
            </div>
            <section className="wa-card">
              <h2>Môi trường các phòng</h2>
              <Table
                rows={data.environment || []}
                columns={environmentColumns}
                rowKey="RoomId"
              />
            </section>
            <section className="wa-card">
              <h2>Cảnh báo mới nhất</h2>
              <Table
                rows={data.latestAlerts || []}
                rowKey="AlertId"
                columns={[
                  col('RoomName', 'Phòng'),
                  col('Metric', 'Chỉ số'),
                  col('Value', 'Giá trị'),
                  col('Severity', 'Mức độ'),
                  col('Message', 'Nội dung'),
                ]}
              />
              <Link to="/alerts">Xem cảnh báo →</Link>
            </section>
          </>
        )}
      </LoadState>
    </Page>
  );
}
const reports = {
  revenue: {
    label: 'Doanh thu theo gói',
    dates: true,
    columns: [
      col('PackageName', 'Gói thuê', (r) =>
        r.PackageId == null ? 'Tổng cộng' : r.PackageName,
      ),
      col('RentalCount', 'Số đơn'),
      col('TrayCount', 'Số khay'),
      col('Revenue', 'Doanh thu', (r) => vnd(r.Revenue)),
    ],
  },
  'revenue/monthly': {
    label: 'Doanh thu theo tháng',
    columns: [
      col('Year', 'Năm'),
      col('Month', 'Tháng'),
      col('RentalCount', 'Số đơn'),
      col('TrayCount', 'Số khay'),
      col('Revenue', 'Doanh thu', (r) => vnd(r.Revenue)),
    ],
  },
  harvests: {
    label: 'Sản lượng theo tháng',
    columns: [
      col('Year', 'Năm'),
      col('Month', 'Tháng'),
      col('TypeName', 'Loại nấm'),
      col('HarvestCount', 'Lượt thu hoạch'),
      col('TotalKg', 'Tổng (kg)'),
      col('AvgKgPerTray', 'Bình quân (kg/khay)'),
    ],
  },
  rentals: {
    label: 'Đơn thuê',
    dates: true,
    columns: [
      col('RentalId', 'Mã đơn'),
      col('CustomerName', 'Khách hàng'),
      col('PackageName', 'Gói'),
      col('TrayCount', 'Số khay'),
      col('TotalAmount', 'Tổng tiền', (r) => vnd(r.TotalAmount)),
      col('StartDate', 'Bắt đầu', (r) => date(r.StartDate)),
      col('EndDate', 'Kết thúc', (r) => date(r.EndDate)),
      col('Status', 'Trạng thái'),
    ],
  },
  environment: {
    label: 'Môi trường theo ngày',
    dates: true,
    columns: [
      col('RoomName', 'Phòng'),
      col('Date', 'Ngày', (r) => date(r.Date)),
      col('AvgTemperature', 'Nhiệt độ TB (°C)'),
      col('MinTemperature', 'Nhiệt độ thấp nhất (°C)'),
      col('MaxTemperature', 'Nhiệt độ cao nhất (°C)'),
      col('AvgHumidity', 'Độ ẩm TB (%)'),
      col('AvgCO2', 'CO₂ TB (ppm)'),
      col('MaxCO2', 'CO₂ cao nhất (ppm)'),
      col('Readings', 'Số đo'),
      col('Alerts', 'Số cảnh báo'),
    ],
  },
};
export function Reports() {
  const { api } = useSession();
  const [kind, setKind] = useState('revenue');
  const [filters, setFilters] = useState({ from: '', to: '', roomId: '' });
  const [failure, setFailure] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const rooms = useQuery('/rooms');
  const config = reports[kind];
  const badDates = filters.from && filters.to && filters.from > filters.to;
  const path = query(
    '/reports/' + kind,
    config.dates
      ? {
          from: filters.from,
          to: filters.to,
          ...(kind === 'environment' ? { roomId: filters.roomId } : {}),
        }
      : {},
  );
  const resource = useQuery(path, { enabled: !badDates });
  const rows = resource.payload?.data || [];
  async function download() {
    if (downloading) return;
    setDownloading(true);
    setFailure(null);
    try {
      const blob = await api.request(
        path + (path.includes('?') ? '&' : '?') + 'format=csv',
        { download: true },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bao-cao-${kind.replace('/', '-')}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setFailure(error);
    } finally {
      setDownloading(false);
    }
  }
  return (
    <Page
      title="Báo cáo"
      description="Báo cáo chi tiết dành cho quản trị viên."
      actions={
        <>
          <button
            disabled={badDates || resource.loading || !!resource.error}
            onClick={resource.reload}
          >
            Làm mới
          </button>
          <button
            disabled={
              badDates || resource.loading || !!resource.error || downloading
            }
            onClick={download}
          >
            {downloading ? 'Đang tải…' : 'Xuất CSV'}
          </button>
        </>
      }
    >
      <label className="wa-report-kind">
        Loại báo cáo
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(reports).map(([value, c]) => (
            <option key={value} value={value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {config.dates && (
        <Filters
          fields={[
            { name: 'from', label: 'Từ ngày', type: 'date' },
            { name: 'to', label: 'Đến ngày', type: 'date' },
            ...(kind === 'environment'
              ? [
                  {
                    name: 'roomId',
                    label: 'Phòng nuôi',
                    options: (rooms.payload?.data || []).map((r) => ({
                      value: r.RoomId,
                      label: r.RoomName,
                    })),
                  },
                ]
              : []),
          ]}
          values={filters}
          onChange={(key, value) => setFilters((v) => ({ ...v, [key]: value }))}
        />
      )}
      {badDates && (
        <Notice
          error={new Error('Ngày bắt đầu phải không lớn hơn ngày kết thúc.')}
        />
      )}
      <Notice error={failure} />
      {!badDates && (
        <LoadState resource={resource}>
          <Updated at={resource.updatedAt} />
          <div className="wa-card">
            <Table rows={rows} columns={config.columns} />
          </div>
          {kind === 'revenue/monthly' && (
            <LineChart
              rows={rows.map((r) => ({
                ...r,
                Time: `${r.Year}-${String(r.Month).padStart(2, '0')}-01`,
              }))}
              metric="Revenue"
              title="Doanh thu theo tháng"
              unit="VNĐ"
            />
          )}
        </LoadState>
      )}
      {kind === 'environment' && (
        <Notice error={rooms.error} retry={rooms.reload} />
      )}
    </Page>
  );
}
