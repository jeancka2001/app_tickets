import { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonInputPasswordToggle,
  IonButton,
  IonToast,
  IonCheckbox,
  IonIcon,
  IonSpinner,
  IonAlert,
} from '@ionic/react';
import { fingerPrintOutline, personAddOutline, logInOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import marcaTickets from '../images/MARCA_TICKETS.png';
import './Home.css';
import axios from 'axios';
import {
  biometriaDisponible,
  hayCredencialesGuardadas,
  guardarCredencialesBiometricas,
  obtenerCredencialesBiometricas,
  guardadoBiometricoNoSoportado,
} from '../utils/biometricAuth';
import { useAppLock } from '../context/AppLockContext';
import { inicializarNotificaciones } from '../utils/pushNotifications';
import { MS_LOGIN_AUTH_HEADERS } from '../utils/msLoginAuth';

const Home: React.FC = () => {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [guardarSesion, setGuardarSesion] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [avisoHuella, setAvisoHuella] = useState('');
  const history = useHistory();
  const { unlock } = useAppLock();

  /* ── Huella digital ──
     Nada automático: la huella solo se pide si el cliente toca el botón
     "Huella" (debajo de usuario/contraseña) o si guarda una nueva sesión.
     Un intento automático al abrir la pantalla era poco predecible (a veces
     fallaba en frío, antes de que el sensor estuviera listo) y terminaba
     en mensajes de error confusos sin que el cliente hubiera hecho nada. */
  const [biometriaLista, setBiometriaLista] = useState(false);
  const [verificandoHuella, setVerificandoHuella] = useState(false);
  /* Credenciales recién validadas contra el servidor, en espera de que el
     cliente confirme si quiere reemplazar la huella ya guardada en este
     dispositivo (solo aplica a login manual con usuario/contraseña). */
  const [confirmarReemplazo, setConfirmarReemplazo] = useState<{ usuario: string; contrasena: string } | null>(null);

  /* ── Pantalla de carga tras iniciar sesión ──
     Un par de segundos con el logo mientras se prepara todo, en vez de
     saltar directo al dashboard — se ve más cuidado y disimula la primera
     carga real de eventos que hace la pestaña de Eventos al entrar. */
  const DURACION_CARGA_MS = 2000;
  const MENSAJES_CARGA = ['Preparando tu cuenta…', 'Cargando tus eventos…', '¡Ya casi estamos!'];
  const [mostrandoCarga, setMostrandoCarga] = useState(false);
  const [mensajeCargaIdx, setMensajeCargaIdx] = useState(0);

  useEffect(() => {
    if (!mostrandoCarga) { setMensajeCargaIdx(0); return; }
    const intervalo = setInterval(() => {
      setMensajeCargaIdx(i => (i + 1) % MENSAJES_CARGA.length);
    }, 900);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrandoCarga]);

  const finalizarLogin = (esperarMs: number) => {
    inicializarNotificaciones();
    unlock();
    setMostrandoCarga(true);
    const espera = Math.max(esperarMs, DURACION_CARGA_MS);
    setTimeout(() => history.replace('/dashboard'), espera);
  };

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
            ...MS_LOGIN_AUTH_HEADERS,
          },
        }
      );
      if (data.success == true && data.data) {
        localStorage.setItem('userData', JSON.stringify(data.data));

        if (guardar && !guardadoBiometricoNoSoportado()) {
          const yaHabiaGuardada = await hayCredencialesGuardadas();
          if (yaHabiaGuardada) {
            /* Ya hay una cuenta con huella guardada en este teléfono — no se
               sobreescribe sin preguntar (podría ser la de otra persona que
               comparte el dispositivo). La alerta de abajo decide cómo sigue. */
            setConfirmarReemplazo({ usuario: usuarioIn, contrasena: contrasenaIn });
            return;
          }
          // Primera vez en este dispositivo: se guarda directo, sin preguntar.
          const resultado = await guardarCredencialesBiometricas(usuarioIn, contrasenaIn);
          if (!resultado.ok && resultado.mensaje) {
            setAvisoHuella(resultado.mensaje);
            finalizarLogin(2600); // deja ver el aviso antes de salir de esta pantalla
            return;
          }
        }
        finalizarLogin(0);
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
      /* guardar=false: estas credenciales ya vienen del almacenamiento seguro
         del teléfono (por eso pudimos leerlas con la huella) — no hay nada
         nuevo que guardar. */
      if (creds) await loginConCredenciales(creds.usuario, creds.contrasena, false);
    } finally {
      setVerificandoHuella(false);
    }
  };

  /* Sí quiere reemplazar la huella guardada: guarda las nuevas credenciales
     (pisando las anteriores) y recién ahí entra. */
  const confirmarReemplazoSi = async () => {
    if (!confirmarReemplazo) return;
    const { usuario: u, contrasena: c } = confirmarReemplazo;
    setConfirmarReemplazo(null);
    const resultado = await guardarCredencialesBiometricas(u, c);
    if (!resultado.ok && resultado.mensaje) {
      setAvisoHuella(resultado.mensaje);
      finalizarLogin(2600);
    } else {
      finalizarLogin(0);
    }
  };

  /* No quiere reemplazarla: la huella guardada anteriormente se queda tal
     cual, y esta cuenta entra normal, sin guardarse para huella. */
  const confirmarReemplazoNo = () => {
    setConfirmarReemplazo(null);
    finalizarLogin(0);
  };

  /* Solo determina si mostrar el botón "Huella" — no dispara nada solo. */
  useEffect(() => {
    (async () => {
      const disponible = await biometriaDisponible();
      const guardado = disponible && (await hayCredencialesGuardadas());
      setBiometriaLista(guardado);
    })();
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

            <IonInput
              className="login-input"
              label="Usuario"
              labelPlacement="floating"
              fill="outline"
              type="text"
              autocomplete="username"
              value={usuario}
              onIonInput={(e) => setUsuario(e.detail.value!)}
            />

            <IonInput
              className="login-input"
              label="Contraseña"
              labelPlacement="floating"
              fill="outline"
              type="password"
              autocomplete="current-password"
              value={contrasena}
              onIonInput={(e) => setContrasena(e.detail.value!)}
            >
              <IonInputPasswordToggle slot="end" />
            </IonInput>

            <IonCheckbox
              className="login-checkbox"
              checked={guardarSesion}
              onIonChange={(e) => setGuardarSesion(e.detail.checked)}
            >
              Guardar sesión
            </IonCheckbox>

            <div className="acciones-row">
              <IonButton fill="outline" className="btn-cuadrado" routerLink="/register">
                <div className="btn-cuadrado-inner">
                  <IonIcon icon={personAddOutline} />
                  <span>Crear cuenta</span>
                </div>
              </IonButton>

              {biometriaLista && (
                <IonButton
                  fill="outline"
                  className="btn-cuadrado"
                  onClick={ingresarConHuella}
                  disabled={verificandoHuella || cargando}
                >
                  <div className="btn-cuadrado-inner">
                    {verificandoHuella
                      ? <IonSpinner name="crescent" />
                      : <IonIcon icon={fingerPrintOutline} />}
                    <span>{verificandoHuella ? 'Verificando…' : 'Huella'}</span>
                  </div>
                </IonButton>
              )}

              <IonButton
                className="btn-cuadrado btn-cuadrado-primary"
                onClick={iniciarSesion}
                disabled={cargando}
              >
                <div className="btn-cuadrado-inner">
                  <IonIcon icon={logInOutline} />
                  <span>{cargando ? 'Ingresando…' : 'Iniciar Sesión'}</span>
                </div>
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

        <IonToast
          isOpen={!!avisoHuella}
          message={avisoHuella}
          duration={2600}
          color="warning"
          position="top"
          onDidDismiss={() => setAvisoHuella('')}
        />

        <IonAlert
          isOpen={!!confirmarReemplazo}
          header="¿Reemplazar sesión guardada?"
          message="Ya hay una cuenta guardada con huella en este dispositivo. Si continúas, se reemplazará por esta cuenta."
          buttons={[
            { text: 'No, mantener la anterior', role: 'cancel', handler: confirmarReemplazoNo },
            { text: 'Sí, reemplazar', role: 'destructive', handler: confirmarReemplazoSi },
          ]}
          onDidDismiss={() => setConfirmarReemplazo(null)}
        />

        {mostrandoCarga && (
          <div className="loading-overlay">
            <img src={marcaTickets} alt="T-ickets" className="loading-logo" />
            <IonSpinner name="crescent" className="loading-spinner" />
            <p key={mensajeCargaIdx} className="loading-texto">{MENSAJES_CARGA[mensajeCargaIdx]}</p>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Home;
