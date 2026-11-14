import React, { useEffect, useState } from 'react';
import { useSession } from '../shared/session.jsx';
import { useQuery } from '../shared/data.jsx';
import { actuators, query, timestamp } from '../shared/model.mjs';
import {
  col,
  Filters,
  LoadState,
  Modal,
  Notice,
  option,
  Page,
  Pager,
  Sheet,
  Table,
  useActions,
} from '../shared/Workbench.jsx';

const types = ['Sensor', 'MistSprayer', 'Fan', 'Heater', 'GrowLight', 'Camera'];
export function Devices() {
  const { user } = useSession();
  const [filters, setFilters] = useState({ roomId: '', type: '' });
  const [detail, setDetail] = useState(null);
  const resource = useQuery(query('/devices', filters), { poll: 30000 });
  const rooms = useQuery('/rooms');
  const trays = useQuery('/trays');
  const actions = useActions(resource.reload);
  function deviceForm(row) {
    const fields = [
      ...(!row
        ? [
            {
              name: 'deviceCode',
              label: 'Mã thiết bị',
              required: true,
              maxLength: 20,
            },
            {
              name: 'deviceType',
              label: 'Loại thiết bị',
              options: types.map((s) => option(s)),
              required: true,
            },
          ]
        : []),
      {
        name: 'deviceName',
        label: 'Tên thiết bị',
        required: true,
        maxLength: 100,
        initial: row?.DeviceName || '',
      },
      {
        name: 'roomId',
        label: 'Phòng',
        type: 'number',
        integer: true,
        min: 1,
        options: (rooms.payload?.data || []).map((r) =>
          option(r.RoomId, r.RoomName),
        ),
        required: true,
        initial: row?.RoomId || '',
      },
      {
        name: 'trayId',
        label: 'Khay camera hướng tới (tùy chọn)',
        type: 'number',
        integer: true,
        min: 1,
        options: (trays.payload?.data || []).map((t) =>
          option(t.TrayId, `${t.TrayCode} · ${t.RoomName}`),
        ),
        initial: row?.TrayId || '',
      },
      {
        name: 'streamUrl',
        label: 'URL camera',
        maxLength: 500,
        initial: row?.StreamUrl || '',
        hint: 'Chỉ camera có URL stream. RTSP lưu cấu hình được nhưng trình duyệt không phát trực tiếp.',
      },
      ...(row
        ? [
            {
              name: 'status',
              label: 'Trạng thái',
              required: true,
              initial: row.Status,
              options: ['Online', 'Offline', 'Error'].map((s) => option(s)),
            },
          ]
        : [
            {
              name: 'isSimulated',
              label: 'Thiết bị giả lập',
              type: 'checkbox',
              initial: true,
            },
          ]),
    ];
    actions.open({
      title: row ? `Sửa ${row.DeviceCode}` : 'Thêm thiết bị',
      path: row ? `/devices/${row.DeviceId}` : '/devices',
      method: row ? 'PUT' : 'POST',
      fields,
      check: (values) => {
        const errors = {};
        const type = row?.DeviceType || values.deviceType;
        if (values.streamUrl && type !== 'Camera')
          errors.streamUrl = 'Chỉ camera được gán URL stream.';
        const tray = (trays.payload?.data || []).find(
          (t) => t.TrayId === Number(values.trayId),
        );
        if (tray && tray.RoomId !== Number(values.roomId))
          errors.trayId = 'Khay phải cùng phòng với thiết bị.';
        return errors;
      },
    });
  }
  return (
    <Page
      title="Thiết bị & camera"
      description="Trạng thái được hệ thống ghi nhận; thiết bị giả lập không chứng minh phần cứng thật đã hoạt động."
      actions={
        <>
          <button onClick={resource.reload}>Làm mới</button>
          {user.Role === 'Admin' && (
            <button
              className="wa-primary"
              disabled={!rooms.payload || !trays.payload}
              onClick={() => deviceForm(null)}
            >
              Thêm thiết bị
            </button>
          )}
        </>
      }
    >
      <Notice success={actions.success} />
      <Notice error={rooms.error} retry={rooms.reload} />
      <Notice error={trays.error} retry={trays.reload} />
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
            name: 'type',
            label: 'Loại thiết bị',
            options: types.map((s) => option(s)),
          },
        ]}
        values={filters}
        onChange={(key, value) => setFilters((v) => ({ ...v, [key]: value }))}
      />
      <LoadState resource={resource}>
        <div className="wa-card">
          <Table
            rows={resource.payload?.data || []}
            rowKey="DeviceId"
            columns={[
              col('DeviceCode', 'Mã'),
              col('DeviceName', 'Tên thiết bị'),
              col('DeviceType', 'Loại'),
              col('RoomName', 'Phòng'),
              col('Status', 'Kết nối'),
              col('IsOn', 'Đang bật (hệ thống)'),
              col('AutoMode', 'Tự động'),
              col('IsSimulated', 'Giả lập'),
              col('LastSeenAt', 'Liên lạc cuối', (r) =>
                timestamp(r.LastSeenAt),
              ),
              col('action', 'Thao tác', (r) => (
                <div className="wa-row-actions">
                  <button onClick={() => setDetail(r.DeviceId)}>
                    Chi tiết
                  </button>
                  {actuators.includes(r.DeviceType) && (
                    <>
                      <button
                        disabled={r.Status !== 'Online'}
                        title="Điều khiển thủ công khi thiết bị trực tuyến; sẽ tắt chế độ tự động"
                        onClick={() =>
                          actions.open({
                            title: `${r.IsOn ? 'Tắt' : 'Bật'} ${r.DeviceName}`,
                            path: `/devices/${r.DeviceId}/control`,
                            message: `Gửi lệnh ${r.IsOn ? 'tắt' : 'bật'} và chuyển sang điều khiển thủ công. ${r.IsSimulated ? 'Đây là thiết bị giả lập.' : 'Cần kiểm tra phản hồi của phần cứng thực tế.'}`,
                            fields: [
                              {
                                name: 'reason',
                                label: 'Lý do',
                                maxLength: 255,
                              },
                            ],
                            body: (v) => ({
                              command: r.IsOn ? 'OFF' : 'ON',
                              reason: v.reason || null,
                            }),
                          })
                        }
                      >
                        {r.IsOn ? 'Tắt' : 'Bật'} thủ công
                      </button>
                      <button
                        onClick={() =>
                          actions.open({
                            title: `${r.AutoMode ? 'Tắt' : 'Bật'} chế độ tự động`,
                            path: `/devices/${r.DeviceId}/auto-mode`,
                            method: 'PATCH',
                            message: r.DeviceName,
                            body: () => ({ autoMode: !r.AutoMode }),
                          })
                        }
                      >
                        {r.AutoMode ? 'Tắt' : 'Bật'} tự động
                      </button>
                    </>
                  )}
                  {user.Role === 'Admin' && (
                    <>
                      <button
                        disabled={!rooms.payload || !trays.payload}
                        onClick={() => deviceForm(r)}
                      >
                        Sửa
                      </button>
                      <button
                        className="wa-text-danger"
                        onClick={() =>
                          actions.open({
                            title: `Xóa thiết bị ${r.DeviceCode}`,
                            path: `/devices/${r.DeviceId}`,
                            method: 'DELETE',
                            danger: true,
                            message:
                              'Thiết bị có lịch sử sẽ bị máy chủ chặn xóa. Có thể đổi trạng thái sang Ngoại tuyến thay thế.',
                          })
                        }
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              )),
            ]}
          />
        </div>
      </LoadState>
      {actions.dialog}
      {detail && (
        <Modal title="Chi tiết thiết bị" wide onClose={() => setDetail(null)}>
          <DeviceDetail id={detail} />
        </Modal>
      )}
    </Page>
  );
}
function DeviceDetail({ id }) {
  const resource = useQuery(`/devices/${id}`);
  const [page, setPage] = useState(1);
  const commands = useQuery(`/devices/${id}/commands?page=${page}`);
  const r = resource.payload?.data;
  return (
    <div className="wa-dialog-body">
      <LoadState resource={resource}>
        {r && (
          <>
            <Sheet
              record={r}
              fields={[
                ['DeviceCode', 'Mã'],
                ['DeviceName', 'Tên'],
                ['DeviceType', 'Loại'],
                ['RoomName', 'Phòng'],
                ['Status', 'Trạng thái'],
                ['IsSimulated', 'Giả lập'],
                ['IsOn', 'Đang bật (theo hệ thống)'],
                ['AutoMode', 'Chế độ tự động'],
                ['LastSeenAt', 'Liên lạc cuối', timestamp],
              ]}
            />
            {r.DeviceType === 'Camera' && <Camera source={r.StreamUrl} />}
          </>
        )}
      </LoadState>
      <h3>Lịch sử lệnh</h3>
      <LoadState resource={commands}>
        <Table
          rows={commands.payload?.data || []}
          rowKey="CommandId"
          columns={[
            col('Command', 'Lệnh'),
            col('Source', 'Nguồn'),
            col('Reason', 'Lý do'),
            col('Status', 'Trạng thái ghi nhận'),
            col('IssuedBy', 'Người gửi'),
            col('CreatedAt', 'Thời điểm', (r) => timestamp(r.CreatedAt)),
          ]}
        />
        <Pager
          page={page}
          total={commands.payload?.pagination?.total}
          onPage={setPage}
        />
      </LoadState>
    </div>
  );
}
function Camera({ source }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  let url;
  try {
    url = new URL(source);
  } catch {
    return <p className="wa-empty">Chưa có URL camera hợp lệ.</p>;
  }
  const http = ['http:', 'https:'].includes(url.protocol);
  const directVideo = /\.(mp4|webm|ogg)$/i.test(url.pathname);
  const hls =
    /\.m3u8$/i.test(url.pathname) &&
    Boolean(
      document
        .createElement('video')
        .canPlayType('application/vnd.apple.mpegurl'),
    );
  return (
    <section className="wa-camera">
      <h3>Nguồn camera đã cấu hình</h3>
      <p className="wa-muted">
        Không có video mẫu. Khả năng phát phụ thuộc nguồn, codec, quyền truy cập
        và trình duyệt.
      </p>
      {http && (directVideo || hls) && !failed ? (
        <video
          controls
          playsInline
          preload="none"
          src={source}
          onError={() => setFailed(true)}
        />
      ) : (
        <p role={failed ? 'alert' : undefined}>
          {failed
            ? 'Không phát được nguồn này. Kiểm tra máy chủ camera, codec, CORS và quyền truy cập.'
            : 'Trình duyệt này chưa có nguồn phát trực tiếp phù hợp. RTSP và HLS không được trình duyệt hỗ trợ cần dịch vụ chuyển đổi riêng; web không tự tạo proxy.'}
        </p>
      )}
      {http ? (
        <a href={source} target="_blank" rel="noreferrer">
          Mở nguồn camera trong tab khác
        </a>
      ) : (
        <p>
          Địa chỉ cấu hình: <code>{source}</code>
        </p>
      )}
    </section>
  );
}
