export class ApiError extends Error {
  constructor(message, status = 0, code = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
export function apiBase(value = 'http://localhost:3000/api') {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      'VITE_API_BASE_URL phải là URL HTTP(S) hợp lệ, không chứa thông tin đăng nhập.',
    );
  return value.replace(/\/+$/, '');
}
export function createApi({
  baseUrl,
  getToken,
  onUnauthorized,
  fetchImpl = globalThis.fetch,
}) {
  const base = apiBase(baseUrl);
  return {
    async request(
      path,
      { method = 'GET', body, signal, download = false } = {},
    ) {
      if (
        !path.startsWith('/') ||
        path.startsWith('//') ||
        path.includes('://')
      )
        throw new ApiError('Đường dẫn API không hợp lệ.');
      const token = getToken();
      let response;
      try {
        response = await fetchImpl(base + path, {
          method,
          signal,
          headers: {
            Accept: download ? 'text/csv' : 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new ApiError(
          method === 'GET'
            ? 'Không kết nối được API. Kiểm tra backend đang chạy, URL API và cấu hình CORS.'
            : 'Chưa nhận được xác nhận. Kiểm tra dữ liệu trước khi gửi lại để tránh thao tác trùng.',
          0,
          'NETWORK',
        );
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const error = new ApiError(
          payload?.error?.message ||
            {
              401: 'Phiên đăng nhập hết hạn.',
              403: 'Bạn không có quyền thực hiện thao tác này.',
              404: 'Không tìm thấy dữ liệu.',
            }[response.status] ||
            'Yêu cầu không thành công.',
          response.status,
          payload?.error?.code,
        );
        if (response.status === 401) onUnauthorized?.();
        throw error;
      }
      if (download) {
        if (!response.headers.get('content-type')?.includes('text/csv'))
          throw new ApiError('API không trả tệp CSV hợp lệ.');
        return response.blob();
      }
      if (response.status === 204) return { data: null };
      const payload = await response.json().catch(() => null);
      if (!payload || !Object.hasOwn(payload, 'data'))
        throw new ApiError('API trả dữ liệu không đúng định dạng.');
      return payload;
    },
  };
}
