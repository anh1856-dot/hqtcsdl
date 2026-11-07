const { HttpError } = require('../utils/http');

/*
 * Loi nghiep vu tu stored procedure (THROW 50001 - 50099) -> ma HTTP.
 * Danh sach ma loi: database/03_procedures_triggers.sql
 */
const SQL_ERROR_STATUS = {
  50001: 400, // khach hang khong hop le / bi khoa
  50002: 404, // goi thue khong ton tai
  50003: 400, // so khay vuot gioi han goi
  50004: 409, // khong du khay trong
  50005: 404, // ma khay khong ton tai
  50006: 409, // khay khong san sang cho thue
  50007: 403, // khay khong thuoc don thue cua ban
  50008: 409, // khay da lien ket
  50010: 403, // khong co quyen
  50011: 404, // loai nam khong ton tai
  50012: 409, // khay khong the bat dau trong
  50013: 409, // khay khong dang trong
  50014: 400, // giai doan khong hop le
  50015: 400, // giai doan lui
  50016: 409, // chua co lich thu hoach
  50017: 400, // khoi luong khong hop le
  50020: 404, // khong tim thay dot thu hoach
  50021: 409, // da co yeu cau giao nhan
  50030: 404, // cam bien khong ton tai
  50031: 404, // thiet bi khong dieu khien duoc
  50032: 400, // lenh khong hop le
  50033: 400, // trang thai canh bao khong hop le
  50034: 404, // canh bao khong ton tai / da xu ly
  50035: 404, // loai thong bao khong ton tai
  50040: 409, // vuot suc chua phong
};

// Loi he thong SQL Server thuong gap
const SQL_SYSTEM_ERRORS = {
  2627: [409, 'DUPLICATE', 'Dữ liệu bị trùng (mã, email hoặc số điện thoại đã tồn tại).'],
  2601: [409, 'DUPLICATE', 'Dữ liệu bị trùng (mã, email hoặc số điện thoại đã tồn tại).'],
  229: [403, 'DB_PERMISSION', 'Tài khoản database không có quyền thực hiện thao tác này.'],
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  // JSON gui len sai cu phap
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Dữ liệu JSON không hợp lệ.' } });
  }

  const number = err.number || (err.originalError && err.originalError.number);
  if (number) {
    if (SQL_ERROR_STATUS[number]) {
      return res.status(SQL_ERROR_STATUS[number]).json({ error: { code: `DB_${number}`, message: err.message } });
    }
    if (SQL_SYSTEM_ERRORS[number]) {
      const [status, code, message] = SQL_SYSTEM_ERRORS[number];
      return res.status(status).json({ error: { code, message } });
    }
    if (number === 547) {
      // FK: dang duoc tham chieu (khong xoa duoc) hoac tham chieu khong ton tai; CHECK: gia tri sai
      const inUse = /REFERENCE/.test(err.message) && /DELETE/.test(err.message);
      return res.status(inUse ? 409 : 400).json({
        error: {
          code: inUse ? 'IN_USE' : 'CONSTRAINT',
          message: inUse
            ? 'Không thể xóa vì dữ liệu đang được sử dụng ở nơi khác.'
            : 'Dữ liệu không hợp lệ (vi phạm ràng buộc).',
          details: err.message,
        },
      });
    }
  }

  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại sau.' } });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Không có API ${req.method} ${req.originalUrl}` } });
}

module.exports = { errorHandler, notFoundHandler };
