/** Loi co ma HTTP, duoc errorHandler tra ve cho client */
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new HttpError(400, 'BAD_REQUEST', message, details);
const notFound = (message = 'Không tìm thấy dữ liệu.') => new HttpError(404, 'NOT_FOUND', message);
const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này.') => new HttpError(403, 'FORBIDDEN', message);
const conflict = (message) => new HttpError(409, 'CONFLICT', message);

/** Boc handler async de loi tu dong chuyen cho errorHandler */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Doc ?page=&pageSize= tu query string */
function getPaging(query, defaultSize = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Dong goi danh sach co phan trang. Cau SQL can tra ve cot TotalCount = COUNT(*) OVER() */
function paged(rows, { page, pageSize }) {
  const total = rows.length ? rows[0].TotalCount : 0;
  return {
    data: rows.map(({ TotalCount, ...rest }) => rest),
    pagination: { page, pageSize, total },
  };
}

module.exports = { HttpError, badRequest, notFound, forbidden, conflict, asyncHandler, getPaging, paged };
