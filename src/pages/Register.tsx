import { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonButton,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonToast,
  IonIcon,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { checkmarkCircleOutline } from 'ionicons/icons';
import axios from 'axios';
import './Register.css';

const Register: React.FC = () => {
  const history = useHistory();

  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail]                   = useState('');
  const [cedula, setCedula]                 = useState('');
  const [movil, setMovil]                   = useState('');
  const [ciudad, setCiudad]                 = useState('');

  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');
  const [exito, setExito]       = useState(false);

  const validar = () => {
    if (!nombreCompleto.trim()) return 'Ingresa tu nombre completo.';
    if (!email.trim() || !email.includes('@')) return 'Ingresa un correo válido.';
    if (!cedula.trim() || cedula.length < 8) return 'Ingresa una cédula válida.';
    if (!movil.trim() || movil.length < 7) return 'Ingresa un número de celular válido.';
    if (!ciudad.trim()) return 'Ingresa tu ciudad.';
    return '';
  };

  const registrar = async () => {
    const msg = validar();
    if (msg) { setError(msg); return; }

    setCargando(true);
    setError('');
    try {
      console.log("datos", {
        nombreCompleto: nombreCompleto.trim(),
        email: email.trim().toLowerCase(),
        password: cedula.trim(),
        movil: movil.trim(),
        ciudad: ciudad.trim(),
        cedula: cedula.trim(),
      } )
      const { data } = await axios.post(
        'https://api.ticketsecuador.ec/ms_login/api/v1/registro_suscriptor',
        {
          nombreCompleto: nombreCompleto.trim(),
          email:          email.trim().toLowerCase(),
          password:       cedula.trim(),
          movil:          movil.trim(),
          ciudad:         ciudad.trim(),
          cedula:         cedula.trim(),
        }
      );
      console.log("respuesta de add usuario",data)

      if (data.success) {
        setExito(true);
        setTimeout(() => history.replace('/home'), 2000);
      } else {
        setError(data.message ?? 'No se pudo crear la cuenta. Intenta de nuevo.');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="register-toolbar">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" text="" />
          </IonButtons>
          <IonTitle>Crear cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="register-content">
        <div className="register-container">

          {exito ? (
            <div className="register-success">
              <IonIcon icon={checkmarkCircleOutline} className="success-icon" />
              <h2>¡Cuenta creada!</h2>
              <p>Tu cuenta fue registrada con éxito. Redirigiendo al inicio de sesión…</p>
            </div>
          ) : (
            <>
              <h2 className="register-title">Únete a Tickets Ecuador</h2>
              <p className="register-subtitle">Completa tus datos para crear tu cuenta</p>

              <IonInput
                className="register-input"
                label="Nombre completo"
                labelPlacement="floating"
                fill="outline"
                type="text"
                value={nombreCompleto}
                onIonInput={(e) => setNombreCompleto(e.detail.value!)}
              />

              <IonInput
                className="register-input"
                label="Correo electrónico"
                labelPlacement="floating"
                fill="outline"
                type="email"
                autocomplete="email"
                value={email}
                onIonInput={(e) => setEmail(e.detail.value!)}
              />

              <IonInput
                className="register-input"
                label="Cédula de identidad"
                labelPlacement="floating"
                fill="outline"
                type="text"
                inputmode="numeric"
                maxlength={13}
                value={cedula}
                onIonInput={(e) => setCedula(e.detail.value!)}
              />
              <p className="register-hint">Tu cédula será tu contraseña de acceso.</p>

              <IonInput
                className="register-input"
                label="Número de celular"
                labelPlacement="floating"
                fill="outline"
                type="tel"
                value={movil}
                onIonInput={(e) => setMovil(e.detail.value!)}
              />

              <IonInput
                className="register-input"
                label="Ciudad"
                labelPlacement="floating"
                fill="outline"
                type="text"
                value={ciudad}
                onIonInput={(e) => setCiudad(e.detail.value!)}
              />

              {error && <p className="register-error">{error}</p>}

              <IonButton
                expand="block"
                className="btn-register"
                onClick={registrar}
                disabled={cargando}>
                {cargando
                  ? <><IonSpinner name="crescent" className="btn-spinner" /> Creando cuenta…</>
                  : 'Crear cuenta'
                }
              </IonButton>

              <p className="register-login-link" onClick={() => history.replace('/home')}>
                ¿Ya tienes cuenta? <span>Inicia sesión</span>
              </p>
            </>
          )}
        </div>
      </IonContent>

      <IonToast
        isOpen={!!error}
        message={error}
        duration={3500}
        position="top"
        color="danger"
        onDidDismiss={() => setError('')}
      />
    </IonPage>
  );
};

export default Register;
