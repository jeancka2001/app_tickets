import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Home from './pages/Home';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Localidad from './pages/Localidad';
import Pago from './pages/Pago';
import { PendientesProvider } from './context/PendientesContext';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <PendientesProvider>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/home"><Home /></Route>
          <Route exact path="/register"><Register /></Route>
          <Route path="/dashboard" render={() => <Dashboard />} />
          <Route path="/localidad/:id" component={Localidad} />
          <Route path="/pago" component={Pago} />
          <Route exact path="/"><Redirect to="/home" /></Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </PendientesProvider>
  </IonApp>
);

export default App;
