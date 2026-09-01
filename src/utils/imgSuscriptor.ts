import axios from 'axios';
import { MS_LOGIN_AUTH_HEADERS } from './msLoginAuth';

/* Foto de perfil del suscriptor — mismos endpoints que usa TicketsWeb
   (Listaregistro/index.js -> subirFotoPerfil/quitarFotoPerfil):
   - consultar_cedula: trae img_suscriptor guardada (SELECT * incluye la columna)
   - imgSuscriptor: guarda/quita la url (img_suscriptor: null la quita)
   - codigomarret.online/upload/api/img: mismo servicio de subida que usa
     la web (Querypanel.js -> Obtenerlinkimagen) y que ya usa esta app
     para el comprobante de depósito (Pago.tsx). */

const API_HDR = { ...MS_LOGIN_AUTH_HEADERS, 'Content-Type': 'application/json' };
const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

export const obtenerImgSuscriptor = async (cedula: string): Promise<string | null> => {
  try {
    const { data } = await axios.post(
      `${URL_BASE}/consultar_cedula`,
      { cedula, email: '' },
      { headers: API_HDR }
    );
    return data?.success ? (data.data?.img_suscriptor ?? null) : null;
  } catch {
    return null;
  }
};

export const actualizarImgSuscriptor = async (
  cedula: string,
  img_suscriptor: string | null
): Promise<{ success: boolean; message?: string }> => {
  try {
    const { data } = await axios.post(
      `${URL_BASE}/imgSuscriptor`,
      { cedula, img_suscriptor },
      { headers: API_HDR }
    );
    return { success: !!data?.success, message: data?.message };
  } catch {
    return { success: false, message: 'Error de conexión.' };
  }
};

export const subirImagenPerfil = async (blob: Blob, nombreArchivo: string): Promise<string | null> => {
  try {
    const form = new FormData();
    form.append('file', blob, nombreArchivo);
    const { data } = await axios.post('https://codigomarret.online/upload/api/img', form);
    return data?.success ? (data.url || null) : null;
  } catch {
    return null;
  }
};
