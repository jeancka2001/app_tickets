import { useState, useEffect, useRef } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButtons, IonIcon, IonButton, IonSpinner, IonAlert,
  IonText, IonToast, IonModal, useIonViewWillLeave, useIonViewWillEnter,
} from '@ionic/react';
import { useParams, useLocation, useHistory } from 'react-router-dom';
import { addOutline, removeOutline, cartOutline, chevronBackOutline, gridOutline, closeOutline, timeOutline } from 'ionicons/icons';
import axios from 'axios';
import { obtenerConfiguracionLocalidad, obtenerMapaLocalidad, claseAlineacion, enOrdenVisual } from '../utils/localidadConfig';
import { MS_LOGIN_AUTH_HEADERS } from '../utils/msLoginAuth';
import ZoomableImage from '../components/ZoomableImage';
import './Localidad.css';

const MAX_SEL = 10;

/* Tiempo máximo para completar la selección antes de liberar automáticamente
   (mismo espíritu del timer de 10 min que tiene la web, pero más corto y
   estricto porque acá si además refrescamos el mapa en vivo). */
const TIEMPO_SELECCION_SEG = 180;
/* Cada cuánto se refresca el mapa mientras el cliente está eligiendo, para
   que si otra persona reserva/compra un asiento se vea al toque. */
const POLL_MS = 15000;

const formatMMSS = (seg: number) => {
  const s = Math.max(0, seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const API_HDR = {
  ...MS_LOGIN_AUTH_HEADERS,
  'Content-Type': 'application/json',
};

const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

interface SillaItem {
  numero?: string;
  fila?: string;
  mesa?: string;
  silla?: string;          // "A1-s-3" en mesas
  estado: string;
  idsilla: number;
  cedula?: string;
  id_registra_compra: string;
  detalle?: null;
}
interface Resumen { total: number; disponibles: number; ocupadas: number; }
interface LocalidadData {
  id: number;
  nombre: string;
  tipo: string;
  resumen: Resumen;
  items: SillaItem[];
}
interface NavState {
  nombre: string;
  precio: string;
  tipo: string;
  nombreEvento?: string;
  mapaConcierto?: string;
  codigoEvento?: string;
  idPrecio?: number;
  comisionBoleto?: string;
  iva?: string;
}

/* Número visible en el botón */
const sillaNum = (item: SillaItem, idx: number) =>
  item.silla?.split('-s-')[1] ?? item.numero ?? String(idx + 1);

const agruparMesas = (items: SillaItem[]) => {
  const r: Record<string, Record<string, SillaItem[]>> = {};
  items.forEach(item => {
    const f = item.fila ?? 'A';
    const m = item.mesa ?? 'M1';
    if (!r[f]) r[f] = {};
    if (!r[f][m]) r[f][m] = [];
    r[f][m].push(item);
  });
  return r;
};

const agruparFilas = (items: SillaItem[]) => {
  const r: Record<string, SillaItem[]> = {};
  items.forEach((item, i) => {
    const k = item.fila ?? String.fromCharCode(65 + Math.floor(i / 20));
    if (!r[k]) r[k] = [];
    r[k].push(item);
  });
  return r;
};

const colsMesa = (n: number) => (n <= 6 ? n : n <= 10 ? 5 : 6);

const getUserData = () => {
  try { return JSON.parse(localStorage.getItem('userData') || '{}'); }
  catch { return {}; }
};

/* ─────────────────────────────────────────────────────────────── */

const Localidad: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation<NavState>();
  const history  = useHistory();
  const st = location.state ?? ({} as NavState);
  const [localidad, setLocalidad] = useState<LocalidadData | null>(null);
  const [cargando, setCargando]   = useState(true);
  const [sel, setSel]             = useState<SillaItem[]>([]);
  const [cantidad, setCantidad]   = useState(1);
  const [zoom, setZoom]           = useState(0.7);
  const [procesando, setProcesando] = useState<Set<number>>(new Set());
  const [toast, setToast]         = useState('');
  const [confirmarSalir, setConfirmarSalir] = useState(false);
  const [alineacionFilas, setAlineacionFilas] = useState<Record<string, string>>({});
  const [ordenSillasFilas, setOrdenSillasFilas] = useState<Record<string, boolean>>({});
  const [idEspacio, setIdEspacio] = useState<number | null>(null);
  const [imagenBloques, setImagenBloques] = useState<string | null>(null);
  const [showBloques, setShowBloques] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(TIEMPO_SELECCION_SEG);

  /* refs para closures en useIonViewWillLeave */
  const selRef        = useRef<SillaItem[]>([]);
  const cantRef       = useRef(1);
  const corrActivoRef = useRef(false);
  const pagandoRef    = useRef(false);      // si el usuario va a pagar, NO liberar
  const idEspacioRef  = useRef<number | null>(null);
  const cargandoRef   = useRef(true);

  /* Temporizador de selección + polling en vivo del mapa */
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const salioPorTiempoRef = useRef(false);

  useEffect(() => { selRef.current   = sel;      }, [sel]);
  useEffect(() => { cantRef.current  = cantidad; }, [cantidad]);
  useEffect(() => { idEspacioRef.current = idEspacio; }, [idEspacio]);
  useEffect(() => { cargandoRef.current = cargando; }, [cargando]);

  const precio = parseFloat(st.precio || '0');
  const tipo   = (st.tipo || 'correlativo').toLowerCase();
  const nombre = (st.nombre || '').replace(/__+/g, '').trim();

  /* ── Salir de la pantalla (botón de la barra o atrás físico/gesto) ──
     Si hay algo reservado, confirma antes de descartarlo — useIonViewWillLeave
     ya se encarga de liberar los asientos en el servidor una vez se confirma. */
  const haySeleccionActiva = () =>
    tipo === 'correlativo' ? corrActivoRef.current : selRef.current.length > 0;

  const intentarSalir = () => {
    if (haySeleccionActiva()) setConfirmarSalir(true);
    else history.goBack();
  };

  /* Intercepta el botón físico/gesto de "atrás" de Android solo mientras
     esta pantalla está montada, con la misma confirmación que el botón
     de la barra — sin esto, el gesto nativo se saltaba la confirmación. */
  useEffect(() => {
    const handler = (ev: Event) => {
      (ev as CustomEvent<{ register: (priority: number, cb: () => void) => void }>)
        .detail.register(10, intentarSalir);
    };
    document.addEventListener('ionBackButton', handler);
    return () => document.removeEventListener('ionBackButton', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Carga la localidad. Con reconcile=true limpia de `sel` los asientos
     que ya no están reservados por este usuario en la API (p.ej. orden anulada).

     Correlativo (sin mapa de sillas individuales) sigue usando el endpoint
     viejo, que da directo el resumen de disponibilidad. Fila/mesa usan el
     mismo endpoint que la web (necesita id_espacio, por eso espera a que
     esté disponible) — el viejo "mikroti/Boleteria/.../todo" devolvía
     asientos que ya se habían borrado en la base de datos. */
  const cargarLocalidad = (reconcile = false, silencioso = false) => {
    const esCorrelativo = tipo === 'correlativo';
    if (!esCorrelativo && idEspacioRef.current == null) return;
    if (silencioso && cargandoRef.current) return; // ya hay una carga en curso

    if (!silencioso) setCargando(true);

    const promesa: Promise<LocalidadData | null> = esCorrelativo
      ? axios
          .get(`https://api.t-ickets.com/mikroti/Boleteria/localidades/${id}/todo`, {
            headers: { Authorization: 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==' },
          })
          .then(({ data }) => (data.estado ? (data.data as LocalidadData) : null))
      : obtenerMapaLocalidad(idEspacioRef.current!, id).then((r) => ({
          id: Number(id),
          nombre: '',
          tipo,
          resumen: r.resumen,
          items: r.items,
        }));

    promesa
      .then((data) => {
        if (!data) return;
        setLocalidad(data);
        if (reconcile) {
          const freshItems: SillaItem[] = data.items ?? [];
          const ud = getUserData();
          setSel(prev => prev.filter(s => {
            const fresh = freshItems.find(fi => fi.idsilla === s.idsilla);
            return fresh && fresh.estado !== 'disponible' && fresh.cedula === ud.cedula;
          }));
        }
      })
      .catch(() => {})
      .finally(() => { if (!silencioso) setCargando(false); });
  };

  /* ── Temporizador de selección (3 min) + refresco en vivo del mapa ──
     Arrancan cuando la pantalla se vuelve visible (useIonViewWillEnter) y
     se detienen al salir (useIonViewWillLeave) — así no siguen corriendo
     de fondo mientras el cliente está en /pago con esta página oculta en
     la pila de Ionic. */
  const detenerTemporizadores = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
  };

  const iniciarTemporizadores = () => {
    detenerTemporizadores();
    salioPorTiempoRef.current = false;
    setSegundosRestantes(TIEMPO_SELECCION_SEG);
    timerRef.current = setInterval(() => {
      setSegundosRestantes(s => Math.max(0, s - 1));
    }, 1000);
    pollRef.current = setInterval(() => {
      cargarLocalidad(true, true);
    }, POLL_MS);
  };

  /* Se acabó el tiempo: liberar todo y salir sin pedir confirmación
     (useIonViewWillLeave se encarga de liberar, igual que al salir manual,
     porque pagandoRef sigue en false acá). */
  useEffect(() => {
    if (segundosRestantes > 0 || salioPorTiempoRef.current) return;
    salioPorTiempoRef.current = true;
    detenerTemporizadores();
    setToast('Se acabó el tiempo para completar tu selección. Vuelve a intentarlo.');
    history.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundosRestantes]);

  /* Limpieza de respaldo si el componente llega a desmontarse de verdad */
  useEffect(() => detenerTemporizadores, []);

  /* Carga inicial — correlativo no necesita nada más de entrada */
  useEffect(() => {
    if (tipo === 'correlativo') cargarLocalidad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tipo]);

  /* Imagen de referencia con la división por bloques del recinto (igual
     que "Ver bloques en el mapa" en ModalCarritov.js) — solo se muestra
     si el evento tiene una configurada. */
  useEffect(() => {
    if (!st.codigoEvento) return;
    axios.get(`${URL_BASE}/imagenBloques/${st.codigoEvento}`, { headers: API_HDR })
      .then(({ data }) => {
        if (data?.success && data?.imagen_bloques) setImagenBloques(data.imagen_bloques);
      })
      .catch(() => {});
  }, [st.codigoEvento]);

  /* Alineación/orden por fila + id_espacio configurados en el admin
     (fila/mesa; correlativo no usa mapa de sillas individuales) */
  useEffect(() => {
    if (tipo === 'correlativo') return;
    obtenerConfiguracionLocalidad(id).then(cfg => {
      setAlineacionFilas(cfg.alineacion);
      setOrdenSillasFilas(cfg.ordenSillas);
      setIdEspacio(cfg.idEspacio);
    });
  }, [id, tipo]);

  /* En cuanto se conoce id_espacio (fila/mesa) recién se puede pedir el mapa real */
  useEffect(() => {
    if (tipo === 'correlativo' || idEspacio == null) return;
    cargarLocalidad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEspacio, tipo]);

  /* Al volver a la página: resetear flag de pago, recargar estado real de
     asientos y arrancar el temporizador de 3 min + el refresco en vivo. */
  useIonViewWillEnter(() => {
    pagandoRef.current = false;
    cargarLocalidad(true);
    iniciarTemporizadores();
  });

  /* ── Liberar asientos al salir (a menos que el usuario vaya a pagar) ── */
  useIonViewWillLeave(() => {
    detenerTemporizadores();
    if (pagandoRef.current) return;

    const ud             = getUserData();
    const cur            = selRef.current;
    const cedulaPayload  = ud.cedula || '';

    /* Liberar cada silla seleccionada con el mismo payload que toggleSilla
       (mismo endpoint → la API invierte el estado: reservado → disponible) */
    cur.forEach(item => {
      axios.post(
        `${URL_BASE}/selecionar_localidad_correlativa`,
        {
          cedula:   cedulaPayload,
          estado:   'disponible',
          id,
          cantidad: 1,
          mas:      'mas',
          mesa: [{
            id_silla: item.idsilla,
            id,
            cedula:   cedulaPayload,
            ...item,
            estado:   '',
          }],
        },
        { headers: API_HDR }
      ).catch(() => {});
    });

    /* Liberar correlativo */
    if (corrActivoRef.current) {
      axios.post(
        `${URL_BASE}/selecionar_localidad_correlativa`,
        {
          id,
          cedula:      cedulaPayload,
          estado:      'reservado',
          cantidad:    0,
          mas:         'eliminar',
          id_usuario:  ud.id || ud.id_usuario || 0,
          id_operador: 0,
        },
        { headers: API_HDR }
      ).catch(() => {});
      corrActivoRef.current = false;
    }
  });

  /* ── Toggle silla (mesa y fila) — mismo payload que el proyecto web ── */
  const toggleSilla = async (item: SillaItem) => {
    const ud = getUserData();
    const cedulaPayload = ud.cedula || '';

    const { data } = await axios.post(
      `${URL_BASE}/selecionar_localidad_correlativa`,
      {
        cedula:   cedulaPayload,
        estado:   'disponible',
        id,
        cantidad: 1,
        mas:      'mas',
        mesa: [
          {
            id_silla: item.idsilla,
            id,
            cedula:   cedulaPayload,
            ...item,          // fila, mesa, silla, idsilla, id_registra_compra…
            estado:   '',     // sobreescribe el estado del item (debe ir vacío al seleccionar)
          }
        ],
      },
      { headers: API_HDR }
    );

    /*
     * success:true  → { insert: [idsilla…] reservados, update: [idsilla…] liberados }
     * success:false → error del servidor
     */
    if (data.success) {
      const reserved = Array.isArray(data.insert) && (data.insert as number[]).includes(item.idsilla);
      const released = Array.isArray(data.update) && (data.update as number[]).includes(item.idsilla);
      if (reserved) setSel(p => [...p, item]);
      if (released) setSel(p => p.filter(s => s.idsilla !== item.idsilla));
    } else {
      throw new Error(data.message ?? 'Error al reservar');
    }
  };

  /* ── Toggle unificado ──
     Un asiento "mío" (ya en `sel`) debe poder deseleccionarse aunque el
     último refresco lo muestre como no-disponible (así lo devuelve la API
     una vez reservado) — solo bloqueamos tomar asientos ajenos. */
  const toggle = async (item: SillaItem) => {
    const isSel = sel.some(s => s.idsilla === item.idsilla);
    if (!isSel && item.estado !== 'disponible') return;
    if (procesando.has(item.idsilla)) return;
    if (!isSel && sel.length >= MAX_SEL) return;

    setProcesando(p => new Set([...p, item.idsilla]));
    try {
      await toggleSilla(item);
    } catch {
      setToast('Este asiento ya no está disponible. El mapa se ha actualizado.');
      cargarLocalidad(true); // otro usuario tomó el asiento — refrescar mapa
    } finally {
      setProcesando(p => { const n = new Set(p); n.delete(item.idsilla); return n; });
    }
  };

  /* ── Cambiar cantidad correlativa ── */
  const cambiarCantidad = async (delta: 1 | -1) => {
    if (!localidad) return;
    const max  = Math.min(localidad.resumen.disponibles, MAX_SEL);
    const next = cantidad + delta;
    if (next < 1 || next > max) return;

    const ud  = getUserData();
    const mas: 'mas' | 'menos' = delta === 1 ? 'mas' : 'menos';
    setCantidad(next);

    try {
      await axios.post(
        `${URL_BASE}/selecionar_localidad_correlativa`,
        {
          id,
          cedula:      ud.cedula || '',
          estado:      'reservado',
          cantidad:    1,
          mas,
          id_usuario:  ud.id || ud.id_usuario || 0,
          id_operador: 0,
        },
        { headers: API_HDR }
      );
      corrActivoRef.current = true;
    } catch {
      setCantidad(cantidad);
      setToast('Error al actualizar la reserva. Intenta de nuevo.');
    }
  };

  /* Un asiento "mío" siempre se ve como seleccionado (amarillo), aunque el
     refresco en vivo ya lo devuelva como reservado — para todos los demás,
     "reservado" (otra persona lo tiene apartado ahora mismo, puede que
     todavía libere) se distingue de "ocupado/vendido" (definitivo). */
  const seatClass = (item: SillaItem) => {
    if (sel.some(s => s.idsilla === item.idsilla)) return 'sc-sel';
    if (item.estado === 'disponible') return 'sc-disp';
    if (item.estado === 'reservado') return 'sc-res';
    return 'sc-ocp';
  };

  const bloqueada = (item: SillaItem) => {
    if (sel.some(s => s.idsilla === item.idsilla)) return false;
    return item.estado !== 'disponible' || sel.length >= MAX_SEL;
  };

  const cantCarrito  = tipo === 'correlativo' ? cantidad : sel.length;
  const totalCarrito = cantCarrito * precio;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="loc-toolbar">
          <IonButtons slot="start">
            <IonButton onClick={intentarSalir}>
              <IonIcon icon={chevronBackOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle size="small">{nombre || 'Seleccionar asientos'}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="loc-content">

        <div className={`temporizador-chip ${segundosRestantes <= 30 ? 'temporizador-critico' : ''}`}>
          <IonIcon icon={timeOutline} />
          <span>Tienes {formatMMSS(segundosRestantes)} para completar tu selección</span>
        </div>

        {st.mapaConcierto && (
          <div className="venue-map">
            <p className="venue-label">Mapa del lugar</p>
            <img src={st.mapaConcierto} alt="Mapa" className="venue-img" />
          </div>
        )}

        {/* Se muestra para cualquier evento: si el admin subió una imagen de
            bloques específica se usa esa, si no, cae al mismo mapa del lugar
            de arriba (así el botón siempre está disponible). */}
        {(imagenBloques || st.mapaConcierto) && (
          <div className="venue-bloques">
            <IonButton fill="outline" size="small" onClick={() => setShowBloques(true)}>
              <IonIcon icon={gridOutline} slot="start" />
              Ver bloques en el mapa
            </IonButton>
          </div>
        )}

        {cargando && (
          <div className="loc-loading">
            <IonSpinner name="crescent" /><IonText><p>Cargando...</p></IonText>
          </div>
        )}

        {!cargando && localidad && (
          <>
            {/* ── CORRELATIVO ── */}
            {tipo === 'correlativo' && (
              <div className="corr-view">
                <p className="corr-desc">Boletos asignados automáticamente. Máx. {MAX_SEL}.</p>
                <div className="qty-row">
                  <button className="qty-btn" onClick={() => cambiarCantidad(-1)}>
                    <IonIcon icon={removeOutline} />
                  </button>
                  <span className="qty-num">{cantidad}</span>
                  <button className="qty-btn" onClick={() => cambiarCantidad(1)}>
                    <IonIcon icon={addOutline} />
                  </button>
                </div>
                <p className="price-line">
                  ${precio.toFixed(2)} × {cantidad} = <strong>${totalCarrito.toFixed(2)}</strong>
                </p>
              </div>
            )}

            {/* ── MAPA INTERACTIVO ── */}
            {(tipo === 'fila' || tipo === 'mesa') && (
              <div className="map-section">
                <div className="map-topbar">
                  <p className="corr-desc">Seleccione Boletos. Máx. {MAX_SEL}.</p>
                  <div className="legend">
                    <span className="leg l-disp">Disponible</span>
                    <span className="leg l-res">Reservada</span>
                    <span className="leg l-ocp">Ocupada</span>
                    <span className="leg l-sel">Seleccionada</span>
                  </div>
                  <div className="zoom-bar">
                    <button className="z-btn" onClick={() => setZoom(z => Math.max(0.4, +(z-0.15).toFixed(2)))}>−</button>
                    <span className="z-pct">{Math.round(zoom * 100)}%</span>
                    <button className="z-btn" onClick={() => setZoom(z => Math.min(3, +(z+0.15).toFixed(2)))}>+</button>
                  </div>
                </div>

                {sel.length >= MAX_SEL && (
                  <p className="max-warn">Máximo {MAX_SEL} asientos por compra</p>
                )}

                <div className="map-scroll">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <div className="map-canvas" style={{ zoom } as any}>

                    {/* VISTA FILA */}
                    {tipo === 'fila' && (
                      <div className="fila-map">
                        <div className="escenario">▲ ESCENARIO ▲</div>
                        {Object.entries(agruparFilas(localidad.items)).map(([f, items]) => {
                          const disp = items.filter(i => i.estado === 'disponible').length;
                          return (
                            <div key={f} className="fila-strip">
                              <div className="fila-tag">
                                <span>Fila {f}</span>
                                <small>{disp} disp.</small>
                              </div>
                              <div className="seats-inline" style={{ justifyContent: claseAlineacion(alineacionFilas, f) }}>
                                {enOrdenVisual(ordenSillasFilas, f, items).map((item, idx) => (
                                  <button key={item.idsilla}
                                    className={`seat ${seatClass(item)} ${bloqueada(item) && item.estado === 'disponible' ? 'seat-blocked' : ''} ${procesando.has(item.idsilla) ? 'seat-loading' : ''}`}
                                    onClick={() => toggle(item)}
                                    disabled={bloqueada(item) || procesando.has(item.idsilla)}>
                                    {procesando.has(item.idsilla) ? '…' : sillaNum(item, idx)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* VISTA MESA */}
                    {tipo === 'mesa' && (
                      <div className="mesa-map">
                        {Object.entries(agruparMesas(localidad.items)).map(([fila, mesas]) => (
                          <div key={fila} className="fila-section">
                            <div className="fila-title">Fila {fila}</div>
                            <div className="mesas-row">
                              {Object.entries(mesas).map(([mk, items]) => {
                                const disp   = items.filter(i => i.estado === 'disponible').length;
                                const selCnt = items.filter(i => sel.some(s => s.idsilla === i.idsilla)).length;
                                const cols   = colsMesa(items.length);
                                const llena  = disp === 0;
                                return (
                                  <div key={mk} className={`mesa-box ${llena ? 'mesa-box-llena' : selCnt > 0 ? 'mesa-box-sel' : ''}`}>
                                    <div className="mesa-box-head">
                                      <span className="mesa-lbl">{mk}</span>
                                      {selCnt > 0
                                        ? <span className="mesa-sel-cnt">{selCnt}★</span>
                                        : <span className={`mesa-disp-cnt ${llena ? 'cnt-llena' : ''}`}>
                                            {llena ? 'Llena' : `${disp}`}
                                          </span>
                                      }
                                    </div>
                                    <div className="mesa-seats"
                                      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                                      {items.map((item, idx) => (
                                        <button key={item.idsilla}
                                          className={`seat seat-sm ${seatClass(item)} ${bloqueada(item) && item.estado === 'disponible' ? 'seat-blocked' : ''} ${procesando.has(item.idsilla) ? 'seat-loading' : ''}`}
                                          onClick={() => toggle(item)}
                                          disabled={bloqueada(item) || procesando.has(item.idsilla)}
                                          title={item.silla ?? mk}>
                                          {procesando.has(item.idsilla) ? '…' : sillaNum(item, idx)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ height: cantCarrito > 0 ? '88px' : '20px' }} />
      </IonContent>

      {cantCarrito > 0 && (
        <div className="cart-footer">
          <div className="cart-left">
            <IonIcon icon={cartOutline} className="cart-ico" />
            <div>
              <span className="cart-q">{cantCarrito}/{MAX_SEL} asientos</span>
              <span className="cart-t">${totalCarrito.toFixed(2)}</span>
            </div>
          </div>
          <IonButton className="btn-pay" onClick={() => {
            pagandoRef.current = true;
            history.push('/pago', {
              idLocalidad:     id,
              codigoEvento:    st.codigoEvento   || '',
              idPrecio:        st.idPrecio        ?? 0,
              nombreEvento:    st.nombreEvento    || '',
              localidadNombre: nombre,
              precio,
              cantidad:        cantCarrito,
              idSillas:        tipo === 'correlativo' ? [] : sel.map(s => s.idsilla),
              comisionBoleto:  parseFloat(st.comisionBoleto || '0'),
              iva:             st.iva || '1.00',
            });
          }}>
            Pagar
          </IonButton>
        </div>
      )}

      <IonToast
        isOpen={!!toast}
        message={toast}
        duration={3000}
        position="top"
        color="danger"
        onDidDismiss={() => setToast('')}
      />

      <IonModal isOpen={showBloques} onDidDismiss={() => setShowBloques(false)}
        breakpoints={[0, 1]} initialBreakpoint={1}>
        <IonHeader>
          <IonToolbar className="loc-toolbar">
            <IonTitle>División por bloques</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowBloques(false)}>
                <IonIcon icon={closeOutline} slot="icon-only" />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="loc-content" scrollY={false}>
          {(imagenBloques || st.mapaConcierto) && (
            <ZoomableImage src={imagenBloques || st.mapaConcierto || ''} alt="División por bloques" />
          )}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={confirmarSalir}
        header="¿Salir sin terminar?"
        message="Vas a perder los asientos que seleccionaste."
        buttons={[
          { text: 'Seguir eligiendo', role: 'cancel' },
          { text: 'Salir', role: 'destructive', handler: () => history.goBack() },
        ]}
        onDidDismiss={() => setConfirmarSalir(false)}
      />
    </IonPage>
  );
};

export default Localidad;
