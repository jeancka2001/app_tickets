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
  shareOutline,
  qrCodeOutline,
} from 'ionicons/icons';
import axios from 'axios';
import { CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import marcaTickets from '../images/MARCA_TICKETS.png';
import { MS_LOGIN_AUTH_HEADERS } from '../utils/msLoginAuth';
import EstadoError from '../components/EstadoError';
import './Boletos.css';

interface Asiento {
  id: number;
  id_localidades: number;
  id_espacio: number;
  espacio: string;
  typo: string;           // "correlativo" | "mesa" | "fila"
  cantidad: number | null;
  current: number | null;
  fila: string | null;
  sillas: string | null;
  silla: string | null;
  estado: string;
  cedula: string;
  fecha: string;
  mesa: string | null;
  pasado: string;         // "PASADO" si el evento ya pasó
  id_registraCompra: string;
  id_registra_compra: string;
}

interface Ticket {
  id: number;
  id_localidades_items: number;
  id_registraCompra: number;
  codigoEvento: string;
  cedula: string;
  concierto: string;
  sillas: string;
  valor: string;
  fechaCreacion: string;
  fecha: string;
  estado: string;
  link: string;
  localidad: string;
  pdf: string;
  cedido: string;
  usuario_cedido: string;
  canje: string;
  comisionBoleto: string;
  asientos: Asiento;
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatFecha = (fecha: string) => {
  if (!fecha || fecha === 'undefined') return '—';
  const solo = fecha.split(' ')[0].split('T')[0]; // quita hora si viene datetime
  const parts = solo.split('-');
  if (parts.length < 3) return '—';
  const [y, m, d] = parts;
  const mes = MESES[parseInt(m) - 1];
  return mes ? `${d} ${mes} ${y}` : '—';
};

/* El campo con el número/letra exacto de la silla es `silla`, en el mismo
   formato "<fila-o-mesa>-s-<n>" que usa el mapa de selección de asientos
   (ver sillaNum() en Localidad.tsx) — así se genera tanto para localidades
   tipo "fila" como "mesa" al armar el mapa en el admin. `current` es un
   campo aparte que no se mantiene siempre actualizado; antes esta función
   solo lo usaba para "fila", por eso a veces no salía el asiento exacto.
   Ahora se prioriza `silla` para ambos tipos, igual que hace el mapa. */
const numeroDesdeSilla = (silla: string | null): string | null => {
  if (!silla) return null;
  const partes = silla.split('-s-');
  return partes[1] ?? silla;
};

const formatSilla = (asiento: Asiento): string => {
  const t = asiento.typo;
  const numero = numeroDesdeSilla(asiento.silla)
    ?? (asiento.current !== null && asiento.current !== undefined ? String(asiento.current) : null);

  if (t === 'mesa' && asiento.mesa) {
    return `Mesa ${asiento.mesa}${numero ? ` · Silla ${numero}` : ''}`;
  }
  if (t === 'fila' && asiento.fila) {
    return `Fila ${asiento.fila}${numero ? ` · #${numero}` : ''}`;
  }
  if (numero) return `#${numero}`;
  return '—';
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
  /* Distinto de `error`: esto es específicamente "no se pudo conectar al
     servidor" (catch de red/timeout), no "no se encontraron boletos" (una
     respuesta normal del servidor). Solo el primero amerita el aviso de
     robot/error — el segundo es un estado vacío normal. */
  const [errorConexion, setErrorConexion] = useState(false);
  const [cedula, setCedula] = useState('');
  const [ticketSeleccionado, setTicketSeleccionado] = useState<Ticket | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [descargando, setDescargando] = useState<number | null>(null);
  const [errorDescarga, setErrorDescarga] = useState('');
  const [compartiendo, setCompartiendo] = useState<number | null>(null);

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
    setErrorConexion(false);
    try {
      const { data } = await axios.post(
        'https://api.t-ickets.com/ms_login/ticket_usuario',
        { cedula: cedulaFinal },
        {
          headers: {
            'Content-Type': 'application/json',
            ...MS_LOGIN_AUTH_HEADERS,
          },
        }
      );
      if (data.success) {
        setTickets(data.data ?? []);
      } else {
        setError('No se encontraron entradas para esta cédula');
      }
    } catch {
      setErrorConexion(true);
    } finally {
      setCargando(false);
    }
  };

  /* Mismo endpoint que usan "Descargar" y "Compartir" para obtener el link
     del PDF del boleto ya generado por el backend. */
  const obtenerLinkPdf = async (ticket: Ticket): Promise<string | null> => {
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
    if (!data.success || !data.link) return null;
    return data.link.replace('https://flash.t-ickets.com', 'https://api.t-ickets.com');
  };

  const descargarBoleto = async (ticket: Ticket) => {
    setDescargando(ticket.id);
    try {
      const link = await obtenerLinkPdf(ticket);
      if (link) {
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

  const compartirBoleto = async (ticket: Ticket) => {
    setCompartiendo(ticket.id);
    try {
      const link = await obtenerLinkPdf(ticket);
      if (!link) { setErrorDescarga('No se pudo generar el PDF'); return; }

      /* El PDF no vive en nuestro propio backend (a veces es otro dominio,
         ver el reemplazo de host en obtenerLinkPdf) y ese servidor no
         necesariamente responde con permiso CORS para el origen de la app
         (https://localhost) — por eso "Descargar" funciona (window.open es
         una navegación normal, no le aplica CORS) pero traer el archivo acá
         con axios/fetch para adjuntarlo al compartir SÍ le aplica CORS y
         fallaba en silencio. CapacitorHttp hace la petición con librerías
         nativas (no pasa por el motor del WebView), así que no depende de
         CORS — y de paso ya devuelve el archivo en base64, listo para
         Filesystem, sin conversión aparte. */
      const respuesta = await CapacitorHttp.get({
        url: link,
        responseType: 'arraybuffer',
        headers: { Accept: 'application/pdf' },
      });
      if (respuesta.status < 200 || respuesta.status >= 300 || !respuesta.data) {
        setErrorDescarga('No se pudo descargar el boleto. Intenta de nuevo.');
        return;
      }

      /* "JVBER" es cómo empieza SIEMPRE un PDF real codificado en base64
         (son los primeros bytes de la firma "%PDF-"). Si no empieza así,
         lo que se descargó no es el PDF sino, por ejemplo, una página de
         error o de redirección del servidor -- eso se guardaba igual como
         si fuera un .pdf válido, y WhatsApp lo rechazaba con "el archivo
         no es un archivo" al intentar adjuntar algo que en realidad no es
         un PDF real. Mejor avisar acá que dejar que WhatsApp falle raro. */
      if (!respuesta.data.startsWith('JVBER')) {
        setErrorDescarga('El boleto no se generó correctamente. Intenta de nuevo en un momento.');
        return;
      }

      const nombreArchivo = `boleto_${ticket.id}.pdf`;
      await Filesystem.writeFile({ path: nombreArchivo, data: respuesta.data, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: nombreArchivo, directory: Directory.Cache });

      await Share.share({
        title: `Boleto — ${ticket.concierto}`,
        dialogTitle: 'Compartir boleto',
        files: [uri],
      });
    } catch {
      setErrorDescarga('No se pudo compartir el boleto. Intenta de nuevo.');
    } finally {
      setCompartiendo(null);
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
          <IonButtons slot="start">
            <img src={marcaTickets} alt="T-ickets" className="toolbar-logo" />
          </IonButtons>
          <IonTitle>Mis Boletos</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => cargarTickets()} disabled={cargando}
              className={`btn-recargar ${cargando ? 'btn-cargando' : ''}`}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="boletos-content">
        <div aria-hidden="true" className="page-watermark">
          <img src={marcaTickets} alt="" />
        </div>

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

        {!cargando && errorConexion && (
          <EstadoError onReintentar={() => cargarTickets()} reintentando={cargando} />
        )}

        {!cargando && !errorConexion && error && (
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
                    <IonButton
                      size="small"
                      fill="outline"
                      className="btn-compartir-card"
                      disabled={compartiendo === ticket.id}
                      onClick={() => compartirBoleto(ticket)}
                    >
                      <IonIcon icon={compartiendo === ticket.id ? refreshOutline : shareOutline} slot="start" />
                      {compartiendo === ticket.id ? 'Preparando...' : 'Compartir'}
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

                {/* El código QR que valida el ingreso al evento se genera del
                    lado del servidor y va impreso en el PDF del boleto — no
                    tenemos ese valor exacto para reproducirlo igual acá. Si
                    el boleto trae algún código (campo "pdf"), se genera un
                    QR con ese mismo dato (puede verse distinto al del PDF,
                    pero es el mismo código); si no trae nada, se manda
                    directo al PDF real en vez de mostrar un QR vacío. */}
                {ticketSeleccionado.pdf ? (
                  <div className="qr-container">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ticketSeleccionado.pdf)}&ecc=M`}
                      alt="QR de entrada"
                      className="qr-img"
                    />
                  </div>
                ) : (
                  <div className="qr-container qr-aviso">
                    <IonIcon icon={qrCodeOutline} className="qr-aviso-icon" />
                    <p className="qr-aviso-texto">
                      El código QR para el ingreso al evento está en tu boleto en PDF.
                    </p>
                    <IonButton
                      size="small"
                      className="qr-aviso-btn"
                      disabled={descargando === ticketSeleccionado.id}
                      onClick={() => descargarBoleto(ticketSeleccionado)}
                    >
                      <IonIcon icon={descargando === ticketSeleccionado.id ? refreshOutline : downloadOutline} slot="start" />
                      {descargando === ticketSeleccionado.id ? 'Generando...' : 'Ver boleto con QR'}
                    </IonButton>
                  </div>
                )}

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
                      <span className="ei-valor">{formatSilla(ticketSeleccionado.asientos)}</span>
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

                  {/* <div className="entrada-canje">
                    <span className={`canje-badge ${ticketSeleccionado.canje === 'NO CANJEADO' ? 'canje-no' : 'canje-si'}`}>
                      {ticketSeleccionado.canje}
                    </span>
                  </div> */}
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

                <IonButton
                  expand="block"
                  fill="outline"
                  className="btn-compartir-modal"
                  disabled={compartiendo === ticketSeleccionado.id}
                  onClick={() => compartirBoleto(ticketSeleccionado)}
                >
                  <IonIcon icon={compartiendo === ticketSeleccionado.id ? refreshOutline : shareOutline} slot="start" />
                  {compartiendo === ticketSeleccionado.id ? 'Preparando...' : 'Compartir boleto'}
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
