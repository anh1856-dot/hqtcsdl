import React, { useState } from 'react';
import { useQuery } from '../shared/data.jsx';
import { useSession } from '../shared/session.jsx';
import { query, timestamp } from '../shared/model.mjs';
import {
  col,
  Filters,
  LoadState,
  Notice,
  option,
  Page,
  Pager,
  Table,
  useActions,
} from '../shared/Workbench.jsx';

export function Notifications() {
  const [filters, setFilters] = useState({ unreadOnly: 'false', page: 1 });
  const resource = useQuery(query('/notifications', filters), { poll: 30000 });
  const actions = useActions(() => {
    setFilters((v) => ({ ...v, page: 1 }));
    resource.reload();
    window.dispatchEvent(new Event('mushroom-notifications-changed'));
  });
  return (
    <Page
      title="Thông báo"
      description="Thông báo trong ứng dụng từ API; chưa có dịch vụ push hoặc email."
      actions={
        <>
          <button onClick={resource.reload}>Làm mới</button>
          <button
            disabled={!resource.payload?.unreadCount}
            onClick={() =>
              actions.open({
                title: 'Đánh dấu tất cả đã đọc',
                path: '/notifications/read-all',
                method: 'PATCH',
                message: 'Đánh dấu mọi thông báo chưa đọc của tài khoản này.',
              })
            }
          >
            Đọc tất cả
          </button>
        </>
      }
    >
      <Notice success={actions.success} />
      <label className="wa-checkbox">
        <input
          type="checkbox"
          checked={filters.unreadOnly === 'true'}
          onChange={(e) =>
            setFilters({ unreadOnly: String(e.target.checked), page: 1 })
          }
        />{' '}
        Chỉ thông báo chưa đọc
      </label>
      <LoadState resource={resource}>
        <p className="wa-muted">
          {resource.payload?.unreadCount ?? '—'} thông báo chưa đọc
        </p>
        <div className="wa-card">
          <Table
            rows={resource.payload?.data || []}
            rowKey="NotificationId"
            columns={[
              col('Title', 'Tiêu đề'),
              col('Type', 'Loại'),
              col('Content', 'Nội dung'),
              col('CreatedAt', 'Thời điểm', (r) => timestamp(r.CreatedAt)),
              col('IsRead', 'Đã đọc'),
              col('action', 'Thao tác', (r) => (
                <div className="wa-row-actions">
                  {!r.IsRead && (
                    <button
                      onClick={() =>
                        actions.open({
                          title: 'Đánh dấu đã đọc',
                          path: `/notifications/${r.NotificationId}/read`,
                          method: 'PATCH',
                          message: r.Title,
                        })
                      }
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                  <button
                    className="wa-text-danger"
                    onClick={() =>
                      actions.open({
                        title: 'Xóa thông báo',
                        path: `/notifications/${r.NotificationId}`,
                        method: 'DELETE',
                        danger: true,
                        message: r.Title,
                      })
                    }
                  >
                    Xóa
                  </button>
                </div>
              )),
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
export function Settings() {
  const { user } = useSession();
  const preferences = useQuery('/notifications/preferences');
  const system = useQuery('/notifications/settings', {
    enabled: user.Role === 'Admin',
  });
  const actions = useActions(() => {
    preferences.reload();
    system.reload();
  });
  return (
    <Page
      title="Cấu hình"
      description="Tùy chọn thông báo cá nhân và cấu hình quản trị."
      actions={
        <button
          onClick={() => {
            preferences.reload();
            system.reload();
          }}
        >
          Làm mới
        </button>
      }
    >
      <Notice success={actions.success} />
      <section className="wa-card">
        <h2>Thông báo cá nhân</h2>
        <p className="wa-muted">
          Cảnh báo môi trường vẫn luôn gửi cho Admin/Operator theo chính sách
          backend.
        </p>
        <LoadState resource={preferences}>
          <Table
            rows={preferences.payload?.data || []}
            rowKey="Type"
            columns={[
              col('DisplayName', 'Loại thông báo'),
              col('SystemEnabled', 'Hệ thống cho phép'),
              col('UserEnabled', 'Cá nhân đã bật'),
              col('action', 'Thao tác', (r) => (
                <button
                  onClick={() =>
                    actions.open({
                      title: `${r.UserEnabled ? 'Tắt' : 'Bật'} tùy chọn cá nhân`,
                      path: '/notifications/preferences',
                      method: 'PUT',
                      message: r.DisplayName,
                      body: () => ({ type: r.Type, isEnabled: !r.UserEnabled }),
                    })
                  }
                >
                  {r.UserEnabled ? 'Tắt' : 'Bật'}
                </button>
              )),
            ]}
          />
        </LoadState>
      </section>
      {user.Role === 'Admin' && (
        <>
          <section className="wa-card">
            <h2>Thông báo toàn hệ thống</h2>
            <LoadState resource={system}>
              <Table
                rows={system.payload?.data || []}
                rowKey="Type"
                columns={[
                  col('DisplayName', 'Loại'),
                  col('IsEnabled', 'Đã bật'),
                  col('UpdatedBy', 'Cập nhật bởi'),
                  col('UpdatedAt', 'Thời điểm', (r) => timestamp(r.UpdatedAt)),
                  col('action', 'Thao tác', (r) => (
                    <button
                      onClick={() =>
                        actions.open({
                          title: `${r.IsEnabled ? 'Tắt' : 'Bật'} thông báo toàn hệ thống`,
                          path: `/notifications/settings/${encodeURIComponent(r.Type)}`,
                          method: 'PUT',
                          message: r.DisplayName,
                          body: () => ({ isEnabled: !r.IsEnabled }),
                        })
                      }
                    >
                      {r.IsEnabled ? 'Tắt' : 'Bật'}
                    </button>
                  )),
                ]}
              />
            </LoadState>
          </section>
          <Thresholds />
        </>
      )}
      {actions.dialog}
    </Page>
  );
}
function Thresholds() {
  const rooms = useQuery('/rooms');
  const [roomId, setRoomId] = useState('');
  const thresholds = useQuery(`/rooms/${roomId}/thresholds`, {
    enabled: Boolean(roomId),
  });
  const actions = useActions(thresholds.reload);
  function edit() {
    const metrics = [
      ['Temperature', 'Nhiệt độ (°C)'],
      ['Humidity', 'Độ ẩm (%)'],
      ['CO2', 'CO₂ (ppm)'],
    ];
    const fields = metrics.flatMap(([metric, label]) =>
      ['Min', 'Max'].map((bound) => ({
        name: metric + bound,
        label: `${label} · ${bound === 'Min' ? 'Tối thiểu' : 'Tối đa'}`,
        type: 'number',
        step: '0.01',
        required: true,
        min: metric === 'Temperature' ? -99999.99 : 0,
        max: metric === 'Humidity' ? 100 : 99999.99,
        initial:
          thresholds.payload.data.find((r) => r.Metric === metric)?.[
            bound + 'Value'
          ] ?? '',
      })),
    );
    actions.open({
      title: 'Cập nhật ngưỡng môi trường',
      path: `/rooms/${roomId}/thresholds`,
      method: 'PUT',
      message:
        'Ngưỡng áp dụng cho phòng đã chọn, ảnh hưởng cảnh báo và chế độ điều khiển tự động.',
      fields,
      check: (v) =>
        Object.fromEntries(
          metrics
            .filter(([m]) => Number(v[m + 'Min']) >= Number(v[m + 'Max']))
            .map(([m]) => [
              m + 'Min',
              'Giá trị tối thiểu phải nhỏ hơn tối đa.',
            ]),
        ),
      body: (v) =>
        metrics.map(([metric]) => ({
          metric,
          minValue: Number(v[metric + 'Min']),
          maxValue: Number(v[metric + 'Max']),
        })),
    });
  }
  return (
    <section className="wa-card">
      <h2>Ngưỡng môi trường theo phòng</h2>
      <Notice success={actions.success} />
      <Notice error={rooms.error} retry={rooms.reload} />
      <Filters
        fields={[
          {
            name: 'roomId',
            label: 'Phòng cấu hình ngưỡng',
            options: (rooms.payload?.data || []).map((r) =>
              option(r.RoomId, r.RoomName),
            ),
          },
        ]}
        values={{ roomId }}
        onChange={(_, value) => setRoomId(value)}
      />
      {!roomId ? (
        <p>Chọn phòng để xem và sửa ngưỡng.</p>
      ) : (
        <LoadState resource={thresholds}>
          <Table
            rows={thresholds.payload?.data || []}
            rowKey="Metric"
            columns={[
              col('Metric', 'Chỉ số'),
              col('MinValue', 'Tối thiểu'),
              col('MaxValue', 'Tối đa'),
            ]}
          />
          <button onClick={edit}>Sửa ngưỡng</button>
        </LoadState>
      )}
      {actions.dialog}
    </section>
  );
}
