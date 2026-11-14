import React, { useState } from 'react';
import { useSession } from '../shared/session.jsx';
import { useQuery } from '../shared/data.jsx';
import {
  col,
  Filters,
  LoadState,
  Modal,
  Notice,
  option,
  Page,
  Sheet,
  Table,
  useActions,
} from '../shared/Workbench.jsx';
import { date, query, stages, timestamp } from '../shared/model.mjs';

const note = {
  name: 'note',
  label: 'Ghi chú',
  type: 'textarea',
  maxLength: 1000,
};
const image = {
  name: 'imageUrl',
  label: 'URL ảnh',
  type: 'url',
  maxLength: 500,
};
const trayStates = [
  'Available',
  'Rented',
  'Growing',
  'ReadyToHarvest',
  'Harvested',
  'Maintenance',
];
export function Trays() {
  const { user } = useSession();
  const [filters, setFilters] = useState({ roomId: '', status: '', q: '' });
  const [detail, setDetail] = useState(null);
  const resource = useQuery(query('/trays', filters));
  const rooms = useQuery('/rooms');
  const types = useQuery('/mushroom-types');
  const actions = useActions(resource.reload);
  const roomOptions = (rooms.payload?.data || []).map((r) =>
    option(r.RoomId, r.RoomName),
  );
  const typeOptions = (types.payload?.data || []).map((r) =>
    option(r.MushroomTypeId, r.TypeName),
  );
  const lookupsReady = Boolean(rooms.payload && types.payload);
  const roomField = {
    name: 'roomId',
    label: 'Phòng nuôi',
    options: roomOptions,
    type: 'number',
    integer: true,
    min: 1,
    required: true,
  };
  const typeField = {
    name: 'mushroomTypeId',
    label: 'Loại nấm',
    options: typeOptions,
    type: 'number',
    integer: true,
    min: 1,
  };
  function edit(row) {
    const moveAllowed = ['Available', 'Maintenance'].includes(row.Status);
    actions.open({
      title: `Sửa khay ${row.TrayCode}`,
      path: `/trays/${row.TrayId}`,
      method: 'PUT',
      message: moveAllowed
        ? 'Có thể chuyển phòng cho khay đang trống hoặc bảo trì.'
        : 'Khay đang sử dụng; API không cho chuyển phòng. Loại nấm và vị trí vẫn theo quyền API.',
      fields: [
        ...(moveAllowed ? [{ ...roomField, initial: row.RoomId }] : []),
        { ...typeField, initial: row.MushroomTypeId || '', omitEmpty: true },
        {
          name: 'positionLabel',
          label: 'Vị trí',
          initial: row.PositionLabel || '',
          maxLength: 50,
          omitEmpty: true,
        },
      ],
    });
  }
  const columns = [
    col('TrayCode', 'Mã khay'),
    col('RoomName', 'Phòng'),
    col('TypeName', 'Loại nấm'),
    col('CustomerName', 'Khách thuê'),
    col('Status', 'Trạng thái'),
    col('Stage', 'Giai đoạn'),
    col('ExpectedHarvestDate', 'Dự kiến thu hoạch', (r) =>
      date(r.ExpectedHarvestDate),
    ),
    col('actions', 'Thao tác', (row) => (
      <div className="wa-row-actions">
        <button onClick={() => setDetail(row.TrayId)}>Chi tiết</button>
        <button disabled={!lookupsReady} onClick={() => edit(row)}>
          Sửa
        </button>
        <button
          disabled={
            !lookupsReady || !['Available', 'Rented'].includes(row.Status)
          }
          title="Chỉ bắt đầu khi khay trống hoặc đã cho thuê"
          onClick={() =>
            actions.open({
              title: `Bắt đầu trồng ${row.TrayCode}`,
              path: `/trays/${row.TrayId}/start`,
              fields: [
                {
                  ...typeField,
                  required: true,
                  initial: row.MushroomTypeId || '',
                },
                note,
              ],
            })
          }
        >
          Bắt đầu trồng
        </button>
        <button
          disabled={
            row.Status !== 'Growing' ||
            !stages.slice(stages.indexOf(row.Stage) + 1).length
          }
          title="Chỉ cập nhật tiến về trước khi khay đang trồng"
          onClick={() =>
            actions.open({
              title: `Cập nhật giai đoạn ${row.TrayCode}`,
              path: `/trays/${row.TrayId}/stage`,
              fields: [
                {
                  name: 'stage',
                  label: 'Giai đoạn mới',
                  options: stages
                    .slice(stages.indexOf(row.Stage) + 1)
                    .map((s) => option(s)),
                  required: true,
                },
                note,
                image,
              ],
            })
          }
        >
          Giai đoạn
        </button>
        <button
          disabled={!row.Stage}
          title="Khay cần có vụ trồng trước khi ghi nhật ký"
          onClick={() =>
            actions.open({
              title: `Nhật ký ${row.TrayCode}`,
              path: `/trays/${row.TrayId}/logs`,
              fields: [{ ...note, required: true }, image],
            })
          }
        >
          Ghi nhật ký
        </button>
        <button
          disabled={['Growing', 'ReadyToHarvest'].includes(row.Status)}
          title="Không đặt lại khay đang trồng hoặc chờ thu hoạch"
          onClick={() =>
            actions.open({
              title: `Đặt trạng thái ${row.TrayCode}`,
              path: `/trays/${row.TrayId}/status`,
              method: 'PATCH',
              message:
                'Thao tác xóa giai đoạn/ngày trồng hiện tại. Khay còn đơn thuê được đưa về Đã cho thuê khi chọn Còn trống.',
              fields: [
                {
                  name: 'status',
                  label: 'Trạng thái',
                  required: true,
                  options: ['Available', 'Maintenance'].map((s) => option(s)),
                },
              ],
            })
          }
        >
          Đặt trạng thái
        </button>
        {user.Role === 'Admin' && (
          <button
            className="wa-text-danger"
            onClick={() =>
              actions.open({
                title: `Xóa khay ${row.TrayCode}`,
                path: `/trays/${row.TrayId}`,
                method: 'DELETE',
                danger: true,
                message:
                  'Chỉ xóa được khay chưa có lịch sử liên quan. Máy chủ sẽ chặn nếu khay đang được sử dụng.',
              })
            }
          >
            Xóa
          </button>
        )}
      </div>
    )),
  ];
  return (
    <Page
      title="Khay & canh tác"
      description="Theo dõi khay, vụ trồng và nhật ký. Nút bị khóa có giải thích khi di chuột."
      actions={
        <>
          <button onClick={resource.reload}>Làm mới</button>
          <button
            className="wa-primary"
            disabled={!lookupsReady}
            onClick={() =>
              actions.open({
                title: 'Tạo khay',
                path: '/trays',
                fields: [
                  roomField,
                  {
                    name: 'quantity',
                    label: 'Số khay',
                    type: 'number',
                    integer: true,
                    min: 1,
                    max: 100,
                    initial: 1,
                    required: true,
                  },
                  typeField,
                  { name: 'positionLabel', label: 'Vị trí', maxLength: 50 },
                ],
              })
            }
          >
            Tạo khay
          </button>
        </>
      }
    >
      <Notice success={actions.success} />
      <Notice error={rooms.error} retry={rooms.reload} />
      <Notice error={types.error} retry={types.reload} />
      <Filters
        fields={[
          { name: 'q', label: 'Tìm mã khay hoặc tên khách' },
          { name: 'roomId', label: 'Phòng', options: roomOptions },
          {
            name: 'status',
            label: 'Trạng thái',
            options: trayStates.map((s) => option(s)),
          },
        ]}
        values={filters}
        onChange={(key, value) => setFilters((v) => ({ ...v, [key]: value }))}
      />
      <LoadState resource={resource}>
        <div className="wa-card">
          <Table
            rows={resource.payload?.data || []}
            columns={columns}
            rowKey="TrayId"
          />
        </div>
      </LoadState>
      {actions.dialog}
      {detail && (
        <Modal title="Chi tiết khay" wide onClose={() => setDetail(null)}>
          <TrayDetail id={detail} />
        </Modal>
      )}
    </Page>
  );
}
function TrayDetail({ id }) {
  const resource = useQuery(`/trays/${id}`);
  const record = resource.payload?.data;
  return (
    <div className="wa-dialog-body">
      <LoadState resource={resource}>
        {record && (
          <>
            <Sheet
              record={record}
              fields={[
                ['TrayCode', 'Mã khay'],
                ['RoomName', 'Phòng'],
                ['TypeName', 'Loại nấm'],
                ['CustomerName', 'Khách thuê'],
                ['Status', 'Trạng thái'],
                ['Stage', 'Giai đoạn'],
                ['PlantedDate', 'Ngày trồng', date],
                ['ExpectedHarvestDate', 'Dự kiến thu hoạch', date],
              ]}
            />
            <h3>Nhật ký</h3>
            <Table
              rows={record.growthLogs || []}
              columns={[
                col('Stage', 'Giai đoạn'),
                col('Note', 'Ghi chú'),
                col('ImageUrl', 'URL ảnh'),
                col('LoggedBy', 'Người ghi'),
                col('LoggedAt', 'Thời điểm', (r) => timestamp(r.LoggedAt)),
              ]}
              rowKey="LogId"
            />
            <h3>Lịch sử thu hoạch</h3>
            <Table
              rows={record.harvests || []}
              columns={[
                col('ScheduledDate', 'Lịch', (r) => date(r.ScheduledDate)),
                col('HarvestedAt', 'Thu hoạch', (r) =>
                  timestamp(r.HarvestedAt),
                ),
                col('WeightKg', 'Khối lượng (kg)'),
                col('Quality', 'Chất lượng'),
                col('Status', 'Trạng thái'),
                col('Note', 'Ghi chú'),
              ]}
              rowKey="HarvestId"
            />
          </>
        )}
      </LoadState>
    </div>
  );
}
