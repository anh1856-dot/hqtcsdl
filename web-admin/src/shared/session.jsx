import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createApi } from './api.mjs';

const Session = createContext(null);
const key = 'mushroom-admin.access-token';
export const useSession = () => useContext(Session);
export function SessionProvider({ children }) {
  const token = useRef(sessionStorage.getItem(key));
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(token.current));
  const [error, setError] = useState(null);
  const [revision, refresh] = useState(0);
  const logout = useCallback(() => {
    token.current = null;
    sessionStorage.removeItem(key);
    setUser(null);
    setChecking(false);
    setError(null);
  }, []);
  const api = useMemo(
    () =>
      createApi({
        baseUrl:
          import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
        getToken: () => token.current,
        onUnauthorized: logout,
      }),
    [logout],
  );
  useEffect(() => {
    if (!token.current) return;
    let alive = true;
    const controller = new AbortController();
    setChecking(true);
    setError(null);
    api
      .request('/auth/me', { signal: controller.signal })
      .then(({ data }) => {
        if (!alive) return;
        if (!['Admin', 'Operator'].includes(data.Role)) {
          logout();
          setError(new Error('Web này chỉ dành cho Admin và Operator.'));
        } else setUser(data);
      })
      .catch((failure) => {
        if (alive && failure.name !== 'AbortError') setError(failure);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [api, logout, revision]);
  const login = async (email, password) => {
    const { data } = await api.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (!['Admin', 'Operator'].includes(data.user?.Role))
      throw new Error('Web này chỉ dành cho Admin và Operator.');
    if (!data.token) throw new Error('Máy chủ không trả mã xác thực.');
    token.current = data.token;
    sessionStorage.setItem(key, data.token);
    setError(null);
    setUser(data.user);
  };
  return (
    <Session.Provider
      value={{
        user,
        api,
        checking,
        error,
        login,
        logout,
        setUser,
        retry: () => refresh((v) => v + 1),
      }}
    >
      {children}
    </Session.Provider>
  );
}
