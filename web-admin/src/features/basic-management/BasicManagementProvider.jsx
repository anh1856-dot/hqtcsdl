import React, { createContext, useContext, useMemo } from 'react';
import { createBasicManagementClient } from './apiClient.mjs';

const ManagementContext = createContext(null);

/** apiClient.request must return { data, pagination? } and reject with error.status. */
export function BasicManagementProvider({ currentUser, apiClient, baseUrl, getToken, onUnauthorized, children }) {
  const userId = currentUser?.id ?? currentUser?.UserId;
  const role = currentUser?.role ?? currentUser?.Role;
  const client = useMemo(
    () => apiClient || createBasicManagementClient({ baseUrl, getToken }),
    [apiClient, baseUrl, getToken],
  );
  const value = useMemo(() => ({
    userId,
    role,
    async request(path, options) {
      try {
        return await client.request(path, options);
      } catch (error) {
        if (error.status === 401) onUnauthorized?.(error);
        throw error;
      }
    },
  }), [client, userId, role, onUnauthorized]);

  // Remount when identity/role changes so data and open forms cannot cross sessions.
  return <ManagementContext.Provider value={value}>
    <React.Fragment key={`${userId ?? 'guest'}:${role ?? 'guest'}`}>{children}</React.Fragment>
  </ManagementContext.Provider>;
}

export function useBasicManagement() {
  const value = useContext(ManagementContext);
  if (!value) throw new Error('Các trang quản lý cần được bọc bởi BasicManagementProvider.');
  return value;
}
