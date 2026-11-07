import React, { createContext, useContext, useMemo } from 'react';
import { createRentalsClient } from './api.mjs';
import { canManageRentals, rentalIdentity } from './model.mjs';

const RentalsContext = createContext(null);

export function RentalsManagementProvider({ currentUser, apiClient, baseUrl, getToken, onUnauthorized, children }) {
  const identity = rentalIdentity(currentUser);
  const allowed = canManageRentals(currentUser);
  const client = useMemo(() => apiClient || createRentalsClient({ baseUrl, getToken }), [apiClient, baseUrl, getToken]);
  const context = useMemo(() => ({
    allowed,
    async request(path, options) {
      try { return await client.request(path, options); }
      catch (error) { if (error.status === 401) onUnauthorized?.(error); throw error; }
    },
  }), [client, allowed, onUnauthorized]);
  return <RentalsContext.Provider value={context}>
    <React.Fragment key={`${identity.id}:${identity.role}`}>{children}</React.Fragment>
  </RentalsContext.Provider>;
}

export function useRentals() {
  const context = useContext(RentalsContext);
  if (!context) throw new Error('Hãy bọc module đơn thuê bằng RentalsManagementProvider.');
  return context;
}
