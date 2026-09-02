import { useEffect, useRef } from 'react';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet, IonBadge, createGesture } from '@ionic/react';
import { Route, Redirect, useHistory, useLocation } from 'react-router-dom';
import { ticketOutline, calendarOutline, personCircleOutline, receiptOutline } from 'ionicons/icons';
import Boletos from './Boletos';
import Eventos from './Eventos';
import Perfil from './Perfil';
import Compras from './Compras';
import { usePendientes } from '../context/PendientesContext';
import './Dashboard.css';

/* Mismo orden que los botones de la barra de abajo — desliza a la
   izquierda = pestaña siguiente, a la derecha = pestaña anterior. */
const ORDEN_TABS = ['/dashboard/boletos', '/dashboard/eventos', '/dashboard/compras', '/dashboard/perfil'];

const Dashboard: React.FC = () => {
  const { pendientesCount, refreshPendientes } = usePendientes();
  const history = useHistory();
  const location = useLocation();
  const outletRef = useRef<HTMLIonRouterOutletElement>(null);
  const rutaActualRef = useRef(location.pathname);

  useEffect(() => {
    refreshPendientes();
  }, [refreshPendientes]);

  useEffect(() => { rutaActualRef.current = location.pathname; }, [location.pathname]);

  /* Deslizar hacia los lados también cambia de pestaña, igual que tocar los
     botones de abajo (como en Instagram/YouTube). No da la vuelta en los
     extremos: deslizar más a la izquierda estando en Perfil no hace nada. */
  useEffect(() => {
    if (!outletRef.current) return;

    const gesture = createGesture({
      el: outletRef.current,
      gestureName: 'dashboard-swipe-tabs',
      direction: 'x',
      threshold: 15,
      onEnd: (detail) => {
        const DISTANCIA_MINIMA = 65;
        if (Math.abs(detail.deltaX) < DISTANCIA_MINIMA) return;
        if (Math.abs(detail.deltaX) < Math.abs(detail.deltaY)) return;

        const actual = ORDEN_TABS.findIndex(r => rutaActualRef.current.startsWith(r));
        if (actual === -1) return;

        const siguiente = detail.deltaX < 0 ? actual + 1 : actual - 1;
        if (siguiente < 0 || siguiente >= ORDEN_TABS.length) return;

        history.push(ORDEN_TABS[siguiente]);
      },
    });
    gesture.enable(true);
    return () => gesture.destroy();
  }, [history]);

  return (
    <IonTabs>
      <IonRouterOutlet ref={outletRef}>
        <Route exact path="/dashboard/boletos"  component={Boletos}  />
        <Route exact path="/dashboard/eventos"  component={Eventos}  />
        <Route exact path="/dashboard/compras"  component={Compras}  />
        <Route exact path="/dashboard/perfil"   component={Perfil}   />
        <Route exact path="/dashboard">
          <Redirect to="/dashboard/eventos" />
        </Route>
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className="main-tab-bar">
        <IonTabButton tab="boletos" href="/dashboard/boletos">
          <IonIcon icon={ticketOutline} />
          <IonLabel>Boletos</IonLabel>
        </IonTabButton>

        <IonTabButton tab="eventos" href="/dashboard/eventos">
          <IonIcon icon={calendarOutline} />
          <IonLabel>Eventos</IonLabel>
        </IonTabButton>

        <IonTabButton tab="compras" href="/dashboard/compras">
          <IonIcon icon={receiptOutline} />
          {pendientesCount > 0 && (
            <IonBadge color="danger" className="tab-badge">{pendientesCount}</IonBadge>
          )}
          <IonLabel>Compras</IonLabel>
        </IonTabButton>

        <IonTabButton tab="perfil" href="/dashboard/perfil">
          <IonIcon icon={personCircleOutline} />
          <IonLabel>Perfil</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default Dashboard;
