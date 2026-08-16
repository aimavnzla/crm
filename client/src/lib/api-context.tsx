import { createContext, useContext, useMemo, ReactNode } from 'react';
import { createApiClient, type ApiClient } from '../api';
import { useAuth } from './auth';

interface ApiContextType {
  api: ApiClient;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getAuthHeader } = useAuth();

  const api = useMemo(() => createApiClient(getAuthHeader), [getAuthHeader]);

  return (
    <ApiContext.Provider value={{ api }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi debe usarse dentro de ApiProvider');
  }
  return context.api;
}