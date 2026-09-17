import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonButton,
  IonButtons,
  IonSearchbar,
  IonSpinner,
  IonText,
  IonModal,
  IonBadge,
  IonAlert,
  IonToast,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  locationOutline,
  calendarNumberOutline,
  pricetagOutline,
  closeOutline,
  peopleOutline,
  chevronForwardOutline,
  alertCircleOutline,
  timeOutline,
  refreshOutline,
  expandOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import { usePendientes } from '../context/PendientesContext';
import { MS_LOGIN_AUTH_HEADERS } from '../utils/msLoginAuth';
import marcaTickets from '../images/MARCA_TICKETS.png';
import EstadoError from '../components/EstadoError';
import './Eventos.css';

interface Localidad {
  id: number;
  id_localidad: number;
  localidad: string;
  precio_normal: string;
  cantidad_disponible: number;
  tipo_localidad: string;
  mensaje_promocion: string;
  comision_boleto?: string;
}

interface Evento {
  id: number;
  nombreConcierto: string;
  fechaConcierto: string;
  horaConcierto: string;
  lugarConcierto: string;
  cuidadConcert: string;
  imagenConcierto: string;
  mapaConcierto: string;
  codigoEvento: string;
  iva?: string;
  localidades?: Localidad[];
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatFecha = (fecha: string) => {
  const [y, m, d] = fecha.split('-');
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`;
}; 

const MapaViewer: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef      = useRef<HTMLDivElement>(null);
  const scale        = useRef(1);
  const lastDist     = useRef(0);
  const offset       = useRef({ x: 0, y: 0 });
  const lastTouch    = useRef({ x: 0, y: 0 });
  const lastTap      = useRef(0);

  const apply = () => {
    if (wrapRef.current)
      wrapRef.current.style.transform =
        `translate(${offset.current.x}px, ${offset.current.y}px) scale(${scale.current})`;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(
      t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY
    );
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastDist.current = dist(e.touches);
      } else {
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const now = Date.now();
        if (now - lastTap.current < 300) {
          scale.current = scale.current > 1 ? 1 : 2.5;
          offset.current = { x: 0, y: 0 };
          apply();
        }
        lastTap.current = now;
      }
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const d = dist(e.touches);
        scale.current = Math.min(Math.max(scale.current * (d / lastDist.current), 1), 6);
        lastDist.current = d;
      } else if (e.touches.length === 1 && scale.current > 1) {
        offset.current.x += e.touches[0].clientX - lastTouch.current.x;
        offset.current.y += e.touches[0].clientY - lastTouch.current.y;
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      apply();
    };
    const onEnd = () => {
      if (scale.current < 1) { scale.current = 1; offset.current = { x: 0, y: 0 }; apply(); }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, []);

  /* Portal directo a document.body: IonModal maneja su propio apilamiento
     interno que puede quedar por encima de overlays normales de React sin
     importar el z-index, así que esta ventana (abierta desde DENTRO del
     modal de localidades) necesita escapar a ese apilamiento para
     garantizar que quede visible encima de todo. */
  return createPortal(
    <div className="mapa-viewer-overlay" onClick={onClose}>
      <button className="mapa-viewer-close" onClick={onClose}>
        <IonIcon icon={closeOutline} />
      </button>
      <p className="mapa-viewer-hint">Pellizca para hacer zoom · Doble toque para ajustar</p>
      <div ref={containerRef} className="mapa-viewer-container" onClick={e => e.stopPropagation()}>
        <div ref={wrapRef} className="mapa-viewer-wrap">
          <img src={src} alt="Mapa del evento" className="mapa-viewer-img" draggable={false} />
        </div>
      </div>
    </div>,
    document.body
  );
};

const Eventos: React.FC = () => {
  const history = useHistory();
  const { pendientesCount } = usePendientes();

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventosProximos, setEventosProximos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null);
  const [precios, setPrecios] = useState<Localidad[]>([]);
  const [cargandoPrecios, setCargandoPrecios] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);

  /* Vista rápida de precios ("Ver precios") — un modal chico tipo hoja
     inferior, solo para consultar, sin entrar al flujo de compra (eso lo
     hace "Comprar", que abre el modal completo con selección de localidad).
     Es un modal (posición fija) y no un popover anclado al toque porque en
     tarjetas cerca del final de la lista el popover se abría fuera de la
     pantalla y no se veía. */
  const [popoverEvento, setPopoverEvento] = useState<Evento | null>(null);
  const [popoverPrecios, setPopoverPrecios] = useState<Localidad[]>([]);
  const [cargandoPopover, setCargandoPopover] = useState(false);

  const [alertPendiente, setAlertPendiente] = useState(false);
  const [verMapa, setVerMapa] = useState(false);

  const [avisoLink, setAvisoLink] = useState('');
  const resolviendoLinkRef = useRef(false);

  /* Evento cuyo modal de localidades hay que reabrir al volver de
     /localidad/:id (botón atrás) — IonModal flota por encima de todo,
     así que no se puede dejar "abierto" durante la navegación; se cierra
     bien y se reabre solo al reaparecer esta pestaña. */
  const reabrirEventoRef = useRef<Evento | null>(null);

  useIonViewWillEnter(() => {
    if (reabrirEventoRef.current) {
      const ev = reabrirEventoRef.current;
      reabrirEventoRef.current = null;
      abrirPrecios(ev);
    }
  });

  const cargarEventos = async () => {
    setCargando(true);
    setError('');
    try {
      const hdrs = { headers: MS_LOGIN_AUTH_HEADERS };
      const [resActivo, resProximo] = await Promise.all([
        axios.get('https://api.t-ickets.com/ms_login/listareventos_publico/ACTIVO/', hdrs),
        axios.get('https://api.t-ickets.com/ms_login/listareventos_publico/PROXIMO/', hdrs),
      ]);
      if (resActivo.data.success) {
        const hoy = new Date();
        const soloFuturos = (resActivo.data.data as Evento[]).filter(ev => {
          return new Date(ev.fechaConcierto + 'T23:59:59') > hoy;
        });
        setEventos(soloFuturos);
      } else setError('No se pudieron cargar los eventos');
      if (resProximo.data.success) setEventosProximos(resProximo.data.data ?? []);
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarEventos(); }, []);

  const abrirPrecios = async (evento: Evento) => {
    setEventoSeleccionado(evento);
    setPrecios([]);
    setModalAbierto(true);
    setCargandoPrecios(true);
    try {
      const { data } = await axios.get(
        `https://api.t-ickets.com/ms_login/ListaPreciosLocaDispo/${evento.codigoEvento}`,
        {
          headers: MS_LOGIN_AUTH_HEADERS,
        }
      );
      if (data.success) {
        setPrecios(data.data);
      }
    } catch { /* silent */ }
    finally {
      setCargandoPrecios(false);
    }
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEventoSeleccionado(null);
    setPrecios([]);
  };

  /* "Ver precios" — mismo endpoint que abrirPrecios, pero solo muestra un
     popover chico con nombre + precio (sin botón de seleccionar/comprar). */
  const verPreciosRapido = async (e: React.MouseEvent, evento: Evento) => {
    e.stopPropagation();
    setPopoverEvento(evento);
    setPopoverPrecios([]);
    setCargandoPopover(true);
    try {
      const { data } = await axios.get(
        `https://api.t-ickets.com/ms_login/ListaPreciosLocaDispo/${evento.codigoEvento}`,
        { headers: MS_LOGIN_AUTH_HEADERS }
      );
      if (data.success) setPopoverPrecios(data.data);
    } catch { /* silent */ }
    finally {
      setCargandoPopover(false);
    }
  };

  const cerrarPopoverPrecios = () => {
    setPopoverEvento(null);
    setPopoverPrecios([]);
  };

  const seleccionarLocalidad = (precio: Localidad) => {
    if (pendientesCount > 0) {
      cerrarModal();
      setAlertPendiente(true);
      return;
    }
    /* Se guarda el evento para reabrir su modal de localidades al volver
       (ver useIonViewWillEnter arriba) — el modal en sí se cierra, porque
       al ser un overlay queda flotando encima de cualquier página nueva
       si no se cierra. */
    reabrirEventoRef.current = eventoSeleccionado;
    cerrarModal();
    history.push(`/localidad/${precio.id_localidad}`, {
      nombre:          precio.localidad,
      precio:          precio.precio_normal,
      tipo:            precio.tipo_localidad,
      nombreEvento:    eventoSeleccionado?.nombreConcierto,
      mapaConcierto:   eventoSeleccionado?.mapaConcierto,
      codigoEvento:    eventoSeleccionado?.codigoEvento || '',
      idPrecio:        precio.id,
      comisionBoleto:  precio.comision_boleto || '0',
      iva:             eventoSeleccionado?.iva || '1.00',
    });
  };

  /* Abre automáticamente el evento si viene de un deep link.
     Si el código no está en el listado público (evento oculto / "en proceso",
     visible solo por link — igual que en la web), se busca puntualmente
     con evento_por_codigo antes de darlo por no encontrado. */
  useEffect(() => {
    if (cargando) return;
    const code = sessionStorage.getItem('pendingEventCode');
    if (!code || resolviendoLinkRef.current) return;

    const local = eventos.find(e => e.codigoEvento === code)
      ?? eventosProximos.find(e => e.codigoEvento === code);

    if (local) {
      sessionStorage.removeItem('pendingEventCode');
      abrirPrecios(local);
      return;
    }

    resolviendoLinkRef.current = true;
    axios
      .get(`https://api.t-ickets.com/ms_login/evento_por_codigo/${code}`, {
        headers: MS_LOGIN_AUTH_HEADERS,
      })
      .then(({ data }) => {
        sessionStorage.removeItem('pendingEventCode');
        if (data.success && data.data) {
          abrirPrecios(data.data as Evento);
        } else {
          setAvisoLink('El evento del enlace ya no está disponible.');
        }
      })
      .catch(() => {
        sessionStorage.removeItem('pendingEventCode');
        setAvisoLink('No se pudo cargar el evento del enlace.');
      })
      .finally(() => { resolviendoLinkRef.current = false; });
  }, [cargando, eventos, eventosProximos]);

  const eventosFiltrados = eventos.filter((ev) =>
    ev.nombreConcierto.toLowerCase().includes(busqueda.toLowerCase()) ||
    ev.cuidadConcert.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="eventos-toolbar">
          <IonButtons slot="start">
            <img src={marcaTickets} alt="T-ickets" className="toolbar-logo" />
          </IonButtons>
          <IonTitle>Eventos</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={cargarEventos} disabled={cargando} className="btn-recargar-eventos">
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar className="search-toolbar">
          <IonSearchbar
            placeholder="Buscar eventos..."
            className="eventos-search"
            value={busqueda}
            onIonInput={(e) => setBusqueda(e.detail.value!)}
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="eventos-content">

        {/* Banner de compra pendiente */}
        {pendientesCount > 0 && (
          <div className="banner-pendiente" onClick={() => history.push('/dashboard/compras')}>
            <IonIcon icon={alertCircleOutline} className="banner-pend-icon" />
            <div className="banner-pend-text">
              <span className="banner-pend-title">Tienes {pendientesCount} compra{pendientesCount > 1 ? 's' : ''} pendiente{pendientesCount > 1 ? 's' : ''}</span>
              <span className="banner-pend-sub">Completa o anula tu pago antes de comprar</span>
            </div>
            <IonIcon icon={chevronForwardOutline} className="banner-pend-arrow" />
          </div>
        )}

        {cargando && (
          <div className="loading-state">
            <IonSpinner name="crescent" className="loading-spinner" />
            <IonText><p>Cargando eventos...</p></IonText>
          </div>
        )}

        {!cargando && error && (
          <EstadoError onReintentar={cargarEventos} reintentando={cargando} />
        )}

        {!cargando && !error && (
          <div className="eventos-list">
            {eventosFiltrados.length === 0 && eventosProximos.length === 0 && (
              <div className="empty-search">
                <IonText color="medium"><p>No se encontraron eventos</p></IonText>
              </div>
            )}

            {eventosFiltrados.map((ev) => (
              <div key={ev.id} className="evento-card">
                <div className="evento-banner">
                  <img
                    src={ev.imagenConcierto}
                    alt={ev.nombreConcierto}
                    className="evento-img"
                  />
                </div>
                <div className="evento-body">
                  <h2 className="evento-nombre">{ev.nombreConcierto}</h2>
                  <div className="evento-detalle">
                    <IonIcon icon={calendarNumberOutline} />
                    <span>{formatFecha(ev.fechaConcierto)} · {ev.horaConcierto}</span>
                  </div>
                  <div className="evento-detalle">
                    <IonIcon icon={locationOutline} />
                    <span>{ev.lugarConcierto}, {ev.cuidadConcert}</span>
                  </div>
                  <div className="evento-footer">
                    <div className="evento-precio" onClick={(e) => verPreciosRapido(e, ev)}>
                      <IonIcon icon={pricetagOutline} />
                      <span>Ver precios</span>
                    </div>
                    <IonButton size="small" className="btn-comprar" onClick={() => abrirPrecios(ev)}>
                      Comprar
                    </IonButton>
                  </div>
                </div>
              </div>
            ))}

            {eventosProximos.length > 0 && (
              <>
                <div className="seccion-proximos">
                  <IonIcon icon={timeOutline} className="seccion-proximos-icon" />
                  <span>Próximos Eventos</span>
                </div>

                {eventosProximos.map((ev) => (
                  <div key={ev.id} className="evento-card evento-card-proximo">
                    <div className="evento-banner">
                      <img
                        src={ev.imagenConcierto}
                        alt={ev.nombreConcierto}
                        className="evento-img evento-img-proximo"
                      />
                      <div className="proximo-overlay-badge">
                        <IonIcon icon={timeOutline} />
                        Próximamente
                      </div>
                    </div>
                    <div className="evento-body">
                      <h2 className="evento-nombre">{ev.nombreConcierto}</h2>
                      <div className="evento-detalle">
                        <IonIcon icon={calendarNumberOutline} />
                        <span>{formatFecha(ev.fechaConcierto)} · {ev.horaConcierto}</span>
                      </div>
                      <div className="evento-detalle">
                        <IonIcon icon={locationOutline} />
                        <span>{ev.lugarConcierto}, {ev.cuidadConcert}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Vista rápida de "Ver precios" — modal tipo hoja inferior, solo
            consulta, sin comprar. Posición fija (no anclada al toque) para
            que siempre se vea completo sin importar en qué parte de la
            lista se tocó "Ver precios". */}
        <IonModal
          isOpen={!!popoverEvento}
          onDidDismiss={cerrarPopoverPrecios}
          className="precios-popover"
          breakpoints={[0, 1]}
          initialBreakpoint={1}
        >
          <div className="precios-popover-body">
            <div className="pp-header">
              <p className="pp-titulo">{popoverEvento?.nombreConcierto}</p>
              <IonButton fill="clear" size="small" onClick={cerrarPopoverPrecios}>
                <IonIcon icon={closeOutline} slot="icon-only" />
              </IonButton>
            </div>

            {cargandoPopover && (
              <div className="pp-cargando"><IonSpinner name="crescent" /></div>
            )}

            {!cargandoPopover && popoverPrecios.length === 0 && (
              <p className="pp-vacio">No hay precios disponibles</p>
            )}

            {!cargandoPopover && popoverPrecios.length > 0 && (
              <ul className="pp-lista">
                {popoverPrecios.map((p) => (
                  <li key={p.id} className="pp-item">
                    <span className="pp-nombre">{p.localidad.replace(/__+/g, '').trim()}</span>
                    <span className="pp-precio">${parseFloat(p.precio_normal).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </IonModal>

        {/* Modal de localidades y precios */}
        <IonModal isOpen={modalAbierto} onDidDismiss={cerrarModal} className="precios-modal">
          <IonHeader>
            <IonToolbar className="modal-toolbar">
              <IonTitle>Selecciona tu localidad</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={cerrarModal}>
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent className="modal-content">
            {eventoSeleccionado && (
              <>
                <div className="modal-evento-banner">
                  <img
                    src={eventoSeleccionado.mapaConcierto}
                    alt={eventoSeleccionado.nombreConcierto}
                    className="modal-evento-img"
                  />
                  <div className="modal-evento-overlay">
                    <h2 className="modal-evento-nombre">{eventoSeleccionado.nombreConcierto}</h2>
                    <p className="modal-evento-fecha">
                      {formatFecha(eventoSeleccionado.fechaConcierto)} · {eventoSeleccionado.horaConcierto}
                    </p>
                    <p className="modal-evento-lugar">
                      {eventoSeleccionado.lugarConcierto}, {eventoSeleccionado.cuidadConcert}
                    </p>
                  </div>
                  <button className="btn-ver-mapa" onClick={() => setVerMapa(true)}>
                    <IonIcon icon={expandOutline} />
                    Ver mapa
                  </button>
                </div>

                <div className="precios-lista">
                  {cargandoPrecios && (
                    <div className="loading-precios">
                      <IonSpinner name="crescent" />
                      <IonText><p>Cargando localidades...</p></IonText>
                    </div>
                  )}

                  {!cargandoPrecios && precios.length === 0 && (
                    <div className="loading-precios">
                      <IonText color="medium"><p>No hay localidades disponibles</p></IonText>
                    </div>
                  )}

                  {!cargandoPrecios && precios.map((precio) => (
                    <div key={precio.id} className="precio-card">
                      <div className="precio-card-top">
                        <div className="precio-info">
                          <span className="precio-localidad">{precio.localidad.replace(/__+/g, '').trim()}</span>
                          <IonBadge className={`badge-tipo ${precio.tipo_localidad === 'mesa' ? 'badge-mesa' : 'badge-correlativo'}`}>
                            {precio.tipo_localidad === 'mesa' ? 'Mesa' : 'General'}
                          </IonBadge>
                        </div>
                        <span className="precio-valor">${parseFloat(precio.precio_normal).toFixed(2)}</span>
                      </div>

                      <div className="precio-disponibles">
                        <IonIcon icon={peopleOutline} />
                        <span>{precio.cantidad_disponible} disponibles</span>
                      </div>

                      {precio.mensaje_promocion ? (
                        <div className="precio-promo">
                          <span>{precio.mensaje_promocion}</span>
                        </div>
                      ) : null}

                      <IonButton
                        expand="block"
                        className="btn-seleccionar"
                        disabled={precio.cantidad_disponible === 0}
                        onClick={() => seleccionarLocalidad(precio)}
                      >
                        {precio.cantidad_disponible === 0 ? 'Agotado' : 'Seleccionar'}
                        <IonIcon icon={chevronForwardOutline} slot="end" />
                      </IonButton>
                    </div>
                  ))}
                </div>
              </>
            )}
          </IonContent>
        </IonModal>

      </IonContent>

      {/* Alert: bloqueo por compra pendiente */}
      <IonAlert
        isOpen={alertPendiente}
        header="Compra pendiente"
        message={`Tienes ${pendientesCount} compra${pendientesCount > 1 ? 's' : ''} pendiente${pendientesCount > 1 ? 's' : ''} de pago. Completa o anula tu compra anterior antes de realizar una nueva.`}
        buttons={[
          {
            text: 'Cerrar',
            role: 'cancel',
          },
          {
            text: 'Ver mis compras',
            role: 'confirm',
            handler: () => history.push('/dashboard/compras'),
          },
        ]}
        onDidDismiss={() => setAlertPendiente(false)}
      />

      <IonToast
        isOpen={!!avisoLink}
        message={avisoLink}
        duration={3500}
        color="danger"
        position="top"
        onDidDismiss={() => setAvisoLink('')}
      />

      {verMapa && eventoSeleccionado && (
        <MapaViewer
          src={eventoSeleccionado.mapaConcierto}
          onClose={() => setVerMapa(false)}
        />
      )}

    </IonPage>
  );
};

export default Eventos;
