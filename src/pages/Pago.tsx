import { useState, useRef } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonButton, IonSpinner, IonIcon,
} from '@ionic/react';
import { useLocation, useHistory } from 'react-router-dom';
import {
  checkmarkCircleOutline, openOutline, cameraOutline,
  copyOutline, checkmarkOutline, alertCircleOutline,
  closeCircleOutline, logoWhatsapp,
} from 'ionicons/icons';
import axios from 'axios';
import './Pago.css';

interface PagoState {
  idLocalidad: string;
  codigoEvento: string;
  idPrecio: number;
  nombreEvento: string;
  localidadNombre: string;
  precio: number;
  cantidad: number;
  idSillas: number[];
  comisionBoleto: number;
  iva: string;
}

interface OcrExtracto {
  numero_comprobante?: string;
  referencia?: string;
  monto?: string | number;
  fecha?: string;
  banco_emisor?: string;
  banco_receptor?: string;
  nombre_receptor?: string;
  estado?: string;
  validacion?: {
    nivel_sospecha?: string;
    posible_adulteracion?: boolean;
  };
}

const API_HDR = {
  'authorization-ticket': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
  'Content-Type': 'application/json',
};
const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

const METODOS = [
  { key: 'Tarjeta',         label: 'Tarjeta de crédito / débito', pct: 0.10, desc: '+10% comisión procesamiento' },
  { key: 'Duna',            label: 'Duna / Banco Pichincha',       pct: 0.06, desc: '+6% comisión procesamiento'  },
  { key: 'Banco Guayaquil', label: 'Banco Guayaquil App',          pct: 0.02, desc: '+2% comisión procesamiento'  },
  { key: 'Deposito',        label: 'Transferencia / Depósito',     pct: 0.04, desc: '+4%, aprobación manual'       },
];

const CUENTAS = [
  { banco: 'Banco Pichincha', cuenta: '2100298093', ruc: '0993377293001', tipo: 'Corriente'   },
  { banco: 'Banco Guayaquil',  cuenta: '18057352',   ruc: '0993377293001', tipo: 'Corriente' },
];

const getUserData = () => {
  try { return JSON.parse(localStorage.getItem('userData') || '{}'); }
  catch { return {}; }
};

type Fase = 'seleccion' | 'deposito' | 'bg' | 'exito';

const Pago: React.FC = () => {
  const location = useLocation<PagoState>();
  const history  = useHistory();
  const st = location.state ?? ({} as PagoState);
  const ud = getUserData();

  /* ── Selección ── */
  const [metodo, setMetodo]     = useState('Tarjeta');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');
  const [urlPago, setUrlPago]   = useState('');
  const [fase, setFase]         = useState<Fase>('seleccion');
  const [idRegistro, setIdRegistro] = useState<number | null>(null);

  /* ── Depósito ── */
  const inputRef       = useRef<HTMLInputElement>(null);
  const [imagenLocal,  setImagenLocal]  = useState<string | null>(null);
  const [imagenUrl,    setImagenUrl]    = useState<string | null>(null);
  const [analizando,   setAnalizando]   = useState(false);
  const [ocr,          setOcr]          = useState<OcrExtracto | null>(null);
  const [ocrError,     setOcrError]     = useState(false);
  const [copiado,      setCopiado]      = useState<string | null>(null);
  const [enviandoPago, setEnviandoPago] = useState(false);
  const [errorDep,     setErrorDep]     = useState('');

  const met = METODOS.find(x => x.key === metodo)!;

  /* Convertir siempre a number — location.state puede venir como string
     cuando Ionic reutiliza la página en la pila de navegación */
  const precioNum   = Number(st.precio        || 0);
  const cantidadNum = Number(st.cantidad      || 1);
  const comBoleto   = Number(st.comisionBoleto || 0);

  const subtotal         = precioNum * cantidadNum;
  const comisionServicio = cantidadNum * comBoleto;
  const ivaRate          = parseFloat((st.iva || '1.00').replace('1.', '0.'));
  const ivaImporte       = subtotal * ivaRate;
  const comisionBancaria = (subtotal + ivaImporte) * met.pct;
  const total            = subtotal + comisionServicio + ivaImporte + comisionBancaria;

  const copiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2000);
    }).catch(() => {});
  };

  /* ── Crear orden ── */
  const confirmar = async () => {
    setCargando(true);
    setError('');
    try {
      const payload = {
        id_usuario:  ud.id || ud.id_usuario || 0,
        cedula:      ud.cedula || '',
        email:       metodo === 'Deposito' ? 'pending.aprobacion@no-mail.local' : (ud.email || ''),
        forma_pago: metodo === 'Banco Guayaquil' ? 'Efectivo' : metodo,
        concierto: [{
          nombreConcierto:     st.nombreEvento    || '',
          id_localidad:        st.idLocalidad,
          idespaciolocalida:   st.idPrecio        || 0,
          CODIGEVENTO:         st.codigoEvento    || '',
          cantidad:            st.cantidad        || 1,
          localidad_nombre:    st.localidadNombre || '',
          localidad_precio:    st.precio          || 0,
          comision_por_boleto: comisionServicio.toFixed(2),
          iva:                 ivaImporte.toFixed(2),
          discapacida:         false,
          menor:               false,
          naipes:              false,
          id_sillas:           st.idSillas        || [],
        }],
        valores: {
          total:             total.toFixed(2),
          comision:          comisionServicio.toFixed(2),
          subtotal:          subtotal.toFixed(2),
          comision_bancaria: comisionBancaria.toFixed(2),
          description:       st.localidadNombre || '',
          iva:               ivaImporte.toFixed(2),
        },
        transaccion: '',
        canal: 'app',
      };

      const { data } = await axios.post(`${URL_BASE}/registraCompra`, payload, { headers: API_HDR });

      /* ── Banco Guayaquil: recaudación presencial ──────────────────────
         Solo mostramos el código (cédula) con instrucciones. No abrimos
         ninguna URL ni procesamos respuesta adicional. Si el backend
         devuelve explícitamente success:false con mensaje, mostramos error. */
      if (metodo === 'Banco Guayaquil') {
        if (data?.success === false && data?.message) {
          setError(data.message);
        } else {
          setFase('bg');
        }
        return;
      }

      if (data.success || data.idRegistro) {
        setIdRegistro(data.idRegistro || data.id || 0);
        if (metodo === 'Deposito') {
          setFase('deposito');
        } else {
          if (data.url) { setUrlPago(data.url); window.open(data.url, '_system'); }
          setFase('exito');
        }
      } else {
        setError(data.message ?? 'No se pudo procesar el pago. Intenta de nuevo.');
      }
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'Error de conexión. Verifica tu internet e intenta de nuevo.'
      );
    } finally {
      setCargando(false);
    }
  };

  /* ── Subir imagen + OCR ── */
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => setImagenLocal(ev.target?.result as string);
    reader.readAsDataURL(file);

    setImagenUrl(null);
    setOcr(null);
    setOcrError(false);
    setErrorDep('');
    setAnalizando(true);

    try {
      // 1. Subir imagen
      const form = new FormData();
      form.append('file', file);
      const { data: up } = await axios.post('https://codigomarret.online/upload/api/img', form);
      if (!up.success) throw new Error('upload_failed');
      const url: string = up.url || '';
      if (!url) throw new Error('no_url');
      setImagenUrl(url);

      // 2. OCR
      const { data: ocrResp } = await axios.post(
        'https://api.t-ickets.com/mikroti/Boleteria/imagenocr/analizar',
        { url_imagen: url, request_id: String(Date.now()), guardar_bd: false },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const extraido = (ocrResp?.data ?? {}) as OcrExtracto;
      setOcr(extraido);
    } catch {
      setOcrError(true);
      setErrorDep('No se pudo analizar la imagen. Intenta tomar la foto con mejor iluminación.');
    } finally {
      setAnalizando(false);
    }
  };

  /* ── Confirmar pago con datos OCR ── */
  const confirmarDeposito = async (forzarRevision = false) => {
    if (!imagenUrl) { setErrorDep('Adjunta la imagen del comprobante.'); return; }
    setEnviandoPago(true);
    setErrorDep('');
    try {
      const { data } = await axios.post(
        `${URL_BASE}/registraPagos`,
        {
          id:                idRegistro,
          id_usuario:        ud.id || ud.id_usuario || 0,
          forma_pago:        'Deposito',
          link_comprobante:  imagenUrl,
          numeroTransaccion: numTxDep,
          estado:            (!forzarRevision && esOCRFuerte) ? 'Pagado' : 'Comprobar',
          banco:             bancoDep,
          bancos:            bancoDep,
          cedula:            ud.cedula || '',
          total_pago:        total.toFixed(2),
        },
        { headers: API_HDR }
      );
      if (data.success) {
        setFase('exito');
      } else {
        setErrorDep(data.message ?? 'No se pudo registrar el pago. Intenta de nuevo.');
      }
    } catch {
      setErrorDep('Error de conexión al confirmar el pago.');
    } finally {
      setEnviandoPago(false);
    }
  };

  /* Variables derivadas para la fase depósito */
  const numTxDep   = String(ocr?.numero_comprobante || ocr?.referencia || '').trim();
  const bancoDep   = String(ocr?.banco_emisor || ocr?.banco_receptor || '').trim();
  const montoOCR   = Number(ocr?.monto);
  const montoOk    = Number.isFinite(montoOCR) && Math.abs(montoOCR - total) <= 0.05;
  const ocrOk      = String(ocr?.estado || '').toLowerCase() === 'aprobado';
  const nivelSosp  = String(ocr?.validacion?.nivel_sospecha || '').toLowerCase();
  const adulter    = Boolean(ocr?.validacion?.posible_adulteracion);
  const esOCRFuerte = ocr !== null && ocrOk && nivelSosp === 'bajo' && !adulter && montoOk && numTxDep.length >= 4;
  const tieneProblema = !analizando && (ocrError || (ocr !== null && !esOCRFuerte));

  /* ── Un único IonPage siempre montado — evita blank screen en Ionic ── */
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="pago-toolbar">
          {fase === 'seleccion' && (
            <IonButtons slot="start">
              <IonBackButton defaultHref="/dashboard/eventos" text="" />
            </IonButtons>
          )}
          <IonTitle>
            {fase === 'exito'    ? 'Pago registrado'
              : fase === 'deposito' ? 'Realizar transferencia'
              : fase === 'bg'       ? 'Código de pago'
              : 'Confirmar pago'}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="pago-content">

        {/* ─── ÉXITO ─── */}
        {fase === 'exito' && (
          <div className="pago-exito">
            <IonIcon icon={checkmarkCircleOutline} className="pago-exito-icon" />
            <h2>¡Pedido registrado!</h2>
            {metodo === 'Deposito'
              ? <p>Tu comprobante fue recibido. Verificaremos tu pago y activaremos tus boletos en breve.</p>
              : <p>Completa tu pago en la pasarela. Si no se abrió automáticamente, usa el botón de abajo.</p>
            }
            {urlPago && (
              <IonButton className="btn-ir-pago" href={urlPago} target="_blank">
                <IonIcon icon={openOutline} slot="start" />
                Ir al pago
              </IonButton>
            )}
            <IonButton fill="outline" className="btn-volver-inicio"
              onClick={() => history.replace('/dashboard/compras')}>
              Ver mis compras
            </IonButton>
          </div>
        )}

        {/* ─── DEPÓSITO ─── */}
        {fase === 'deposito' && (
          <div className="pago-container">

            <div className="pago-card dep-total-card">
              <p className="dep-total-label">Total a transferir</p>
              <p className="dep-total-monto">${total.toFixed(2)}</p>
              <p className="dep-total-sub">{st.nombreEvento || '—'}</p>
            </div>

            <div className="pago-card">
              <h3 className="pago-card-title">Cuentas bancarias</h3>
              {CUENTAS.map(c => (
                <div key={c.banco} className="dep-cuenta">
                  <div className="dep-cuenta-head">
                    <span className="dep-banco-nombre">{c.banco}</span>
                    <span className="dep-cuenta-tipo">{c.tipo}</span>
                  </div>
                  <div className="dep-dato-fila">
                    <div>
                      <p className="dep-dato-lbl">Número de cuenta</p>
                      <p className="dep-dato-val">{c.cuenta}</p>
                    </div>
                    <button className="dep-copy-btn"
                      onClick={() => copiar(c.cuenta, `cta-${c.banco}`)}>
                      <IonIcon icon={copiado === `cta-${c.banco}` ? checkmarkOutline : copyOutline} />
                      <span>{copiado === `cta-${c.banco}` ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <div className="dep-dato-fila">
                    <div>
                      <p className="dep-dato-lbl">RUC beneficiario</p>
                      <p className="dep-dato-val">{c.ruc}</p>
                    </div>
                    <button className="dep-copy-btn"
                      onClick={() => copiar(c.ruc, `ruc-${c.banco}`)}>
                      <IonIcon icon={copiado === `ruc-${c.banco}` ? checkmarkOutline : copyOutline} />
                      <span>{copiado === `ruc-${c.banco}` ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pago-card">
              <h3 className="pago-card-title">Comprobante de transferencia</h3>

              <input type="file" accept="image/*" ref={inputRef}
                style={{ display: 'none' }} onChange={handleImageChange} />

              {imagenLocal ? (
                <div className="dep-preview">
                  <img src={imagenLocal} alt="Comprobante" className="dep-preview-img" />
                  {!analizando && (
                    <button className="dep-change-btn" onClick={() => inputRef.current?.click()}>
                      Cambiar imagen
                    </button>
                  )}
                </div>
              ) : (
                <div className="dep-upload-area" onClick={() => inputRef.current?.click()}>
                  <IonIcon icon={cameraOutline} className="dep-upload-icon" />
                  <p className="dep-upload-texto">Toca para tomar foto o subir imagen</p>
                  <p className="dep-upload-sub">Captura el comprobante de tu transferencia</p>
                </div>
              )}

              {analizando && (
                <div className="dep-ocr-loading">
                  <IonSpinner name="crescent" />
                  <span>Analizando comprobante</span>
                </div>
              )}

              {ocrError && !analizando && (
                <div className="dep-ocr-chip dep-ocr-chip-error">
                  <IonIcon icon={closeCircleOutline} />
                  <span>No se pudo leer el comprobante. Intenta con mejor iluminación.</span>
                </div>
              )}

              {ocr && !analizando && (
                <div className="dep-ocr-panel">
                  <div className={`dep-ocr-estado ${ocrOk ? 'dep-ocr-ok' : 'dep-ocr-warn'}`}>
                    <IonIcon icon={ocrOk ? checkmarkCircleOutline : alertCircleOutline} />
                    <span>{ocrOk ? 'Comprobante verificado' : 'Requiere revisión manual'}</span>
                  </div>
                  <div className="dep-ocr-datos">
                    {numTxDep && (
                      <div className="dep-ocr-dato">
                        <span className="dep-ocr-lbl">N° Transacción</span>
                        <span className="dep-ocr-val">{numTxDep}</span>
                      </div>
                    )}
                    {ocr.monto !== undefined && (
                      <div className="dep-ocr-dato">
                        <span className="dep-ocr-lbl">Monto detectado</span>
                        <span className={`dep-ocr-val ${montoOk ? 'dep-ocr-monto-ok' : 'dep-ocr-monto-err'}`}>
                          ${Number(ocr.monto).toFixed(2)}{montoOk ? ' ✓' : ' — difiere del total'}
                        </span>
                      </div>
                    )}
                    {(ocr.banco_emisor || ocr.banco_receptor) && (
                      <div className="dep-ocr-dato">
                        <span className="dep-ocr-lbl">Banco</span>
                        <span className="dep-ocr-val">{ocr.banco_emisor || ocr.banco_receptor}</span>
                      </div>
                    )}
                    {ocr.fecha && (
                      <div className="dep-ocr-dato">
                        <span className="dep-ocr-lbl">Fecha</span>
                        <span className="dep-ocr-val">{ocr.fecha}</span>
                      </div>
                    )}
                    {ocr.nombre_receptor && (
                      <div className="dep-ocr-dato">
                        <span className="dep-ocr-lbl">Beneficiario</span>
                        <span className="dep-ocr-val">{ocr.nombre_receptor}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {errorDep && <p className="pago-error">{errorDep}</p>}

            {/* Sin imagen todavía o analizando → botón deshabilitado */}
            {(!imagenUrl || analizando) && (
              <IonButton expand="block" className="btn-confirmar" disabled>
                {analizando
                  ? <><IonSpinner name="crescent" className="btn-spinner" /> Analizando…</>
                  : 'Confirmar pago'
                }
              </IonButton>
            )}

            {/* OCR perfecto y monto coincide → confirmar directamente */}
            {imagenUrl && !analizando && esOCRFuerte && (
              <IonButton expand="block" className="btn-confirmar"
                onClick={() => confirmarDeposito(false)} disabled={enviandoPago}>
                {enviandoPago
                  ? <><IonSpinner name="crescent" className="btn-spinner" /> Registrando pago…</>
                  : 'Confirmar pago'
                }
              </IonButton>
            )}

            {/* Problema en OCR o monto incorrecto → revisión manual o WhatsApp */}
            {tieneProblema && (
              <div className="dep-botones-alt">
                <IonButton expand="block" className="btn-confirmar"
                  onClick={() => confirmarDeposito(true)} disabled={!imagenUrl || enviandoPago}>
                  {enviandoPago
                    ? <><IonSpinner name="crescent" className="btn-spinner" /> Enviando…</>
                    : 'Enviar para revisión manual'
                  }
                </IonButton>
                <IonButton expand="block" fill="outline" className="btn-whatsapp"
                  onClick={() => window.open('https://api.whatsapp.com/send?phone=593980009000', '_blank')}>
                  <IonIcon icon={logoWhatsapp} slot="start" />
                  Contactar por WhatsApp
                </IonButton>
              </div>
            )}

            <p className="pago-disclaimer">
              Tu pago será verificado y recibirás confirmación por correo electrónico.
            </p>
          </div>
        )}

        {/* ─── Efectivo / RECAUDACIÓN ─── */}
        {fase === 'bg' && (
          <div className="pago-container">

            {/* Cabecera orden */}
            <div className="bg-orden-header">
              <p className="bg-orden-label">Orden generada correctamente</p>
              <p className="bg-orden-sub">
                ¡Estás a punto de finalizar tu compra en T-ickets!
              </p>
            </div>

            {/* Card código */}
            <div className="pago-card bg-codigo-card">
              <div className="bg-servicio-bar">
                <span className="bg-servicio-titulo">Servicio Recaudación</span>
                <span className="bg-servicio-empresa">Empresa: Comnet · Speed · T-ickets</span>
              </div>
              <div className="bg-codigo-row">
                <div className="bg-codigo-col">
                  <span className="bg-col-label">CÓDIGO DE PAGO</span>
                  <span className="bg-col-valor bg-codigo-val">{ud.cedula || '—'}</span>
                </div>
                <div className="bg-codigo-col">
                  <span className="bg-col-label">MONTO A PAGAR</span>
                  <span className="bg-col-valor bg-monto-val">${total.toFixed(2)}</span>
                </div>
              </div>
              <button className="dep-copy-btn bg-copiar-btn"
                onClick={() => copiar(ud.cedula || '', 'bg-code')}>
                <IonIcon icon={copiado === 'bg-code' ? checkmarkOutline : copyOutline} />
                <span>{copiado === 'bg-code' ? 'Código copiado' : 'Copiar código'}</span>
              </button>
            </div>

            {/* Instrucciones */}
            <div className="pago-card">
              <h3 className="pago-card-title">Cómo realizar el pago</h3>
              <ol className="bg-pasos">
                <li className="bg-paso">
                  Dirígete a un punto de pago: <strong>Banco del Barrio, Banco Guayaquil, BienMovil, Facilito</strong> o cualquier red de recaudación.
                </li>
                <li className="bg-paso">
                  Indica que vas a realizar un pago a la empresa: <strong>COMNET - SPEED</strong>
                </li>
                <li className="bg-paso">
                  Proporciona tu número de cédula <strong>{ud.cedula}</strong> como código de pago.
                </li>
                <li className="bg-paso">
                  Cancela el valor de <strong>${total.toFixed(2)}</strong>
                </li>
                <li className="bg-paso">
                  Una vez realizado el pago, tus boletos llegarán al correo <strong>{ud.email}</strong>
                </li>
              </ol>
            </div>

            {/* Canales disponibles */}
            <div className="pago-card">
              <h3 className="pago-card-title">Canales disponibles</h3>
              <div className="bg-canales">
                {['Banco del Barrio', 'Banco Guayaquil App', 'BienMovil', 'Mi Comisariato', 'Facilito', 'Farmacias'].map(c => (
                  <span key={c} className="bg-canal-chip">{c}</span>
                ))}
              </div>
            </div>

            <IonButton expand="block" className="btn-confirmar"
              onClick={() => history.replace('/dashboard/compras')}>
              Ver mis compras
            </IonButton>

            <p className="pago-disclaimer">
              Tu orden quedará activa por 24 horas. Luego del pago, tus boletos se activarán automáticamente.
            </p>
          </div>
        )}

        {/* ─── SELECCIÓN ─── */}
        {fase === 'seleccion' && (
          <div className="pago-container">

            <div className="pago-card">
              <h3 className="pago-card-title">Resumen de compra</h3>
              <p className="pago-evento-nombre">{st.nombreEvento || '—'}</p>
              <div className="pago-fila">
                <span className="pago-lbl">Localidad</span>
                <span className="pago-val">{st.localidadNombre || '—'}</span>
              </div>
              <div className="pago-fila">
                <span className="pago-lbl">Cantidad</span>
                <span className="pago-val">
                  {st.idSillas?.length
                    ? `${st.idSillas.length} asiento${st.idSillas.length > 1 ? 's' : ''}`
                    : `${cantidadNum} boleto${cantidadNum > 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="pago-fila">
                <span className="pago-lbl">Precio por boleto</span>
                <span className="pago-val">${precioNum.toFixed(2)}</span>
              </div>
            </div>

            <div className="pago-card">
              <h3 className="pago-card-title">Método de pago</h3>
              <div className="metodos-lista">
                {METODOS.map(m => (
                  <div key={m.key}
                    className={`metodo-item ${metodo === m.key ? 'metodo-sel' : ''}`}
                    onClick={() => setMetodo(m.key)}>
                    <div className={`radio-circle ${metodo === m.key ? 'radio-on' : ''}`} />
                    <div className="metodo-info">
                      <span className="metodo-lbl">{m.label}</span>
                      <span className="metodo-desc">{m.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pago-card">
              <h3 className="pago-card-title">Detalle de precios</h3>
              <div className="pago-fila">
                <span className="pago-lbl">Subtotal</span>
                <span className="pago-val">${subtotal.toFixed(2)}</span>
              </div>
              {comisionServicio > 0 && (
                <div className="pago-fila">
                  <span className="pago-lbl">Servicio Em. por Boleto</span>
                  <span className="pago-val">${comisionServicio.toFixed(2)}</span>
                </div>
              )}
              {ivaImporte > 0 && (
                <div className="pago-fila">
                  <span className="pago-lbl">IVA ({Math.round(ivaRate * 100)}%)</span>
                  <span className="pago-val">${ivaImporte.toFixed(2)}</span>
                </div>
              )}
              <div className="pago-fila">
                <span className="pago-lbl">Comisión Bancaria ({Math.round(met.pct * 100)}%)</span>
                <span className="pago-val">${comisionBancaria.toFixed(2)}</span>
              </div>
              <div className="pago-divider" />
              <div className="pago-fila pago-total-row">
                <span>TOTAL A PAGAR</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="pago-card">
              <h3 className="pago-card-title">Datos del comprador</h3>
              <div className="pago-fila">
                <span className="pago-lbl">Nombre</span>
                <span className="pago-val">{ud.nombreCompleto || ud.nombres || '—'}</span>
              </div>
              <div className="pago-fila">
                <span className="pago-lbl">Cédula</span>
                <span className="pago-val">{ud.cedula || '—'}</span>
              </div>
              <div className="pago-fila">
                <span className="pago-lbl">Correo</span>
                <span className="pago-val">{ud.email || '—'}</span>
              </div>
            </div>

            {error && <p className="pago-error">{error}</p>}

            <IonButton expand="block" className="btn-confirmar"
              onClick={confirmar} disabled={cargando}>
              {cargando
                ? <><IonSpinner name="crescent" className="btn-spinner" /> Procesando…</>
                : `Confirmar y pagar  $${total.toFixed(2)}`
              }
            </IonButton>

            <p className="pago-disclaimer">
              Al confirmar aceptas los términos y condiciones del evento.
            </p>
          </div>
        )}

      </IonContent>
    </IonPage>
  );
};

export default Pago;
