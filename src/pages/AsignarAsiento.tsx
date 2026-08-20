import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButton, IonIcon, IonSpinner, IonText, IonModal, IonAlert, IonToast,
} from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
import { closeCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import marcaTickets from '../images/MARCA_TICKETS.png';
import {
  validarLinkAsignacion,
  obtenerMapaYVerificarAsiento,
  seleccionarAsientoCliente,
  deseleccionarAsientoCliente,
  cancelarAsignacionAsientos,
  confirmarAsignacionFinal,
  type AsientoAsignacion,
  type LocalidadAsignacion,
} from '../utils/asignacionAsientos';
import { obtenerConfiguracionLocalidad, claseAlineacion, enOrdenVisual } from '../utils/localidadConfig';
import './AsignarAsiento.css';

/* Página pública de asignación de asientos (link de un solo uso enviado por
   WhatsApp). NUNCA lee ni escribe `userData`/sesión: la única credencial es
   la cédula+token de la URL. Al terminar, entrega el control a /home para
   que el login (huella o usuario/contraseña) siga el camino normal de la
   app, sin mezclar nada de este flujo anónimo con la sesión autenticada. */

const COLOR: Record<string, string> = {
  disponible: '#198754',
  ocupado: '#dc3545',
  reservado: '#dc3545',
  mio: '#0d6efd',
};

const numeroDe = (silla: string): string => {
  const partes = String(silla || '').split('-');
  return partes.length >= 3 ? partes[2] : silla;
};

const agruparPorFila = (mapa: AsientoAsignacion[]): [string, AsientoAsignacion[]][] => {
  const porFila: Record<string, AsientoAsignacion[]> = {};
  mapa.forEach((a) => {
    if (!porFila[a.fila]) porFila[a.fila] = [];
    porFila[a.fila].push(a);
  });
  return Object.entries(porFila);
};

const AsignarAsiento: React.FC = () => {
  const { cedula, token } = useParams<{ cedula: string; token: string }>();
  const history = useHistory();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [localidades, setLocalidades] = useState<LocalidadAsignacion[]>([]);
  const [localidadIdx, setLocalidadIdx] = useState(0);
  const [mapa, setMapa] = useState<AsientoAsignacion[]>([]);
  const [asientoParaConfirmar, setAsientoParaConfirmar] = useState<AsientoAsignacion | null>(null);
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [aviso, setAviso] = useState('');
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [mensajeFinal, setMensajeFinal] = useState('');
  const [mostrarAviso, setMostrarAviso] = useState(true);
  const [alineacionFilas, setAlineacionFilas] = useState<Record<string, string>>({});
  const [ordenSillasFilas, setOrdenSillasFilas] = useState<Record<string, boolean>>({});

  const localidadActual = localidades[localidadIdx];
  const filas = useMemo(() => agruparPorFila(mapa), [mapa]);
  const seleccionados = mapa.filter((a) => a.estado === 'mio').length;
  const localidadCompleta = !!localidadActual && seleccionados >= Number(localidadActual.cantidad);
  const esUltimaLocalidad = localidadIdx === localidades.length - 1;

  useEffect(() => {
    (async () => {
      const resp = await validarLinkAsignacion(cedula, token);
      setCargando(false);
      if (!resp.success) {
        setError(resp.message || 'Este link no es válido');
        return;
      }
      setLocalidades(resp.localidades || []);
    })();
  }, [cedula, token]);

  const refrescarMapa = useCallback(async () => {
    if (!localidadActual) return;
    const resp = await obtenerMapaYVerificarAsiento(token, cedula, localidadActual.id_localidad);
    if (resp.success) setMapa(resp.mapa || []);
  }, [localidadActual, token, cedula]);

  useEffect(() => { refrescarMapa(); }, [refrescarMapa]);

  /* Alineación/orden por fila configurados en el admin, igual que en la web */
  useEffect(() => {
    if (!localidadActual) return;
    obtenerConfiguracionLocalidad(localidadActual.id_localidad).then(cfg => {
      setAlineacionFilas(cfg.alineacion);
      setOrdenSillasFilas(cfg.ordenSillas);
    });
  }, [localidadActual]);

  const onClickAsiento = async (asiento: AsientoAsignacion) => {
    if (asiento.estado === 'ocupado' || asiento.estado === 'reservado') return;
    if (cargandoAccion) return;

    if (asiento.estado === 'mio') {
      setCargandoAccion(true);
      await deseleccionarAsientoCliente(token, cedula, asiento.id);
      setCargandoAccion(false);
      await refrescarMapa();
      return;
    }

    if (!localidadActual || seleccionados >= Number(localidadActual.cantidad)) {
      setAviso('Ya seleccionaste el máximo de asientos para esta localidad');
      return;
    }

    setCargandoAccion(true);
    const resp = await obtenerMapaYVerificarAsiento(token, cedula, localidadActual.id_localidad, asiento.id);
    setCargandoAccion(false);

    if (!resp.success) {
      setError(resp.message || 'Este link ya no es válido');
      return;
    }
    setMapa(resp.mapa || []);

    if (resp.asiento_clickeado?.disponible) {
      const encontrado = (resp.mapa || []).find((a) => a.id === asiento.id);
      setAsientoParaConfirmar(encontrado ?? null);
    } else {
      setAviso('Ese asiento ya no está disponible, elige otro');
    }
  };

  const confirmarSeleccion = async () => {
    if (!asientoParaConfirmar) return;
    setCargandoAccion(true);
    const resp = await seleccionarAsientoCliente(token, cedula, asientoParaConfirmar.id);
    setCargandoAccion(false);
    setAsientoParaConfirmar(null);
    if (!resp.success) setAviso(resp.message || 'Ese asiento ya no está disponible');
    await refrescarMapa();
  };

  const siguienteLocalidad = () => setLocalidadIdx((i) => i + 1);

  const onCancelarCompra = async () => {
    setCargandoAccion(true);
    const resp = await cancelarAsignacionAsientos(token, cedula);
    setCargandoAccion(false);
    setConfirmarCancelar(false);
    if (resp.success) {
      history.replace('/home');
    } else {
      setAviso(resp.message || 'No se pudo cancelar');
    }
  };

  const onConfirmarTodo = async () => {
    setCargandoAccion(true);
    const resp = await confirmarAsignacionFinal(token, cedula);
    setCargandoAccion(false);
    if (resp.success) {
      setFinalizado(true);
      setMensajeFinal(resp.message || 'Tus asientos fueron asignados correctamente.');
      setTimeout(() => history.replace('/home'), 4000);
    } else {
      setAviso(resp.message || 'No se pudo confirmar la asignación');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="asig-toolbar">
          <img src={marcaTickets} alt="T-ickets" className="asig-logo" />
          <IonTitle>Selección de asientos</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="asig-content">

        {cargando && (
          <div className="asig-centro">
            <IonSpinner name="crescent" />
            <IonText><p>Validando tu link…</p></IonText>
          </div>
        )}

        {!cargando && error && (
          <div className="asig-centro">
            <IonIcon icon={closeCircleOutline} className="asig-error-icon" />
            <h3>{error}</h3>
            <IonButton routerLink="/home" routerDirection="none">Ir al inicio</IonButton>
          </div>
        )}

        {!cargando && !error && finalizado && (
          <div className="asig-centro">
            <IonIcon icon={checkmarkCircleOutline} className="asig-exito-icon" />
            <h3>¡Listo!</h3>
            <p>{mensajeFinal}</p>
            <p className="asig-sub">Ya puedes iniciar sesión para ver tus boletos…</p>
          </div>
        )}

        {!cargando && !error && !finalizado && (
          <div className="asig-container">

            {mostrarAviso && (
              <div className="asig-banner">
                <button className="asig-banner-cerrar" onClick={() => setMostrarAviso(false)} aria-label="Cerrar aviso">×</button>
                <p><strong>🎟️ Selección de asientos</strong></p>
                <p>⚠️ Tienes UN SOLO INTENTO para seleccionar tus asientos.</p>
                <p>🟢 Selecciona solo las sillas verdes disponibles.</p>
                <p>🎟️ Selecciona la cantidad de asientos que compraste.</p>
              </div>
            )}

            <div className="asig-header-loc">
              <h2>
                {localidadActual
                  ? `${localidadActual.localidad_nombre} — ${seleccionados}/${localidadActual.cantidad}`
                  : ''}
              </h2>
              <IonButton size="small" fill="outline" color="danger" onClick={() => setConfirmarCancelar(true)}>
                Cancelar compra
              </IonButton>
            </div>

            {localidades.length > 1 && (
              <p className="asig-sub">Localidad {localidadIdx + 1} de {localidades.length}</p>
            )}

            <div className="asig-mapa">
              {filas.map(([fila, asientos]) => (
                <div className="asig-fila" key={fila}>
                  <div className="asig-fila-badge">{fila}</div>
                  <div className="asig-fila-asientos" style={{ justifyContent: claseAlineacion(alineacionFilas, fila) }}>
                    {enOrdenVisual(ordenSillasFilas, fila, asientos).map((a) => (
                      <button
                        key={a.id}
                        className="asig-silla"
                        style={{
                          backgroundColor: COLOR[a.estado] ?? COLOR.disponible,
                          cursor: a.estado === 'ocupado' || a.estado === 'reservado' ? 'not-allowed' : 'pointer',
                        }}
                        disabled={cargandoAccion}
                        onClick={() => onClickAsiento(a)}
                      >
                        {numeroDe(a.silla)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="asig-leyenda">
              <span><i style={{ background: COLOR.disponible }} /> Disponible</span>
              <span><i style={{ background: COLOR.mio }} /> Tuyo</span>
              <span><i style={{ background: COLOR.ocupado }} /> Ocupado/Reservado</span>
            </div>

            <div className="asig-acciones">
              {localidadCompleta && !esUltimaLocalidad && (
                <IonButton expand="block" onClick={siguienteLocalidad}>Siguiente localidad</IonButton>
              )}
              {localidadCompleta && esUltimaLocalidad && (
                <IonButton expand="block" color="success" disabled={cargandoAccion} onClick={onConfirmarTodo}>
                  {cargandoAccion ? <IonSpinner name="crescent" /> : 'Asignar asientos'}
                </IonButton>
              )}
            </div>
          </div>
        )}

      </IonContent>

      <IonModal isOpen={!!asientoParaConfirmar} onDidDismiss={() => setAsientoParaConfirmar(null)}>
        <div className="asig-modal-body">
          <h3>Asiento {asientoParaConfirmar?.silla}</h3>
          <p className="asig-sub">Fila {asientoParaConfirmar?.fila}</p>
          <IonButton expand="block" color="success" disabled={cargandoAccion} onClick={confirmarSeleccion}>
            Confirmar
          </IonButton>
          <IonButton expand="block" fill="outline" onClick={() => setAsientoParaConfirmar(null)}>
            Cancelar
          </IonButton>
        </div>
      </IonModal>

      <IonAlert
        isOpen={confirmarCancelar}
        header="¿Seguro que quieres cancelar?"
        message="Vas a perder los asientos que hayas seleccionado."
        buttons={[
          { text: 'Volver', role: 'cancel', handler: () => setConfirmarCancelar(false) },
          { text: 'Sí, cancelar', role: 'confirm', handler: onCancelarCompra },
        ]}
        onDidDismiss={() => setConfirmarCancelar(false)}
      />

      <IonToast
        isOpen={!!aviso}
        message={aviso}
        duration={3000}
        color="warning"
        position="top"
        onDidDismiss={() => setAviso('')}
      />
    </IonPage>
  );
};

export default AsignarAsiento;
