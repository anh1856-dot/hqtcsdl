export class RentalsApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'RentalsApiError';
    this.status = status;
    this.code = code;
  }
}

/** The host supplies credentials; this client does not read or write browser storage. */
export function createRentalsClient({ baseUrl = 'http://localhost:3000/api', getToken = () => null, fetchImpl = globalThis.fetch } = {}) {
  const root = baseUrl.replace(/\/+$/, '');
  return {
    async request(path, { method = 'GET', body, signal } = {}) {
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
        throw new RentalsApiError('Đường dẫn API không hợp lệ.');
      }
      const token = await getToken();
      const writing = method.toUpperCase() !== 'GET';
      let response;
      try {
        response = await fetchImpl(root + path, {
          method, signal,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new RentalsApiError(writing
          ? 'Chưa nhận được xác nhận từ máy chủ. Hãy kiểm tra danh sách đơn trước khi gửi lại để tránh tạo trùng.'
          : 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.', 0, writing ? 'UNCONFIRMED' : 'NETWORK');
      }
      const payload = response.status === 204 ? { data: null } : await response.json().catch(() => null);
      if (!response.ok) {
        const messages = {
          401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          403: 'Bạn không có quyền thực hiện thao tác này.',
          404: 'Không tìm thấy dữ liệu được yêu cầu.',
        };
        throw new RentalsApiError(payload?.error?.message || messages[response.status] || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.', response.status, payload?.error?.code);
      }
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
        throw new RentalsApiError(writing
          ? 'Máy chủ chưa trả xác nhận hợp lệ. Hãy kiểm tra danh sách đơn trước khi gửi lại.'
          : 'Dữ liệu máy chủ trả về không đúng định dạng.', response.status, writing ? 'UNCONFIRMED' : 'BAD_RESPONSE');
      }
      return payload;
    },
  };
}
