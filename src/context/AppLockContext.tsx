import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { biometriaActivaLocalmente } from '../utils/biometricAuth';

interface AppLockCtx {
  locked: boolean;
  unlock: () => void;
}

const AppLockContext = createContext<AppLockCtx>({ locked: false, unlock: () => {} });

/* Si la app estuvo en segundo plano menos de este tiempo, se reanuda directo
   sin volver a pedir huella (evita fricción al solo cambiar de app un momento).
   Si estuvo más tiempo (o el proceso se reinició), se vuelve a pedir. */
const TOLERANCIA_SEGUNDO_PLANO_MS = 30 * 1000; // 30 segundos

/* Bloquea la app con huella (estilo banco) cada vez que vuelve a primer plano
   tras estar más de TOLERANCIA_SEGUNDO_PLANO_MS en segundo plano, siempre que
   haya sesión activa y el usuario haya guardado su login con biometría. */
export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  /* Estado inicial síncrono: si arranca un proceso nuevo con sesión + biometría
     guardadas, bloquea desde el primer render (sin parpadeo de contenido). */
  const [locked, setLocked] = useState<boolean>(() => biometriaActivaLocalmente());
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const subPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = biometriaActivaLocalmente() ? Date.now() : null;
        return;
      }
      if (backgroundedAt.current === null) return;
      const segundosFuera = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      if (segundosFuera >= TOLERANCIA_SEGUNDO_PLANO_MS && biometriaActivaLocalmente()) {
        setLocked(true);
      }
    });

    return () => { subPromise.then(h => h.remove()); };
  }, []);

  return (
    <AppLockContext.Provider value={{ locked, unlock: () => setLocked(false) }}>
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = () => useContext(AppLockContext);
