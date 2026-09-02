import { IonButton, IonIcon } from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';
import './EstadoError.css';

interface EstadoErrorProps {
  titulo?: string;
  mensaje?: string;
  /** Si se pasa, muestra el botón "Reintentar" y lo llama al tocarlo. */
  onReintentar?: () => void;
  reintentando?: boolean;
}

/* Robotito simple, dibujado a mano con formas básicas de SVG (sin imagen
   externa) — mismos colores de marca (índigo + acento naranja) que el
   resto de la app. Se usa como estado de error genérico cuando falla la
   conexión con el servidor, en vez de solo texto plano. */
const RobotError: React.FC = () => (
  <svg viewBox="0 0 140 150" className="robot-error-svg" role="img" aria-label="Robot con un error">
    <g className="robot-flota">
      {/* chispas de error */}
      <path className="robot-chispa robot-chispa-1" d="M18 46 L26 40 L20 52 L30 48" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path className="robot-chispa robot-chispa-2" d="M122 52 L114 46 L120 58 L110 54" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* antena */}
      <line x1="70" y1="6" x2="70" y2="22" className="robot-linea" />
      <circle cx="70" cy="4" r="6" className="robot-luz" />

      {/* orejas */}
      <circle cx="32" cy="48" r="7" className="robot-cuerpo-claro" />
      <circle cx="108" cy="48" r="7" className="robot-cuerpo-claro" />

      {/* cabeza */}
      <rect x="36" y="22" width="68" height="56" rx="18" className="robot-cabeza" />
      {/* ojos en X (error) */}
      <g className="robot-rasgo" strokeLinecap="round">
        <line x1="55" y1="42" x2="65" y2="52" />
        <line x1="65" y1="42" x2="55" y2="52" />
        <line x1="75" y1="42" x2="85" y2="52" />
        <line x1="85" y1="42" x2="75" y2="52" />
      </g>
      {/* boca preocupada */}
      <path d="M58 63 Q70 56 82 63" fill="none" className="robot-rasgo" strokeLinecap="round" />

      {/* brazos */}
      <rect x="12" y="86" width="16" height="32" rx="8" className="robot-cuerpo" />
      <rect x="112" y="86" width="16" height="32" rx="8" className="robot-cuerpo" />

      {/* cuerpo */}
      <rect x="30" y="82" width="80" height="52" rx="16" className="robot-cuerpo" />
      {/* panel con signo de exclamación */}
      <rect x="48" y="94" width="44" height="28" rx="7" className="robot-panel" />
      <rect x="67" y="100" width="6" height="12" rx="3" className="robot-alerta" />
      <circle cx="70" cy="116" r="3.4" className="robot-alerta" />

      {/* pies */}
      <rect x="42" y="134" width="16" height="10" rx="4" className="robot-cuerpo-claro" />
      <rect x="82" y="134" width="16" height="10" rx="4" className="robot-cuerpo-claro" />
    </g>
  </svg>
);

const EstadoError: React.FC<EstadoErrorProps> = ({
  titulo = '¡Ups! Ocurrió un error',
  mensaje = 'Nuestros servidores están teniendo problemas para responder. Vuelve a intentarlo en un momento — ya estamos trabajando en eso.',
  onReintentar,
  reintentando = false,
}) => (
  <div className="estado-error">
    <RobotError />
    <h3 className="estado-error-titulo">{titulo}</h3>
    <p className="estado-error-mensaje">{mensaje}</p>
    {onReintentar && (
      <IonButton size="small" className="estado-error-btn" onClick={onReintentar} disabled={reintentando}>
        <IonIcon icon={refreshOutline} slot="start" className={reintentando ? 'estado-error-icono-girando' : ''} />
        {reintentando ? 'Reintentando…' : 'Reintentar'}
      </IonButton>
    )}
  </div>
);

export default EstadoError;
