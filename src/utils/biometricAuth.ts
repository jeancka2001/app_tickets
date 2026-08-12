import { NativeBiometric, AccessControl } from '@capgo/capacitor-native-biometric';

/* Identificador del "servicio" bajo el cual se guardan las credenciales
   en el almacenamiento seguro del dispositivo (Keystore en Android). */
const SERVER = 'ec.tickets.app';

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

/* Guarda usuario/contraseña protegidos por huella (Android Keystore / iOS Keychain).
   No se guarda nada en localStorage: solo vive en el almacenamiento seguro del OS. */
export const guardarCredencialesBiometricas = async (usuario: string, contrasena: string): Promise<void> => {
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
  } catch (e) {
    console.warn('[biometria] setCredentials falló (dispositivo sin huella configurada?)', e);
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
