import { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonButton,
  IonButtons,
  IonSpinner,
  IonText,
  IonModal,
  IonInput,
  IonBadge,
  IonToast,
} from '@ionic/react';
import {
  ticketOutline,
  calendarNumberOutline,
  locationOutline,
  closeOutline,
  searchOutline,
  pricetagOutline,
  personOutline,
  checkmarkCircleOutline,
  timeOutline,
  refreshOutline,
  downloadOutline,
} from 'ionicons/icons';
import axios from 'axios';
import './Boletos.css';

interface Asiento {
  espacio: string;
  current: number;
  id_registra_compra: string;
  pasado: string;
}

interface Ticket {
  id: number;
  codigoEvento: string;
  cedula: string;
  concierto: string;
  sillas: string;
  valor: string;
  fechaCreacion: string;
  fecha: string;
  estado: string;
  localidad: string;
  pdf: string;
  canje: string;
  comisionBoleto: string;
  asientos: Asiento;
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const formatFecha = (fecha: string) => {
  const [y, m, d] = fecha.split('-');
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`;
};

const getCedulaGuardada = (): string => {
  try {
    const raw = localStorage.getItem('userData');
    if (raw) {
      const ud = JSON.parse(raw);
      return ud?.cedula ?? '';
    }
  } catch { /* silent */ }
  return '';
};

const Boletos: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [cedula, setCedula] = useState('');
  const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [descargando, setDescargando] = useState<number | null>(null);
  const [errorDescarga, setErrorDescarga] = useState('');

  useEffect(() => {
    const c = getCedulaGuardada();
    if (c) {
      setCedula(c);
      cargarTickets(c);
    }
  }, []);

  const cargarTickets = async (ced?: string) => {
    const cedulaFinal = ced ?? cedula;
    if (!cedulaFinal || cedulaFinal.length < 6) return;
    setCargando(true);
    setError('');
    try {
      const { data } = await axios.post(
        'https://api.t-ickets.com/ms_login/ticket_usuario',
        { cedula: cedulaFinal },
        {
          headers: {
            'Content-Type': 'application/json',
            'authorization-ticket': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
          },
        }
      );
      if (data.success) {
        setTickets(data.data ?? []);
      } else {
        setError('No se encontraron entradas para esta cédula');
      }
    } catch {
      setError('Error al cargar las entradas');
    } finally {
      setCargando(false);
    }
  };

  const descargarBoleto = async (ticket: Ticket) => {
    setDescargando(ticket.id);
    try {
      const { data } = await axios.post(
        'https://api.t-ickets.com/ticket/api/v1/ticket_pdf_link',
        {
          cedula: cedula || ticket.cedula,
          codigoEvento: ticket.codigoEvento,
          id_ticket_usuarios: ticket.id,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'authorization-ticket': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
          },
        }
      );
      if (data.success && data.link) {
        const link = data.link.replace('https://flash.t-ickets.com', 'https://api.t-ickets.com');
        window.open(link, '_blank');
      } else {
        setErrorDescarga('No se pudo generar el PDF');
      }
    } catch {
      setErrorDescarga('Error al generar el boleto');
    } finally {
      setDescargando(null);
    }
  };

  const abrirEntrada = (ticket: Ticket) => {
    setTicketSeleccionado(ticket);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setTicketSeleccionado(null);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="boletos-toolbar">
          <IonTitle>Mis Boletos</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => cargarTickets()} disabled={cargando} className="btn-recargar">
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="boletos-content">

        {/* Busqueda por cedula si no se obtuvo automaticamente */}
        {!getCedulaGuardada() && (
          <div className="cedula-search">
            <IonInput
              className="cedula-input"
              label="Cédula de identidad"
              labelPlacement="floating"
              fill="outline"
              type="number"
              value={cedula}
              onIonChange={(e) => setCedula(e.detail.value!)}
            />
            <IonButton className="btn-buscar" onClick={() => cargarTickets()}>
              <IonIcon icon={searchOutline} slot="icon-only" />
            </IonButton>
          </div>
        )}

        {cargando && (
          <div className="loading-state">
            <IonSpinner name="crescent" className="loading-spinner" />
            <IonText><p>Cargando tus entradas...</p></IonText>
          </div>
        )}

        {!cargando && error && (
          <div className="empty-state">
            <IonIcon icon={ticketOutline} className="empty-icon" />
            <IonText><p>{error}</p></IonText>
          </div>
        )}

        {!cargando && !error && tickets.length === 0 && cedula && (
          <div className="empty-state">
            <IonIcon icon={ticketOutline} className="empty-icon" />
            <IonText>
              <h3>Sin entradas</h3>
              <p>No tienes entradas compradas aún</p>
            </IonText>
          </div>
        )}

        {!cargando && tickets.length > 0 && (
          <div className="boletos-list">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="boleto-card">
                <div className="boleto-card-left">
                  <IonIcon icon={ticketOutline} className="boleto-card-icon" />
                </div>
                <div className="boleto-card-body">
                  <div className="boleto-card-top">
                    <span className="boleto-concierto">{ticket.concierto}</span>
                    <IonBadge className={`badge-estado ${ticket.estado === 'Pagado' ? 'badge-pagado' : 'badge-pendiente'}`}>
                      {ticket.estado}
                    </IonBadge>
                  </div>
                  <div className="boleto-meta">
                    <IonIcon icon={calendarNumberOutline} />
                    <span>{formatFecha(ticket.fecha)}</span>
                  </div>
                  <div className="boleto-meta">
                    <IonIcon icon={locationOutline} />
                    <span>{ticket.localidad}</span>
                  </div>
                  <div className="boleto-acciones">
                    <IonButton
                      size="small"
                      className="btn-ver-entrada"
                      onClick={() => abrirEntrada(ticket)}
                    >
                      Ver entrada
                    </IonButton>
                    <IonButton
                      size="small"
                      fill="outline"
                      className="btn-descargar-card"
                      disabled={descargando === ticket.id}
                      onClick={() => descargarBoleto(ticket)}
                    >
                      <IonIcon icon={descargando === ticket.id ? refreshOutline : downloadOutline} slot="start" />
                      {descargando === ticket.id ? 'Generando...' : 'Descargar'}
                    </IonButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de detalle */}
        <IonModal isOpen={modalAbierto} onDidDismiss={cerrarModal} className="entrada-modal">
          <IonHeader>
            <IonToolbar className="modal-toolbar">
              <IonTitle>Mi Entrada</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={cerrarModal}>
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent className="modal-content">
            {ticketSeleccionado && (
              <div className="entrada-detalle">

                <div className="qr-container">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${ticketSeleccionado.pdf}&ecc=M`}
                    alt="QR de entrada"
                    className="qr-img"
                  />
                  <span className="qr-codigo">{ticketSeleccionado.pdf}</span>
                </div>

                <div className="entrada-info-card">
                  <h2 className="entrada-titulo">{ticketSeleccionado.concierto}</h2>

                  <div className="entrada-fila">
                    <IonIcon icon={calendarNumberOutline} className="ei-icon" />
                    <div>
                      <span className="ei-label">Fecha</span>
                      <span className="ei-valor">{formatFecha(ticketSeleccionado.fecha)}</span>
                    </div>
                  </div>

                  <div className="entrada-fila">
                    <IonIcon icon={locationOutline} className="ei-icon" />
                    <div>
                      <span className="ei-label">Lugar</span>
                      <span className="ei-valor">{ticketSeleccionado.asientos?.espacio ?? '—'}</span>
                    </div>
                  </div>

                  <div className="entrada-fila">
                    <IonIcon icon={ticketOutline} className="ei-icon" />
                    <div>
                      <span className="ei-label">Localidad</span>
                      <span className="ei-valor">{ticketSeleccionado.localidad}</span>
                    </div>
                  </div>

                  <div className="entrada-fila">
                    <IonIcon icon={personOutline} className="ei-icon" />
                    <div>
                      <span className="ei-label">Silla / Puesto</span>
                      <span className="ei-valor">#{ticketSeleccionado.sillas}</span>
                    </div>
                  </div>

                  <div className="entrada-fila">
                    <IonIcon icon={pricetagOutline} className="ei-icon" />
                    <div>
                      <span className="ei-label">Valor</span>
                      <span className="ei-valor">${ticketSeleccionado.valor}</span>
                    </div>
                  </div>

                  <div className="entrada-fila">
                    <IonIcon icon={checkmarkCircleOutline} className="ei-icon" />
                    <div>
                      <span className="ei-label">Estado</span>
                      <span className={`ei-valor ei-estado ${ticketSeleccionado.estado === 'Pagado' ? 'estado-pagado' : ''}`}>
                        {ticketSeleccionado.estado}
                      </span>
                    </div>
                  </div>

                  <div className="entrada-fila">
                    <IonIcon icon={timeOutline} className="ei-icon" />
                    <div>
                      <span className="ei-label">Fecha de compra</span>
                      <span className="ei-valor">{ticketSeleccionado.fechaCreacion}</span>
                    </div>
                  </div>

                  <div className="entrada-canje">
                    <span className={`canje-badge ${ticketSeleccionado.canje === 'NO CANJEADO' ? 'canje-no' : 'canje-si'}`}>
                      {ticketSeleccionado.canje}
                    </span>
                  </div>
                </div>

                <IonButton
                  expand="block"
                  className="btn-descargar-modal"
                  disabled={descargando === ticketSeleccionado.id}
                  onClick={() => descargarBoleto(ticketSeleccionado)}
                >
                  <IonIcon icon={descargando === ticketSeleccionado.id ? refreshOutline : downloadOutline} slot="start" />
                  {descargando === ticketSeleccionado.id ? 'Generando PDF...' : 'Descargar boleto'}
                </IonButton>

              </div>
            )}
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={!!errorDescarga}
          message={errorDescarga}
          duration={3000}
          color="danger"
          position="bottom"
          onDidDismiss={() => setErrorDescarga('')}
        />

      </IonContent>
    </IonPage>
  );
};

export default Boletos;
