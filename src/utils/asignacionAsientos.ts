import axios from 'axios';
import { MS_LOGIN_AUTH_HEADERS } from './msLoginAuth';

/* Mismos servicios que usa TicketsWeb en /asignar-asiento/:cedula/:token
   (src/utils/AsignacionAsientosQuery en ese repo) — misma API, mismo token
   fijo que ya usa el resto de esta app. La cédula+token de la URL son la
   única credencial: esta pantalla nunca lee ni escribe userData. */

const API_HDR = {
  ...MS_LOGIN_AUTH_HEADERS,
  'Content-Type': 'application/json',
};
const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

export interface AsientoAsignacion {
  id: number;
  fila: string;
  silla: string;
  estado: 'disponible' | 'ocupado' | 'reservado' | 'mio';
}

export interface LocalidadAsignacion {
  id_localidad: number;
  localidad_nombre: string;
  cantidad: number;
}

interface RespuestaBase {
  success: boolean;
  message?: string;
}

export const validarLinkAsignacion = async (
  cedula: string,
  token: string
): Promise<RespuestaBase & { localidades?: LocalidadAsignacion[] }> => {
  try {
    const { data } = await axios.get(
      `${URL_BASE}/validar_link_asignacion/${cedula}/${token}`,
      { headers: API_HDR }
    );
    return data;
  } catch {
    return { success: false, message: 'No se pudo validar el link' };
  }
};

export const obtenerMapaYVerificarAsiento = async (
  token: string,
  cedula: string,
  idLocalidad: number,
  idAsiento?: number
): Promise<RespuestaBase & { mapa?: AsientoAsignacion[]; asiento_clickeado?: { disponible?: boolean } }> => {
  try {
    const { data } = await axios.post(
      `${URL_BASE}/mapa_asignacion`,
      { token, cedula, id_localidad: idLocalidad, id_asiento: idAsiento },
      { headers: API_HDR }
    );
    return data;
  } catch {
    return { success: false, message: 'No se pudo actualizar el mapa' };
  }
};

export const seleccionarAsientoCliente = async (
  token: string,
  cedula: string,
  idAsiento: number
): Promise<RespuestaBase> => {
  try {
    const { data } = await axios.post(
      `${URL_BASE}/seleccionar_asiento_cliente`,
      { token, cedula, id_asiento: idAsiento },
      { headers: API_HDR }
    );
    return data;
  } catch {
    return { success: false, message: 'No se pudo seleccionar el asiento' };
  }
};

export const deseleccionarAsientoCliente = async (
  token: string,
  cedula: string,
  idAsiento: number
): Promise<RespuestaBase> => {
  try {
    const { data } = await axios.post(
      `${URL_BASE}/deseleccionar_asiento_cliente`,
      { token, cedula, id_asiento: idAsiento },
      { headers: API_HDR }
    );
    return data;
  } catch {
    return { success: false, message: 'No se pudo quitar el asiento' };
  }
};

export const cancelarAsignacionAsientos = async (
  token: string,
  cedula: string
): Promise<RespuestaBase> => {
  try {
    const { data } = await axios.post(
      `${URL_BASE}/cancelar_asignacion_asientos`,
      { token, cedula },
      { headers: API_HDR }
    );
    return data;
  } catch {
    return { success: false, message: 'No se pudo cancelar' };
  }
};

export const confirmarAsignacionFinal = async (
  token: string,
  cedula: string
): Promise<RespuestaBase> => {
  try {
    const { data } = await axios.post(
      `${URL_BASE}/confirmar_asignacion_final`,
      { token, cedula },
      { headers: API_HDR }
    );
    return data;
  } catch {
    return { success: false, message: 'No se pudo confirmar la asignación' };
  }
};
