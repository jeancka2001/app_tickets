import axios from 'axios';
import { MS_LOGIN_AUTH_HEADERS } from './msLoginAuth';

/* Misma consulta que usa TicketsWeb (ConfiguracionPagosQuery.ListarMetodosPagoActivos,
   leída en ModalFormasPago.js/ModalPago.js) para saber qué pasarelas están
   activas y su comisión bancaria configurada desde el panel admin. Así, si
   un admin desactiva una pasarela o cambia su % de comisión en la web, la
   app refleja el cambio de inmediato (no hay caché local, igual que en la web).

   Se manda codigoEvento igual que hace la web: el backend, si existe una
   fila en configuracion_pagos_evento para ese método + evento (sección
   "Comisión por evento" del panel admin), la usa en vez de la comisión
   global del método — sin codigoEvento el backend solo devuelve la global. */

const API_HDR = MS_LOGIN_AUTH_HEADERS;
const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

export interface MetodoPagoActivo {
  metodo: string;
  activo: boolean;
  comision_porcentaje: number;
}

export const obtenerMetodosPagoActivos = async (codigoEvento?: string): Promise<MetodoPagoActivo[]> => {
  try {
    const { data } = await axios.get(`${URL_BASE}/metodos_pago_activos`, {
      headers: API_HDR,
      params: codigoEvento ? { codigoEvento } : undefined,
    });
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
};
