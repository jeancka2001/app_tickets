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
} from '@ionic/react';
import './Register.css';

const Register: React.FC = () => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const handleRegister = () => {
    console.log('Registro:', nombre, email);
  };

  return (
    <IonPage>
      <IonHeader className="register-header">
        <IonToolbar className="register-toolbar">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" text="Volver" />
          </IonButtons>
          <IonTitle>Crear Cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="register-content">
        <div className="register-container">
          <h2 className="register-title">Únete a Tickets Ecuador</h2>
          <p className="register-subtitle">Crea tu cuenta y disfruta de los mejores eventos</p>

          <IonInput
            className="register-input"
            label="Nombre completo"
            labelPlacement="floating"
            fill="outline"
            type="text"
            value={nombre}
            onIonChange={(e) => setNombre(e.detail.value!)}
          />

          <IonInput
            className="register-input"
            label="Correo electrónico"
            labelPlacement="floating"
            fill="outline"
            type="email"
            autocomplete="email"
            value={email}
            onIonChange={(e) => setEmail(e.detail.value!)}
          />

          <IonInput
            className="register-input"
            label="Contraseña"
            labelPlacement="floating"
            fill="outline"
            type="password"
            value={contrasena}
            onIonChange={(e) => setContrasena(e.detail.value!)}
          />

          <IonInput
            className="register-input"
            label="Confirmar contraseña"
            labelPlacement="floating"
            fill="outline"
            type="password"
            value={confirmar}
            onIonChange={(e) => setConfirmar(e.detail.value!)}
          />

          <IonButton expand="block" className="btn-register" onClick={handleRegister}>
            Crear Cuenta
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Register;
