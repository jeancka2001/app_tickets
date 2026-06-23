import { useEffect } from 'react';
import { Redirect, Route, useHistory, useParams } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { App as CapApp } from '@capacitor/app';
import Home from './pages/Home';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Localidad from './pages/Localidad';
import Pago from './pages/Pago';
import { PendientesProvider } from './context/PendientesContext';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.system.css';
import './theme/variables.css';

setupIonicReact();

/* ── Maneja rutas web tipo /evento/RHX614 ── */
const EventoDeepLink: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const history    = useHistory();

  useEffect(() => {
    if (codigo) sessionStorage.setItem('pendingEventCode', codigo.toUpperCase());
    history.replace(localStorage.getItem('userData') ? '/dashboard/eventos' : '/home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

/* ── Escucha deep links nativos de Capacitor ── */
const CapacitorUrlHandler: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    const parseCode = (url: string): string | null => {
      try {
        const m = new URL(url).pathname.match(/\/evento\/([A-Z0-9]+)/i);
        return m?.[1]?.toUpperCase() ?? null;
      } catch { return null; }
    };

    const sub = CapApp.addListener('appUrlOpen', ({ url }) => {
      const code = parseCode(url);
      if (code) {
        sessionStorage.setItem('pendingEventCode', code);
        history.push(localStorage.getItem('userData') ? '/dashboard/eventos' : '/home');
      }
    });

    return () => { sub.then(h => h.remove()); };
  }, [history]);

  return null;
};

/* ── App principal ── */
const App: React.FC = () => (
  <IonApp>
    <PendientesProvider>
      <IonReactRouter>
        <CapacitorUrlHandler />
        <IonRouterOutlet>
          <Route exact path="/home"><Home /></Route>
          <Route exact path="/register"><Register /></Route>
          <Route path="/dashboard" render={() => <Dashboard />} />
          <Route path="/localidad/:id" component={Localidad} />
          <Route path="/pago" component={Pago} />
          <Route path="/evento/:codigo" component={EventoDeepLink} />
          <Route exact path="/"><Redirect to="/home" /></Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </PendientesProvider>
  </IonApp>
);

export default App;
