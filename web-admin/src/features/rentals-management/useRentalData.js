import { useEffect, useState } from 'react';
import { useRentals } from './RentalsManagementProvider.jsx';

export function useRentalData(path, { enabled = true, detail = false } = {}) {
  const { allowed, request } = useRentals();
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState({ key: null, payload: null, error: null, loading: true });
  const key = `${path}|${revision}|${detail}`;
  useEffect(() => {
    if (!allowed || !enabled) return;
    const abort = new AbortController();
    let current = true;
    setSnapshot({ key, payload: null, error: null, loading: true });
    request(path, { signal: abort.signal }).then((payload) => {
      const data = payload?.data;
      if (detail ? !data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.trays) || !Array.isArray(data.payments) : !Array.isArray(data)) {
        throw new Error('Dữ liệu máy chủ trả về không đúng định dạng.');
      }
      if (current) setSnapshot({ key, payload, error: null, loading: false });
    }).catch((error) => {
      if (current) setSnapshot({ key, payload: null, error, loading: false });
    });
    return () => { current = false; abort.abort(); };
  }, [allowed, enabled, path, detail, request, key]);
  return {
    ...(enabled && allowed && snapshot.key === key ? snapshot : { payload: null, error: null, loading: enabled && allowed }),
    reload: () => setRevision((number) => number + 1),
  };
}
