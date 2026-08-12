import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { fingerPrintOutline, lockClosedOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import marcaTickets from '../images/MARCA_TICKETS.png';
import { obtenerCredencialesBiometricas } from '../utils/biometricAuth';
import { useAppLock } from '../context/AppLockContext';
import './LockScreen.css';

const LockScreen: React.FC = () => {
  const { locked, unlock } = useAppLock();
  const history = useHistory();
  const [verificando, setVerificando] = useState(false);
  const intentadoAuto = useRef(false);

  const intentarHuella = async () => {
    setVerificando(true);
    try {
      /* Ya hay una sesión válida (userData); la huella solo reconfirma identidad
         para volver a mostrar el contenido, sin volver a llamar al backend. */
      const creds = await obtenerCredencialesBiometricas();
      if (creds) unlock();
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    if (locked && !intentadoAuto.current) {
      intentadoAuto.current = true;
      intentarHuella();
    }
    if (!locked) intentadoAuto.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  if (!locked) return null;

  const usarContrasena = () => {
    unlock();
    history.replace('/home');
  };

  return (
    <div className="lock-screen">
      <img src={marcaTickets} alt="T-ickets" className="lock-logo" />
      <div className="lock-card">
        <IonIcon icon={lockClosedOutline} className="lock-icon" />
        <h2 className="lock-title">Sesión bloqueada</h2>
        <p className="lock-sub">Usa tu huella para continuar</p>

        <IonButton expand="block" className="lock-btn-huella" onClick={intentarHuella} disabled={verificando}>
          {verificando
            ? <><IonSpinner name="crescent" className="btn-spinner" /> Verificando…</>
            : <><IonIcon icon={fingerPrintOutline} slot="start" /> Ingresar con huella</>
          }
        </IonButton>

        <IonButton expand="block" fill="clear" className="lock-btn-clave" onClick={usarContrasena}>
          Usar usuario y contraseña
        </IonButton>
      </div>
    </div>
  );
};

export default LockScreen;
