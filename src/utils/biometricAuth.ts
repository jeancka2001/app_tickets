import { NativeBiometric, AccessControl } from '@capgo/capacitor-native-biometric';

/* Identificador del "servicio" bajo el cual se guardan las credenciales
   en el almacenamiento seguro del dispositivo (Keystore en Android). */
const SERVER = 'ec.ticketsEC.app';

/* Bandera NO sensible (no es la contraseña, solo un "sí/no") en localStorage.
   Sirve para saber sincrónicamente, sin llamar al plugin nativo, si hay que
   bloquear la app al pasar a segundo plano/reanudar — esa transición es muy
   corta y una llamada async al puente nativo puede no alcanzar a resolver a
   tiempo, lo que hacía que a veces no se pidiera la huella al reabrir. */
const FLAG_BIOMETRIA_ACTIVA = 'biometriaActiva';

export const biometriaActivaLocalmente = (): boolean =>
  localStorage.getItem(FLAG_BIOMETRIA_ACTIVA) === '1';

export const biometriaDisponible = async (): Promise<boolean> => {
  try {
    const r = await NativeBiometric.isAvailable({ useFallback: false });
    console.log('[biometria] isAvailable →', r);
    return r.isAvailable;
  } catch (e) {
    console.warn('[biometria] isAvailable falló', e);
    return false;
  }
};

export const hayCredencialesGuardadas = async (): Promise<boolean> => {
  try {
    const r = await NativeBiometric.isCredentialsSaved({ server: SERVER });
    console.log('[biometria] isCredentialsSaved →', r);
    return r.isSaved;
  } catch (e) {
    console.warn('[biometria] isCredentialsSaved falló', e);
    return false;
  }
};

export interface ResultadoGuardadoBiometrico {
  ok: boolean;
  /** Mensaje listo para mostrarle al usuario. Vacío si no aplica mostrar nada. */
  mensaje: string;
}

/* Traduce el código de error del plugin (ver BiometricAuthError en sus
   definitions.d.ts) a un mensaje entendible. Los códigos de "el usuario
   canceló a propósito" no generan mensaje — no hay nada que avisar ahí. */
const CODIGOS_SIN_AVISO = new Set(['11', '15', '16', '17']); // APP/SYSTEM/USER cancel, USER_FALLBACK

const MENSAJES_ERROR_BIOMETRIA: Record<string, string> = {
  '1': 'Este dispositivo no tiene sensor de huella disponible.',
  '2': 'El sensor de huella quedó bloqueado por intentos fallidos. Desbloquea tu teléfono con tu PIN o patrón e inténtalo de nuevo la próxima vez.',
  '3': 'No tienes ninguna huella configurada en este dispositivo. Actívala en Ajustes para poder usarla aquí.',
  '4': 'El sensor de huella está bloqueado temporalmente por varios intentos fallidos. Espera unos segundos e inténtalo de nuevo la próxima vez que inicies sesión.',
  '10': 'No se reconoció tu huella. Inténtalo de nuevo la próxima vez que inicies sesión.',
  '14': 'Tu teléfono no tiene PIN, patrón ni contraseña configurado, así que no se puede proteger el inicio de sesión con huella.',
};

const describirErrorGuardado = (e: unknown): ResultadoGuardadoBiometrico => {
  const code = String((e as { code?: string | number })?.code ?? '');
  if (CODIGOS_SIN_AVISO.has(code)) return { ok: false, mensaje: '' };
  const mensaje = MENSAJES_ERROR_BIOMETRIA[code]
    || 'No se pudo activar el inicio de sesión con huella. Puedes intentarlo de nuevo la próxima vez que inicies sesión.';
  return { ok: false, mensaje };
};

/* Guarda usuario/contraseña protegidos por huella (Android Keystore / iOS Keychain).
   No se guarda nada en localStorage: solo vive en el almacenamiento seguro del OS. */
export const guardarCredencialesBiometricas = async (
  usuario: string,
  contrasena: string
): Promise<ResultadoGuardadoBiometrico> => {
  try {
    await NativeBiometric.setCredentials({
      username: usuario,
      password: contrasena,
      server: SERVER,
      accessControl: AccessControl.BIOMETRY_ANY,
      title: 'Proteger inicio de sesión',
    });
    localStorage.setItem(FLAG_BIOMETRIA_ACTIVA, '1');
    console.log('[biometria] setCredentials OK');
    return { ok: true, mensaje: '' };
  } catch (e) {
    console.warn('[biometria] setCredentials falló', e);
    return describirErrorGuardado(e);
  }
};

export const eliminarCredencialesBiometricas = async (): Promise<void> => {
  localStorage.removeItem(FLAG_BIOMETRIA_ACTIVA);
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch (e) {
    console.warn('[biometria] deleteCredentials falló (no había nada guardado)', e);
  }
};

/* Dispara el prompt nativo de huella y, si el usuario se autentica,
   devuelve las credenciales guardadas. null si cancela, falla o no hay nada guardado. */
export const obtenerCredencialesBiometricas = async (): Promise<{ usuario: string; contrasena: string } | null> => {
  try {
    const creds = await NativeBiometric.getSecureCredentials({
      server: SERVER,
      reason: 'Inicia sesión en T-ickets',
      title: 'Iniciar sesión',
      subtitle: 'Usa tu huella para continuar',
      negativeButtonText: 'Usar usuario y contraseña',
    });
    return { usuario: creds.username, contrasena: creds.password };
  } catch (e) {
    console.warn('[biometria] getSecureCredentials falló/cancelado', e);
    return null;
  }
};
