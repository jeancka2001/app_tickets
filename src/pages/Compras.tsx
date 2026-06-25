import { useState, useRef } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonIcon, IonButton, IonSpinner, IonBadge,
  IonModal, IonButtons,
  IonAlert, IonToast, useIonViewWillEnter,
} from '@ionic/react';
import {
  closeOutline, alertCircleOutline, openOutline,
  checkmarkCircleOutline, closeCircleOutline,
  refreshOutline, calendarNumberOutline, pricetagOutline,
  cameraOutline, copyOutline, checkmarkOutline, logoWhatsapp,
} from 'ionicons/icons';
import axios from 'axios';
import { usePendientes } from '../context/PendientesContext';
import marcaTickets from '../images/MARCA_TICKETS.png';
import './Compras.css';

const API_HDR = {
  'authorization-ticket': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
  'Content-Type': 'application/json',
};
const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

interface InfoConcierto {
  nombreConcierto: string;
  localidad_nombre: string;
  CODIGEVENTO: string;
  cantidad: string;
  localidad_precio: number;
}

interface Registro {
  id: number;
  cedula: string;
  forma_pago: string;
  total_pago: string;
  info_concierto: InfoConcierto[];
  estado_pago: string;   // "Pagado" | "Pendiente" | "Comprobar" | "Anulado" | "Expirado"
  fechaCreacion: string;
  fechaReporte: string;
  link_pago: string | null;
  link_comprobante: string | null;
  numerTransacion: string | null;
  banco: string | null;
  generar_pdf: string;
  subtotal: string;
  iva: string;
  comision_bancaria: string;
  comision_boleto: string;
  canal: string;
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
  validacion?: { nivel_sospecha?: string; posible_adulteracion?: boolean };
}

const CUENTAS = [
  { banco: 'Banco Pichincha', cuenta: '2100298093', ruc: '0993377293001', tipo: 'Corriente' },
  { banco: 'Banco Guayaquil',  cuenta: '18057352',   ruc: '0993377293001', tipo: 'Corriente' },
];

const estadoColor: Record<string, string> = {
  Pagado:    'badge-reg-pagado',
  Pendiente: 'badge-reg-pendiente',
  Comprobar: 'badge-reg-comprobar',
  Anulado:   'badge-reg-anulado',
  Expirado:  'badge-reg-expirado',
};


const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const formatFecha = (fecha: string) => {
  if (!fecha || fecha === 'undefined') return '—';
  const solo = fecha.split(' ')[0].split('T')[0];
  const parts = solo.split('-');
  if (parts.length < 3) return '—';
  const [y, m, d] = parts;
  const mes = MESES[parseInt(m) - 1];
  return mes ? `${d} ${mes} ${y}` : '—';
};

const getUserData = () => {
  try { return JSON.parse(localStorage.getItem('userData') || '{}'); }
  catch { return {}; }
};

const Compras: React.FC = () => {
  const { refreshPendientes } = usePendientes();
  const user = getUserData();

  /* ── Pendientes ── */
  const [pendientes, setPendientes]     = useState<Registro[]>([]);
  const [cargandoPend, setCargandoPend] = useState(false);

  /* ── Historial ── */
  const [historial, setHistorial]       = useState<Registro[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);

  /* ── Anular ── */
  const [alertAnular, setAlertAnular]   = useState(false);
  const anularTarget                    = useRef<Registro | null>(null);
  const [anulando, setAnulando]         = useState(false);

  /* ── Reportar depósito ── */
  const [modalReporte, setModalReporte]     = useState(false);
  const reporteTarget                       = useRef<Registro | null>(null);
  const [reportando, setReportando]         = useState(false);
  const reporteInputRef                     = useRef<HTMLInputElement>(null);
  const [repImagenLocal, setRepImagenLocal] = useState<string | null>(null);
  const [repImagenUrl, setRepImagenUrl]     = useState<string | null>(null);
  const [repAnalizando, setRepAnalizando]   = useState(false);
  const [repOcr, setRepOcr]                 = useState<OcrExtracto | null>(null);
  const [repOcrError, setRepOcrError]       = useState(false);
  const [repCopiado, setRepCopiado]         = useState<string | null>(null);

  /* ── Toast ── */
  const [toast, setToast]               = useState('');
  const [toastColor, setToastColor]     = useState<'success' | 'danger'>('success');

  const showToast = (msg: string, color: 'success' | 'danger' = 'success') => {
    setToast(msg); setToastColor(color);
  };

  const cargarPendientes = async () => {
    if (!user.cedula) return;
    setCargandoPend(true);
    try {
      const { data } = await axios.post(
        `${URL_BASE}/listarRegistros?estado=Pendiente&init=0&size=50`,
        { cedula: user.cedula },
        { headers: API_HDR }
      );
      setPendientes(data.success ? (data.data ?? []) : []);
    } catch { setPendientes([]); }
    finally { setCargandoPend(false); }
  };

  const cargarHistorial = async () => {
    if (!user.cedula) return;
    setCargandoHist(true);
    try {
      const { data } = await axios.post(
        `${URL_BASE}/listarRegistros?init=0&size=100`,
        { cedula: user.cedula },
        { headers: API_HDR }
      );
      setHistorial(data.success ? (data.data ?? []) : []);
    } catch { setHistorial([]); }
    finally { setCargandoHist(false); }
  };

  useIonViewWillEnter(() => {
    cargarPendientes();
    cargarHistorial();
    refreshPendientes();
  });

  /* ── Anular ── */
  const confirmarAnular = async () => {
    const reg = anularTarget.current;
    if (!reg) return;
    setAnulando(true);
    try {
      const { data } = await axios.post(
        `${URL_BASE}/anularCompraPendiente`,
        { id: reg.id, cedula: user.cedula, id_usuario: user.id ?? user.id_usuario ?? 0, id_operador: 0 },
        { headers: API_HDR }
      );
      if (data.success) {
        showToast('Compra anulada correctamente.');
        await cargarPendientes();
        await refreshPendientes();
      } else {
        showToast(data.message ?? 'No se pudo anular.', 'danger');
      }
    } catch {
      showToast('Error de conexión al anular.', 'danger');
    } finally { setAnulando(false); anularTarget.current = null; }
  };

  /* ── Reportar depósito — helpers OCR ── */
  const resetReporte = () => {
    setRepImagenLocal(null);
    setRepImagenUrl(null);
    setRepAnalizando(false);
    setRepOcr(null);
    setRepOcrError(false);
    setRepCopiado(null);
  };

  const repCopiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      setRepCopiado(id);
      setTimeout(() => setRepCopiado(null), 2000);
    }).catch(() => {});
  };

  const handleRepImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (reporteInputRef.current) reporteInputRef.current.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => setRepImagenLocal(ev.target?.result as string);
    reader.readAsDataURL(file);

    setRepImagenUrl(null);
    setRepOcr(null);
    setRepOcrError(false);
    setRepAnalizando(true);

    try {
      const form = new FormData();
      form.append('file', file);
      const { data: up } = await axios.post('https://codigomarret.online/upload/api/img', form);
      if (!up.success) throw new Error('upload_failed');
      const url: string = up.url || '';
      if (!url) throw new Error('no_url');
      setRepImagenUrl(url);

      const { data: ocrResp } = await axios.post(
        'https://api.t-ickets.com/mikroti/Boleteria/imagenocr/analizar',
        { url_imagen: url, request_id: String(Date.now()), guardar_bd: false },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setRepOcr((ocrResp?.data ?? {}) as OcrExtracto);
    } catch {
      setRepOcrError(true);
    } finally {
      setRepAnalizando(false);
    }
  };

  const enviarReporte = async (forzarRevision = false) => {
    const reg = reporteTarget.current;
    if (!reg) return;
    if (!repImagenUrl) {
      showToast('Adjunta el comprobante de tu transferencia.', 'danger'); return;
    }
    const repNumTx    = String(repOcr?.numero_comprobante || repOcr?.referencia || '').trim();
    const repBancoOcr = String(repOcr?.banco_emisor || repOcr?.banco_receptor || '').trim();
    const repMontoOCR = Number(repOcr?.monto);
    const repRegTotal = parseFloat(reg.total_pago || '0');
    const repMontoOk  = Number.isFinite(repMontoOCR) && Math.abs(repMontoOCR - repRegTotal) <= 0.05;
    const repOcrOk    = String(repOcr?.estado || '').toLowerCase() === 'aprobado';
    const repNivel    = String(repOcr?.validacion?.nivel_sospecha || '').toLowerCase();
    const repAdulter  = Boolean(repOcr?.validacion?.posible_adulteracion);
    const esOCRFuerte = repOcr !== null && repOcrOk && repNivel === 'bajo' && !repAdulter && repMontoOk && repNumTx.length >= 4;

    setReportando(true);
    try {
      const { data } = await axios.post(
        `${URL_BASE}/registraPagos`,
        {
          id:                reg.id,
          cedula:            user.cedula,
          id_usuario:        user.id ?? user.id_usuario ?? 0,
          id_operador:       0,
          forma_pago:        'Deposito',
          link_comprobante:  repImagenUrl,
          numeroTransaccion: repNumTx,
          estado:            (!forzarRevision && esOCRFuerte) ? 'Pagado' : 'Comprobar',
          banco:             repBancoOcr,
          bancos:            repBancoOcr,
          total_pago:        reg.total_pago,
        },
        { headers: API_HDR }
      );
      if (data.success) {
        showToast('Depósito reportado. Te notificaremos cuando sea verificado.');
        setModalReporte(false);
        resetReporte();
        await cargarPendientes();
        await refreshPendientes();
      } else {
        showToast(data.message ?? 'No se pudo reportar.', 'danger');
      }
    } catch {
      showToast('Error de conexión al reportar.', 'danger');
    } finally { setReportando(false); }
  };

  const nombreConcierto = (reg: Registro) =>
    reg.info_concierto?.[0]?.nombreConcierto ?? '—';
  const localidadNombre = (reg: Registro) =>
    reg.info_concierto?.[0]?.localidad_nombre ?? '';
  const cantidadBoletos = (reg: Registro) =>
    reg.info_concierto?.[0]?.cantidad ?? '1';

  const CardReg = ({ reg, acciones }: { reg: Registro; acciones: boolean }) => (
    <div className={`comp-card ${acciones ? 'comp-card-pendiente' : ''}`}>
      <div className="comp-card-head">
        <div className="comp-info">
          <span className="comp-nombre">{nombreConcierto(reg)}</span>
          {localidadNombre(reg) && (
            <span className="comp-local">{localidadNombre(reg)}</span>
          )}
          <div className="comp-meta-row">
            {reg.forma_pago && (
              <span className="comp-metodo">{reg.forma_pago}</span>
            )}
            <span className="comp-fecha">
              <IonIcon icon={pricetagOutline} /> {cantidadBoletos(reg)} boleto{Number(cantidadBoletos(reg)) > 1 ? 's' : ''}
            </span>
          </div>
          {reg.fechaCreacion && (
            <span className="comp-fecha">
              <IonIcon icon={calendarNumberOutline} /> {formatFecha(reg.fechaCreacion)}
            </span>
          )}
        </div>
        <div className="comp-right">
          <span className="comp-total">${parseFloat(reg.total_pago || '0').toFixed(2)}</span>
          <IonBadge className={`badge-reg ${estadoColor[reg.estado_pago] ?? 'badge-reg-anulado'}`}>
            {reg.estado_pago}
          </IonBadge>
        </div>
      </div>

      {acciones && (
        <div className="comp-acciones">
          {reg.link_pago ? (
            <IonButton size="small" className="btn-comp-pagar"
              onClick={() => window.open(reg.link_pago!, '_blank')}>
              <IonIcon icon={openOutline} slot="start" />
              Ir al pago
            </IonButton>
          ) : (
            <IonButton size="small" className="btn-comp-reportar"
              onClick={() => { reporteTarget.current = reg; resetReporte(); setModalReporte(true); }}>
              Reportar depósito
            </IonButton>
          )}
          <IonButton size="small" fill="outline" className="btn-comp-anular"
            disabled={anulando}
            onClick={() => { anularTarget.current = reg; setAlertAnular(true); }}>
            <IonIcon icon={closeCircleOutline} slot="start" />
            Anular
          </IonButton>
        </div>
      )}
    </div>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="compras-toolbar">
          <IonButtons slot="start">
            <img src={marcaTickets} alt="T-ickets" className="toolbar-logo" />
          </IonButtons>
          <IonTitle>Mis Compras</IonTitle>
          <IonButtons slot="end">
            <IonButton
              onClick={() => { cargarPendientes(); cargarHistorial(); }}
              disabled={cargandoPend || cargandoHist}
              className={`btn-recargar ${(cargandoPend || cargandoHist) ? 'btn-cargando' : ''}`}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="compras-content">
        <div aria-hidden="true" className="page-watermark">
          <img src={marcaTickets} alt="" />
        </div>

        {/* ── COMPRAS PENDIENTES ── */}
        <div className="compras-section-title">
          Compras pendientes
          {pendientes.length > 0 && (
            <IonBadge color="danger" className="comp-badge">{pendientes.length}</IonBadge>
          )}
        </div>

        {cargandoPend && (
          <div className="comp-loading"><IonSpinner name="crescent" /></div>
        )}

        {!cargandoPend && pendientes.length === 0 && (
          <div className="comp-empty">
            <IonIcon icon={checkmarkCircleOutline} className="comp-empty-icon" />
            <p>Sin compras pendientes</p>
          </div>
        )}

        {!cargandoPend && pendientes.map(reg => (
          <CardReg key={reg.id} reg={reg} acciones={true} />
        ))}

        {/* ── HISTORIAL ── */}
        <div className="compras-section-title">Historial de compras</div>

        {cargandoHist && (
          <div className="comp-loading"><IonSpinner name="crescent" /></div>
        )}
        {!cargandoHist && historial.length === 0 && (
          <div className="comp-empty"><p>Sin registros de compras.</p></div>
        )}
        {!cargandoHist && historial.map(reg => (
          <CardReg key={reg.id} reg={reg} acciones={false} />
        ))}

        <div style={{ height: 20 }} />
      </IonContent>

      {/* ── Modal Reportar Depósito ── */}
      <IonModal isOpen={modalReporte}
        onDidDismiss={() => { setModalReporte(false); resetReporte(); }}
        breakpoints={[0, 1]} initialBreakpoint={1}>
        <IonHeader>
          <IonToolbar className="compras-toolbar">
            <IonTitle>Reportar transferencia</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => { setModalReporte(false); resetReporte(); }}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="compras-content">
          <div className="reporte-body">

            {/* Cuentas de referencia */}
            <div className="rep-card">
              <h3 className="rep-card-title">Cuentas bancarias</h3>
              {CUENTAS.map(c => (
                <div key={c.banco} className="rep-cuenta">
                  <div className="rep-cuenta-head">
                    <span className="rep-banco-nombre">{c.banco}</span>
                    <span className="rep-cuenta-tipo">{c.tipo}</span>
                  </div>
                  <div className="rep-dato-fila">
                    <div>
                      <p className="rep-dato-lbl">Número de cuenta</p>
                      <p className="rep-dato-val">{c.cuenta}</p>
                    </div>
                    <button className="rep-copy-btn"
                      onClick={() => repCopiar(c.cuenta, `cta-${c.banco}`)}>
                      <IonIcon icon={repCopiado === `cta-${c.banco}` ? checkmarkOutline : copyOutline} />
                      <span>{repCopiado === `cta-${c.banco}` ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <div className="rep-dato-fila">
                    <div>
                      <p className="rep-dato-lbl">RUC beneficiario</p>
                      <p className="rep-dato-val">{c.ruc}</p>
                    </div>
                    <button className="rep-copy-btn"
                      onClick={() => repCopiar(c.ruc, `ruc-${c.banco}`)}>
                      <IonIcon icon={repCopiado === `ruc-${c.banco}` ? checkmarkOutline : copyOutline} />
                      <span>{repCopiado === `ruc-${c.banco}` ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Subir comprobante */}
            <div className="rep-card">
              <h3 className="rep-card-title">Comprobante de transferencia</h3>

              <input type="file" accept="image/*" ref={reporteInputRef}
                style={{ display: 'none' }} onChange={handleRepImageChange} />

              {repImagenLocal ? (
                <div className="rep-preview">
                  <img src={repImagenLocal} alt="Comprobante" className="rep-preview-img" />
                  {!repAnalizando && (
                    <button className="rep-change-btn"
                      onClick={() => reporteInputRef.current?.click()}>
                      Cambiar imagen
                    </button>
                  )}
                </div>
              ) : (
                <div className="rep-upload-area"
                  onClick={() => reporteInputRef.current?.click()}>
                  <IonIcon icon={cameraOutline} className="rep-upload-icon" />
                  <p className="rep-upload-texto">Toca para tomar foto o subir imagen</p>
                  <p className="rep-upload-sub">Captura el comprobante de tu transferencia</p>
                </div>
              )}

              {repAnalizando && (
                <div className="rep-ocr-loading">
                  <IonSpinner name="crescent" />
                  <span>Analizando comprobante…</span>
                </div>
              )}

              {repOcrError && !repAnalizando && (
                <div className="rep-ocr-chip rep-ocr-chip-error">
                  <IonIcon icon={closeCircleOutline} />
                  <span>No se pudo leer el comprobante. Intenta con mejor iluminación.</span>
                </div>
              )}

              {repOcr && !repAnalizando && (() => {
                const repNumTx    = String(repOcr.numero_comprobante || repOcr.referencia || '').trim();
                const repBancoOcr = String(repOcr.banco_emisor || repOcr.banco_receptor || '').trim();
                const repMontoOCR = Number(repOcr.monto);
                const repRegTotal = parseFloat(reporteTarget.current?.total_pago || '0');
                const repMontoOk  = Number.isFinite(repMontoOCR) && Math.abs(repMontoOCR - repRegTotal) <= 0.05;
                const repOcrOk    = String(repOcr.estado || '').toLowerCase() === 'aprobado';
                return (
                  <div className="rep-ocr-panel">
                    <div className={`rep-ocr-estado ${repOcrOk ? 'rep-ocr-ok' : 'rep-ocr-warn'}`}>
                      <IonIcon icon={repOcrOk ? checkmarkCircleOutline : alertCircleOutline} />
                      <span>{repOcrOk ? 'Comprobante verificado' : 'Requiere revisión manual'}</span>
                    </div>
                    <div className="rep-ocr-datos">
                      {repNumTx && (
                        <div className="rep-ocr-dato">
                          <span className="rep-ocr-lbl">N° Transacción</span>
                          <span className="rep-ocr-val">{repNumTx}</span>
                        </div>
                      )}
                      {repOcr.monto !== undefined && (
                        <div className="rep-ocr-dato">
                          <span className="rep-ocr-lbl">Monto detectado</span>
                          <span className={`rep-ocr-val ${repMontoOk ? 'rep-ocr-monto-ok' : 'rep-ocr-monto-err'}`}>
                            ${Number(repOcr.monto).toFixed(2)}{repMontoOk ? ' ✓' : ' — difiere del total'}
                          </span>
                        </div>
                      )}
                      {repBancoOcr && (
                        <div className="rep-ocr-dato">
                          <span className="rep-ocr-lbl">Banco</span>
                          <span className="rep-ocr-val">{repBancoOcr}</span>
                        </div>
                      )}
                      {repOcr.fecha && (
                        <div className="rep-ocr-dato">
                          <span className="rep-ocr-lbl">Fecha</span>
                          <span className="rep-ocr-val">{repOcr.fecha}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Botones de acción */}
            {(!repImagenUrl || repAnalizando) && (
              <IonButton expand="block" className="btn-confirmar-reporte" disabled>
                {repAnalizando
                  ? <><IonSpinner name="crescent" style={{ marginRight: 8 }} />Analizando…</>
                  : 'Confirmar transferencia'
                }
              </IonButton>
            )}

            {repImagenUrl && !repAnalizando && (() => {
              const repNumTx    = String(repOcr?.numero_comprobante || repOcr?.referencia || '').trim();
              const repMontoOCR = Number(repOcr?.monto);
              const repRegTotal = parseFloat(reporteTarget.current?.total_pago || '0');
              const repMontoOk  = Number.isFinite(repMontoOCR) && Math.abs(repMontoOCR - repRegTotal) <= 0.05;
              const repOcrOk    = String(repOcr?.estado || '').toLowerCase() === 'aprobado';
              const repNivel    = String(repOcr?.validacion?.nivel_sospecha || '').toLowerCase();
              const repAdulter  = Boolean(repOcr?.validacion?.posible_adulteracion);
              const esOCRFuerte = repOcr !== null && repOcrOk && repNivel === 'bajo' && !repAdulter && repMontoOk && repNumTx.length >= 4;
              const tieneProblema = repOcrError || (repOcr !== null && !esOCRFuerte);

              return esOCRFuerte ? (
                <IonButton expand="block" className="btn-confirmar-reporte"
                  onClick={() => enviarReporte(false)} disabled={reportando}>
                  {reportando
                    ? <><IonSpinner name="crescent" style={{ marginRight: 8 }} />Registrando…</>
                    : 'Confirmar transferencia'
                  }
                </IonButton>
              ) : tieneProblema ? (
                <div className="rep-botones-alt">
                  <IonButton expand="block" className="btn-confirmar-reporte"
                    onClick={() => enviarReporte(true)} disabled={reportando}>
                    {reportando
                      ? <><IonSpinner name="crescent" style={{ marginRight: 8 }} />Enviando…</>
                      : 'Enviar para revisión manual'
                    }
                  </IonButton>
                  <IonButton expand="block" fill="outline" className="btn-rep-whatsapp"
                    onClick={() => window.open('https://api.whatsapp.com/send?phone=593980009000', '_blank')}>
                    <IonIcon icon={logoWhatsapp} slot="start" />
                    Contactar por WhatsApp
                  </IonButton>
                </div>
              ) : null;
            })()}

          </div>
        </IonContent>
      </IonModal>

      {/* ── Alert Anular ── */}
      <IonAlert
        isOpen={alertAnular}
        header="Anular compra"
        message="¿Estás seguro de que deseas anular esta compra? Esta acción no se puede deshacer."
        buttons={[
          { text: 'Cancelar', role: 'cancel', handler: () => { anularTarget.current = null; } },
          { text: 'Sí, anular', role: 'confirm', handler: confirmarAnular },
        ]}
        onDidDismiss={() => setAlertAnular(false)}
      />

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

export default Compras;
