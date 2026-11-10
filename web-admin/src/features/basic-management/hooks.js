import { useCallback, useEffect, useRef, useState } from 'react';
import { useBasicManagement } from './BasicManagementProvider.jsx';

export function useList(path, enabled = true) {
  const { request } = useBasicManagement();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ path: null, data: null, loading: true, error: null });
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    setState({ path, data: null, loading: true, error: null });
    request(path, { signal: controller.signal }).then((payload) => {
      if (!Array.isArray(payload.data)) throw new Error('Danh sách từ máy chủ không đúng định dạng.');
      if (active) setState({ path, data: payload, loading: false, error: null });
    }).catch((error) => {
      if (active && error.name !== 'AbortError') setState({ path, data: null, loading: false, error });
    });
    return () => { active = false; controller.abort(); };
  }, [path, enabled, request, version]);
  return { ...(state.path === path ? state : { data: null, loading: true, error: null }), reload };
}

export function useMutation() {
  const { request } = useBasicManagement();
  const locked = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run(path, options, onSuccess) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await request(path, options);
      if (mounted.current) onSuccess();
    } catch (failure) {
      if (mounted.current) setError(failure);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { run, busy, error, clearError: () => setError(null) };
}
