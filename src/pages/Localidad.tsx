import { useState, useEffect, useRef } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonIcon, IonButton, IonSpinner,
  IonText, IonToast, useIonViewWillLeave, useIonViewWillEnter,
} from '@ionic/react';
import { useParams, useLocation, useHistory } from 'react-router-dom';
import { addOutline, removeOutline, cartOutline } from 'ionicons/icons';
import axios from 'axios';
import './Localidad.css';

const MAX_SEL = 10;

const API_HDR = {
  'authorization-ticket': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
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

  /* refs para closures en useIonViewWillLeave */
  const selRef        = useRef<SillaItem[]>([]);
  const cantRef       = useRef(1);
  const corrActivoRef = useRef(false);
  const pagandoRef    = useRef(false);      // si el usuario va a pagar, NO liberar

  useEffect(() => { selRef.current   = sel;      }, [sel]);
  useEffect(() => { cantRef.current  = cantidad; }, [cantidad]);

  const precio = parseFloat(st.precio || '0');
  const tipo   = (st.tipo || 'correlativo').toLowerCase();
  const nombre = (st.nombre || '').replace(/__+/g, '').trim();

  /* Carga la localidad */
  useEffect(() => {
    axios
      .get(`https://api.t-ickets.com/mikroti/Boleteria/localidades/${id}/todo`, {
        headers: { Authorization: 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==' },
      })
      .then(({ data }) => { if (data.estado) setLocalidad(data.data); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [id]);

  /* Cuando el usuario vuelve desde Pago sin completar, resetear el flag */
  useIonViewWillEnter(() => {
    pagandoRef.current = false;
  });

  /* ── Liberar asientos al salir (a menos que el usuario vaya a pagar) ── */
  useIonViewWillLeave(() => {
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

  /* ── Toggle unificado ── */
  const toggle = async (item: SillaItem) => {
    if (item.estado !== 'disponible') return;
    if (procesando.has(item.idsilla)) return;
    const isSel = sel.some(s => s.idsilla === item.idsilla);
    if (!isSel && sel.length >= MAX_SEL) return;

    setProcesando(p => new Set([...p, item.idsilla]));
    try {
      await toggleSilla(item);
    } catch {
      setToast('No se pudo procesar el asiento. Intenta de nuevo.');
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

  const seatClass = (item: SillaItem) => {
    if (item.estado !== 'disponible') return 'sc-ocp';
    if (sel.some(s => s.idsilla === item.idsilla)) return 'sc-sel';
    return 'sc-disp';
  };

  const bloqueada = (item: SillaItem) =>
    item.estado !== 'disponible' ||
    (sel.length >= MAX_SEL && !sel.some(s => s.idsilla === item.idsilla));

  const cantCarrito  = tipo === 'correlativo' ? cantidad : sel.length;
  const totalCarrito = cantCarrito * precio;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="loc-toolbar">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard/eventos" text="" />
          </IonButtons>
          <IonTitle>{nombre || 'Seleccionar asientos'}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="loc-content">

        {st.mapaConcierto && (
          <div className="venue-map">
            <p className="venue-label">Mapa del lugar</p>
            <img src={st.mapaConcierto} alt="Mapa" className="venue-img" />
          </div>
        )}

        {cargando && (
          <div className="loc-loading">
            <IonSpinner name="crescent" /><IonText><p>Cargando...</p></IonText>
          </div>
        )}

        {!cargando && localidad && (
          <>
            <div className="res-row">
              {/* <div className="res-chip ch-total">
                <b>{localidad.resumen.total}</b><small>Total</small>
              </div>
              <div className="res-chip ch-disp">
                <b>{localidad.resumen.disponibles}</b><small>Disponibles</small>
              </div>
              <div className="res-chip ch-ocp">
                <b>{localidad.resumen.ocupadas}</b><small>Ocupadas</small>
              </div> */}
            </div>
            

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
                              <div className="seats-inline">
                                {items.map((item, idx) => (
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
    </IonPage>
  );
};

export default Localidad;
