import { useCallback, useEffect, useState } from 'react';
import { useSession } from './session.jsx';

/** Sequential polling: waits for completion, pauses in hidden tabs, cancels on navigation. */
export function useQuery(path, { poll = 0, enabled = true } = {}) {
  const { api } = useSession();
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState({
    path: null,
    payload: null,
    error: null,
    loading: true,
    updatedAt: null,
  });
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!enabled || !path) return;
    let alive = true,
      timer,
      running = false;
    const controller = new AbortController();
    setSnapshot({
      path,
      payload: null,
      error: null,
      loading: true,
      updatedAt: null,
    });
    async function load() {
      if (!alive || running) return;
      if (document.hidden && poll) {
        timer = setTimeout(load, poll);
        return;
      }
      running = true;
      try {
        const payload = await api.request(path, { signal: controller.signal });
        if (alive)
          setSnapshot({
            path,
            payload,
            error: null,
            loading: false,
            updatedAt: new Date(),
          });
      } catch (error) {
        if (alive && error.name !== 'AbortError')
          setSnapshot({
            path,
            payload: null,
            error,
            loading: false,
            updatedAt: null,
          });
      } finally {
        running = false;
        if (alive && poll) timer = setTimeout(load, poll);
      }
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, path, revision, enabled, poll]);
  return {
    ...(snapshot.path === path && enabled
      ? snapshot
      : { payload: null, error: null, loading: enabled, updatedAt: null }),
    reload,
  };
}
