import { useState, useRef } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonIcon, IonButton, IonSpinner, IonBadge,
  IonModal, IonButtons, IonInput, IonSelect, IonSelectOption,
  IonAlert, IonToast, useIonViewWillEnter,
} from '@ionic/react';
import {
  openOutline, closeOutline, alertCircleOutline,
  checkmarkCircleOutline, closeCircleOutline, refreshOutline,
} from 'ionicons/icons';
import axios from 'axios';
import { usePendientes } from '../context/PendientesContext';
import './Compras.css';

const API_HDR = {
  'authorization-ticket': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
  'Content-Type': 'application/json',
};
const URL_BASE = 'https://api.t-ickets.com/ms_login/api/v1';

interface Registro {
  id?: number;
  id_registraCompra?: number;
  concierto?: string;
  localidad?: string;
  localidad_nombre?: string;
  total?: string;
  fecha?: string;
  fechaCreacion?: string;
  estado_pago?: string;
  forma_pago?: string;
  link_pago?: string;
  cedula?: string;
}

const estadoColor: Record<string, string> = {
  Pagado:    'badge-reg-pagado',
  Pendiente: 'badge-reg-pendiente',
  Comprobar: 'badge-reg-comprobar',
  Anulado:   'badge-reg-anulado',
  Expirado:  'badge-reg-expirado',
};

const BANCOS = ['Banco Pichincha', 'Banco Guayaquil', 'Produbanco', 'Banco del Austro', 'Banco Internacional'];

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
  const [mostrarHist, setMostrarHist]   = useState(false);

  /* ── Anular ── */
  const [alertAnular, setAlertAnular]   = useState(false);
  const anularTarget                    = useRef<Registro | null>(null);
  const [anulando, setAnulando]         = useState(false);

  /* ── Reportar depósito ── */
  const [modalReporte, setModalReporte] = useState(false);
  const reporteTarget                   = useRef<Registro | null>(null);
  const [banco, setBanco]               = useState('');
  const [codigo, setCodigo]             = useState('');
  const [reportando, setReportando]     = useState(false);

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
    refreshPendientes();
  });

  /* ── Anular ── */
  const confirmarAnular = async () => {
    const reg = anularTarget.current;
    if (!reg) return;
    const regId = reg.id ?? reg.id_registraCompra;
    setAnulando(true);
    try {
      const { data } = await axios.post(
        `${URL_BASE}/anularCompraPendiente`,
        { id: regId, cedula: user.cedula, id_usuario: user.id ?? user.id_usuario ?? 0, id_operador: 0 },
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

  /* ── Reportar depósito ── */
  const enviarReporte = async () => {
    const reg = reporteTarget.current;
    if (!reg || !banco || !codigo.trim()) {
      showToast('Completa todos los campos.', 'danger'); return;
    }
    const regId = reg.id ?? reg.id_registraCompra;
    setReportando(true);
    try {
      const { data } = await axios.post(
        `${URL_BASE}/registraPagos`,
        { id: regId, cedula: user.cedula, forma_pago: 'Deposito', banco, codigo: codigo.trim(), id_usuario: 0, id_operador: 0 },
        { headers: API_HDR }
      );
      if (data.success) {
        showToast('Depósito reportado. Te notificaremos cuando sea verificado.');
        setModalReporte(false);
        setBanco(''); setCodigo('');
        await cargarPendientes();
        await refreshPendientes();
      } else {
        showToast(data.message ?? 'No se pudo reportar.', 'danger');
      }
    } catch {
      showToast('Error de conexión al reportar.', 'danger');
    } finally { setReportando(false); }
  };

  const regId   = (r: Registro) => r.id ?? r.id_registraCompra;
  const regNom  = (r: Registro) => r.concierto ?? '—';
  const regLoc  = (r: Registro) => r.localidad ?? r.localidad_nombre ?? '';
  const regFec  = (r: Registro) => r.fecha ?? r.fechaCreacion ?? '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="compras-toolbar">
          <IonTitle>Mis Compras</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="compras-content">

        {/* ── COMPRAS PENDIENTES ── */}
        <div className="compras-section-title">
          Compras pendientes
          {pendientes.length > 0 && (
            <IonBadge color="danger" className="comp-badge">{pendientes.length}</IonBadge>
          )}
          <button className="comp-refresh" onClick={cargarPendientes} disabled={cargandoPend}>
            <IonIcon icon={refreshOutline} />
          </button>
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
          <div key={regId(reg)} className="comp-card comp-card-pendiente">
            <div className="comp-card-head">
              <div className="comp-info">
                <span className="comp-nombre">{regNom(reg)}</span>
                {regLoc(reg) && <span className="comp-local">{regLoc(reg)}</span>}
                {reg.forma_pago && <span className="comp-metodo">{reg.forma_pago}</span>}
                {regFec(reg) && <span className="comp-fecha">{regFec(reg)}</span>}
              </div>
              <div className="comp-right">
                <span className="comp-total">${parseFloat(reg.total || '0').toFixed(2)}</span>
                <IonBadge className="badge-reg badge-reg-pendiente">Pendiente</IonBadge>
              </div>
            </div>
            <div className="comp-acciones">
              {reg.link_pago ? (
                <IonButton size="small" className="btn-comp-pagar"
                  onClick={() => window.open(reg.link_pago!, '_blank')}>
                  <IonIcon icon={openOutline} slot="start" />
                  Ir al pago
                </IonButton>
              ) : (
                <IonButton size="small" className="btn-comp-reportar"
                  onClick={() => { reporteTarget.current = reg; setBanco(''); setCodigo(''); setModalReporte(true); }}>
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
          </div>
        ))}

        {/* ── HISTORIAL ── */}
        <div className="compras-section-title hist-row">
          <span>Historial de compras</span>
          <IonButton fill="clear" size="small" className="btn-hist"
            onClick={() => { setMostrarHist(v => !v); if (!mostrarHist) cargarHistorial(); }}>
            {mostrarHist ? 'Ocultar' : 'Ver todo'}
          </IonButton>
        </div>

        {mostrarHist && (
          <>
            {cargandoHist && (
              <div className="comp-loading"><IonSpinner name="crescent" /></div>
            )}
            {!cargandoHist && historial.length === 0 && (
              <div className="comp-empty"><p>Sin registros de compras.</p></div>
            )}
            {!cargandoHist && historial.map(reg => (
              <div key={regId(reg)} className="comp-card">
                <div className="comp-card-head">
                  <div className="comp-info">
                    <span className="comp-nombre">{regNom(reg)}</span>
                    {regLoc(reg) && <span className="comp-local">{regLoc(reg)}</span>}
                    {reg.forma_pago && <span className="comp-metodo">{reg.forma_pago}</span>}
                    {regFec(reg) && <span className="comp-fecha">{regFec(reg)}</span>}
                  </div>
                  <div className="comp-right">
                    <span className="comp-total">${parseFloat(reg.total || '0').toFixed(2)}</span>
                    <IonBadge className={`badge-reg ${estadoColor[reg.estado_pago ?? ''] ?? 'badge-reg-anulado'}`}>
                      {reg.estado_pago ?? '—'}
                    </IonBadge>
                  </div>
                </div>
                {reg.link_pago && reg.estado_pago === 'Pendiente' && (
                  <div className="comp-acciones">
                    <IonButton size="small" className="btn-comp-pagar"
                      onClick={() => window.open(reg.link_pago!, '_blank')}>
                      <IonIcon icon={openOutline} slot="start" />
                      Ir al pago
                    </IonButton>
                  </div>
                )}
              </div>
            ))}
            {!cargandoHist && historial.length > 0 && (
              <div className="hist-refresh-row">
                <IonButton fill="clear" size="small" onClick={cargarHistorial}>
                  <IonIcon icon={refreshOutline} slot="start" />
                  Actualizar
                </IonButton>
              </div>
            )}
          </>
        )}

        {/* Espacio inferior */}
        <div style={{ height: 20 }} />

      </IonContent>

      {/* ── Modal Reportar Depósito ── */}
      <IonModal isOpen={modalReporte} onDidDismiss={() => setModalReporte(false)}
        breakpoints={[0, 1]} initialBreakpoint={1}>
        <IonHeader>
          <IonToolbar className="compras-toolbar">
            <IonTitle>Reportar depósito</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setModalReporte(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="compras-content">
          <div className="reporte-body">
            <div className="reporte-aviso">
              <IonIcon icon={alertCircleOutline} className="reporte-aviso-icon" />
              <p>Ingresa los datos de tu transferencia. La verificación puede tardar hasta 24 horas hábiles.</p>
            </div>

            <IonSelect
              className="reporte-inp"
              label="Banco de origen"
              labelPlacement="floating"
              fill="outline"
              value={banco}
              onIonChange={e => setBanco(e.detail.value)}>
              {BANCOS.map(b => (
                <IonSelectOption key={b} value={b}>{b}</IonSelectOption>
              ))}
            </IonSelect>

            <IonInput
              className="reporte-inp"
              label="Número de comprobante / referencia"
              labelPlacement="floating"
              fill="outline"
              type="text"
              value={codigo}
              onIonInput={e => setCodigo(e.detail.value!)}
            />

            <IonButton expand="block" className="btn-confirmar-reporte"
              onClick={enviarReporte} disabled={reportando || !banco || !codigo.trim()}>
              {reportando
                ? <><IonSpinner name="crescent" style={{ marginRight: 8 }} /> Enviando…</>
                : 'Confirmar depósito'
              }
            </IonButton>
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
