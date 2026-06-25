import { useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonIcon, IonButton, IonButtons, IonItem, IonLabel,
  IonModal, IonInput, IonSpinner, IonToast,
} from '@ionic/react';
import {
  mailOutline, callOutline, cardOutline,
  locationOutline, logOutOutline, logoWhatsapp,
  createOutline, alertCircleOutline, checkmarkCircleOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import marcaTickets from '../images/MARCA_TICKETS.png';
import './Perfil.css';

interface UserData {
  cedula: string;
  nombreCompleto: string;
  email: string;
  movil: string;
  ciudad: string;
}

const getUserData = (): UserData => {
  try { return JSON.parse(localStorage.getItem('userData') || '{}'); }
  catch { return {} as UserData; }
};

const Perfil: React.FC = () => {
  const history = useHistory();
  const [user, setUser]     = useState<UserData>(getUserData);
  const inicial             = user?.nombreCompleto?.charAt(0) ?? '?';

  /* ── Modal editar ── */
  const [modalEdit, setModalEdit] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoMovil, setNuevoMovil] = useState('');
  const [guardando, setGuardando]   = useState(false);
  const [toast, setToast]           = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');

  const abrirEditar = () => {
    setNuevoEmail(user.email ?? '');
    setNuevoMovil(user.movil ?? '');
    setModalEdit(true);
  };

  const guardarCambios = async () => {
    const email = nuevoEmail.trim();
    const movil = nuevoMovil.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setToast('Ingresa un correo válido.'); setToastColor('danger'); return;
    }
    if (!movil || movil.length < 7) {
      setToast('Ingresa un teléfono válido.'); setToastColor('danger'); return;
    }
    setGuardando(true);
    try {
      const { data } = await axios.post(
        'https://api.ticketsecuador.ec/ms_login/api/v1/crear_suscriptor',
        {
          nombreCompleto: user.nombreCompleto,
          email,
          password: user.cedula,
          movil,
          ciudad: user.ciudad ?? '',
          cedula: user.cedula,
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (data.success) {
        const updated = { ...user, email, movil };
        localStorage.setItem('userData', JSON.stringify(updated));
        setUser(updated);
        setModalEdit(false);
        setToast('Datos actualizados correctamente.');
        setToastColor('success');
      } else {
        setToast(data.message ?? 'No se pudo actualizar.');
        setToastColor('danger');
      }
    } catch {
      setToast('Error de conexión. Intenta de nuevo.');
      setToastColor('danger');
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('userData');
    localStorage.removeItem('sesion');
    history.replace('/home');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="perfil-toolbar">
          <IonButtons slot="start">
            <img src={marcaTickets} alt="T-ickets" className="toolbar-logo" />
          </IonButtons>
          <IonTitle>Mi Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="perfil-content">
        <div aria-hidden="true" className="page-watermark">
          <img src={marcaTickets} alt="" />
        </div>

        <div className="perfil-avatar-section">
          <div className="avatar-circle">
            <span className="avatar-inicial">{inicial}</span>
          </div>
          <h2 className="perfil-nombre">{user?.nombreCompleto ?? 'Usuario'}</h2>
          <p className="perfil-rol">Suscriptor</p>
        </div>

        {/* ── Información personal ── */}
        <div className="perfil-section-header">
          <span className="perfil-section-title" style={{ padding: 0 }}>Información personal</span>
          <IonButton fill="clear" size="small" className="btn-editar-perfil" onClick={abrirEditar}>
            <IonIcon icon={createOutline} slot="start" />
            Editar
          </IonButton>
        </div>

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

        <div className="perfil-soporte">
          <div className="perfil-section-title" style={{ padding: '20px 0 8px' }}>Soporte</div>
          <IonButton expand="block" className="btn-whatsapp-perfil"
            onClick={() => window.open('https://api.whatsapp.com/send?phone=593980009000', '_blank')}>
            <IonIcon icon={logoWhatsapp} slot="start" />
            Contactar por WhatsApp
          </IonButton>
        </div>

        <div className="perfil-logout">
          <IonButton expand="block" className="btn-logout" onClick={cerrarSesion}>
            <IonIcon icon={logOutOutline} slot="start" />
            Cerrar Sesión
          </IonButton>
        </div>

      </IonContent>

      {/* ── Modal editar correo y teléfono ── */}
      <IonModal isOpen={modalEdit} onDidDismiss={() => setModalEdit(false)}
        breakpoints={[0, 1]} initialBreakpoint={1}>
        <IonHeader>
          <IonToolbar className="perfil-toolbar">
            <IonTitle>Editar datos</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setModalEdit(false)}>Cancelar</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="perfil-content">
          <div className="edit-modal-body">

            <div className="edit-aviso">
              <IonIcon icon={alertCircleOutline} className="edit-aviso-icon" />
              <p>Puedes actualizar tu correo electrónico y número de teléfono.</p>
            </div>

            <IonInput
              className="edit-inp"
              label="Correo electrónico"
              labelPlacement="floating"
              fill="outline"
              type="email"
              inputmode="email"
              value={nuevoEmail}
              onIonInput={e => setNuevoEmail(e.detail.value!)}
            />

            <IonInput
              className="edit-inp"
              label="Teléfono / Móvil"
              labelPlacement="floating"
              fill="outline"
              type="tel"
              inputmode="tel"
              value={nuevoMovil}
              onIonInput={e => setNuevoMovil(e.detail.value!)}
            />

            <IonButton expand="block" className="btn-guardar-perfil"
              onClick={guardarCambios}
              disabled={guardando || !nuevoEmail.trim() || !nuevoMovil.trim()}>
              {guardando
                ? <><IonSpinner name="crescent" style={{ marginRight: 8 }} />Guardando…</>
                : <><IonIcon icon={checkmarkCircleOutline} slot="start" />Guardar cambios</>
              }
            </IonButton>

          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={!!toast}
        message={toast}
        duration={3500}
        position="top"
        color={toastColor}
        onDidDismiss={() => setToast('')}
      />
    </IonPage>
  );
};

export default Perfil;
