import { useState, useEffect, useRef } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonInputPasswordToggle,
  IonButton,
  IonText,
  IonToast,
  IonCheckbox,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import { fingerPrintOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import marcaTickets from '../images/MARCA_TICKETS.png';
import './Home.css';
import axios from 'axios';
import {
  biometriaDisponible,
  hayCredencialesGuardadas,
  guardarCredencialesBiometricas,
  obtenerCredencialesBiometricas,
} from '../utils/biometricAuth';
import { useAppLock } from '../context/AppLockContext';
import { inicializarNotificaciones } from '../utils/pushNotifications';

const Home: React.FC = () => {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [guardarSesion, setGuardarSesion] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();
  const { unlock } = useAppLock();

  /* ── Huella digital ── */
  const [biometriaLista, setBiometriaLista] = useState(false);
  const [verificandoHuella, setVerificandoHuella] = useState(false);
  const autoIntentado = useRef(false);

  const loginConCredenciales = async (usuarioIn: string, contrasenaIn: string, guardar: boolean) => {
    setCargando(true);
    setError('');
    try {
      const { data } = await axios.post(
        'https://api.t-ickets.com/ms_login/api/v1/auth_suscriptor',
        { email: usuarioIn, password: contrasenaIn },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
          },
        }
      );
      if (data.success == true && data.data) {
        localStorage.setItem('userData', JSON.stringify(data.data));
        if (guardar) await guardarCredencialesBiometricas(usuarioIn, contrasenaIn);
        inicializarNotificaciones();
        unlock();
        history.replace('/dashboard');
      } else {
        setError('Credenciales incorrectas');
      }
    } catch {
      setError('No se pudo conectar. Verifica tus datos e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const iniciarSesion = () => {
    if (!usuario || !contrasena) {
      setError('Ingresa tu usuario y contraseña');
      return;
    }
    loginConCredenciales(usuario, contrasena, guardarSesion);
  };

  const ingresarConHuella = async () => {
    setVerificandoHuella(true);
    setError('');
    try {
      const creds = await obtenerCredencialesBiometricas();
      if (creds) await loginConCredenciales(creds.usuario, creds.contrasena, true);
    } finally {
      setVerificandoHuella(false);
    }
  };

  /* Si ya se guardó un inicio de sesión con huella en este dispositivo,
     ofrecer (y disparar automáticamente) el desbloqueo por huella al abrir la app. */
  useEffect(() => {
    (async () => {
      const disponible = await biometriaDisponible();
      const guardado = disponible && (await hayCredencialesGuardadas());
      setBiometriaLista(guardado);
      if (guardado && !autoIntentado.current) {
        autoIntentado.current = true;
        ingresarConHuella();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen className="login-content">
        <div className="login-container">
          <div className="logo-wrapper">
            <img src={marcaTickets} alt="Tickets Ecuador" className="logo" />
          </div>

          <div className="form-card">
            <h2 className="form-title">Iniciar Sesión</h2>

            {biometriaLista && (
              <IonButton
                expand="block"
                fill="outline"
                className="btn-huella"
                onClick={ingresarConHuella}
                disabled={verificandoHuella || cargando}
              >
                {verificandoHuella
                  ? <><IonSpinner name="crescent" className="btn-spinner" /> Verificando…</>
                  : <><IonIcon icon={fingerPrintOutline} slot="start" /> Ingresar con huella</>
                }
              </IonButton>
            )}

            <IonInput
              className="login-input"
              label="Usuario"
              labelPlacement="floating"
              fill="outline"
              type="text"
              autocomplete="username"
              value={usuario}
              onIonChange={(e) => setUsuario(e.detail.value!)}
            />

            <IonInput
              className="login-input"
              label="Contraseña"
              labelPlacement="floating"
              fill="outline"
              type="password"
              autocomplete="current-password"
              value={contrasena}
              onIonChange={(e) => setContrasena(e.detail.value!)}
            >
              <IonInputPasswordToggle slot="end" />
            </IonInput>

            <IonCheckbox
              className="login-checkbox"
              checked={guardarSesion}
              onIonChange={(e) => setGuardarSesion(e.detail.checked)}
            >
              Guardar mi inicio de sesión (ingresar luego con huella)
            </IonCheckbox>

            <IonButton
              expand="block"
              className="btn-login"
              onClick={iniciarSesion}
              disabled={cargando}
            >
              {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
            </IonButton>

            <div className="register-row">
              <IonText color="medium" className="register-text">
                ¿No tienes cuenta?
              </IonText>
              <IonButton fill="clear" size="small" routerLink="/register" className="btn-crear">
                Crear cuenta
              </IonButton>
            </div>
          </div>
        </div>

        <IonToast
          isOpen={!!error}
          message={error}
          duration={3000}
          color="danger"
          position="bottom"
          onDidDismiss={() => setError('')}
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;
