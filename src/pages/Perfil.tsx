import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonButton,
  IonItem,
  IonLabel,
} from '@ionic/react';
import {
  personCircleOutline,
  mailOutline,
  callOutline,
  cardOutline,
  locationOutline,
  logOutOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import './Perfil.css';

interface UserData {
  id: number;
  cedula: string;
  nombreCompleto: string;
  email: string;
  movil: string;
  ciudad: string;
  edad: number;
}

const Perfil: React.FC = () => {
  const history = useHistory();

  const raw = localStorage.getItem('userData');
  const user: UserData | null = raw ? JSON.parse(raw) : null;

  const cerrarSesion = () => {
    localStorage.removeItem('userData');
    localStorage.removeItem('sesion');
    history.replace('/home');
  };

  const inicial = user?.nombreCompleto?.charAt(0) ?? '?';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="perfil-toolbar">
          <IonTitle>Mi Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="perfil-content">
        <div className="perfil-avatar-section">
          <div className="avatar-circle">
            <span className="avatar-inicial">{inicial}</span>
          </div>
          <h2 className="perfil-nombre">{user?.nombreCompleto ?? 'Usuario'}</h2>
          <p className="perfil-rol">Suscriptor</p>
        </div>

        <div className="perfil-section-title">Información personal</div>
        <div className="perfil-items">

          <IonItem className="perfil-item" lines="none">
            <IonIcon icon={mailOutline} slot="start" className="item-icon" />
            <IonLabel>
              <p className="item-label">Correo electrónico</p>
              <h3 className="item-value">{user?.email ?? '—'}</h3>
            </IonLabel>
          </IonItem>

          <IonItem className="perfil-item" lines="none">
            <IonIcon icon={callOutline} slot="start" className="item-icon" />
            <IonLabel>
              <p className="item-label">Teléfono / Móvil</p>
              <h3 className="item-value">{user?.movil ?? 'No registrado'}</h3>
            </IonLabel>
          </IonItem>

          <IonItem className="perfil-item" lines="none">
            <IonIcon icon={cardOutline} slot="start" className="item-icon" />
            <IonLabel>
              <p className="item-label">Cédula</p>
              <h3 className="item-value">{user?.cedula ?? '—'}</h3>
            </IonLabel>
          </IonItem>

          <IonItem className="perfil-item" lines="none">
            <IonIcon icon={locationOutline} slot="start" className="item-icon" />
            <IonLabel>
              <p className="item-label">Ciudad</p>
              <h3 className="item-value">{user?.ciudad ?? '—'}</h3>
            </IonLabel>
          </IonItem>

        </div>

        <div className="perfil-logout">
          <IonButton expand="block" className="btn-logout" onClick={cerrarSesion}>
            <IonIcon icon={logOutOutline} slot="start" />
            Cerrar Sesión
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Perfil;
