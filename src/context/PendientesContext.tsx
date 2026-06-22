import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const API_HDR = {
  'authorization-ticket': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
  'Content-Type': 'application/json',
};
const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

interface PendientesCtx {
  pendientesCount: number;
  refreshPendientes: () => Promise<void>;
}

const PendientesContext = createContext<PendientesCtx>({
  pendientesCount: 0,
  refreshPendientes: async () => {},
});

const getCedula = (): string => {
  try { return JSON.parse(localStorage.getItem('userData') || '{}')?.cedula ?? ''; }
  catch { return ''; }
};

export const PendientesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendientesCount, setPendientesCount] = useState(0);

  const refreshPendientes = useCallback(async () => {
    const cedula = getCedula();
    if (!cedula) return;
    try {
      const { data } = await axios.post(
        `${URL_BASE}/listarRegistros?estado=Pendiente&init=0&size=50`,
        { cedula },
        { headers: API_HDR }
      );
      if (data.success) {
        setPendientesCount((data.data ?? []).length);
      } else {
        setPendientesCount(0);
      }
    } catch { setPendientesCount(0); }
  }, []);

  return (
    <PendientesContext.Provider value={{ pendientesCount, refreshPendientes }}>
      {children}
    </PendientesContext.Provider>
  );
};

export const usePendientes = () => useContext(PendientesContext);
