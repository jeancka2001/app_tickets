import { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonInputPasswordToggle,
  IonButton,
  IonText,
  IonToast,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import marcaTickets from '../images/MARCA_TICKETS.png';
import './Home.css';
import axios from 'axios';

const Home: React.FC = () => {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();

  const iniciarSesion = async () => {
    if (!usuario || !contrasena) {
      setError('Ingresa tu usuario y contraseña');
      return;
    }
    setCargando(true);
    try {
      const sesion = { usuario, contrasena };
      localStorage.setItem('sesion', JSON.stringify(sesion));
console.log('Datos de sesión guardados:', sesion);
      const { data } = await axios.post(
        'https://api.t-ickets.com/ms_login/api/v1/auth_suscriptor',
        { email: usuario, password: contrasena },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
          },
        }
        
      );
      console.log('Respuesta del servidor:', data)
      if (data.success == true && data.data) {
        localStorage.setItem('userData', JSON.stringify(data.data));
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
