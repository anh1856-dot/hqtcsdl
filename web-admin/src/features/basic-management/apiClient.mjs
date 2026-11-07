export class BasicManagementApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'BasicManagementApiError';
    this.status = status;
    this.code = code;
  }
}

/** Returns the backend envelope { data, pagination? }; never stores credentials. */
export function createBasicManagementClient({
  baseUrl = 'http://localhost:3000/api',
  getToken = () => null,
  onUnauthorized,
  fetchImpl = globalThis.fetch,
} = {}) {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    async request(path, { method = 'GET', body, signal } = {}) {
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
        throw new BasicManagementApiError('Đường dẫn API không hợp lệ.');
      }
      const token = await getToken();
      let response;
      try {
        response = await fetchImpl(`${base}${path}`, {
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
        throw new BasicManagementApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
      }
      if (response.status === 204) return { data: null };
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const fallback = response.status === 403
          ? 'Bạn không có quyền thực hiện thao tác này.'
          : response.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
        const error = new BasicManagementApiError(
          payload?.error?.message || fallback, response.status, payload?.error?.code,
        );
        if (response.status === 401) onUnauthorized?.(error);
        throw error;
      }
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
        throw new BasicManagementApiError('Phản hồi từ máy chủ không đúng định dạng.', response.status);
      }
      return payload;
    },
  };
}
