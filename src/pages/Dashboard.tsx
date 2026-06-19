import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import { Route, Redirect } from 'react-router-dom';
import { ticketOutline, calendarOutline, personCircleOutline } from 'ionicons/icons';
import Boletos from './Boletos';
import Eventos from './Eventos';
import Perfil from './Perfil';
import './Dashboard.css';

const Dashboard: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route exact path="/dashboard/boletos" component={Boletos} />
      <Route exact path="/dashboard/eventos" component={Eventos} />
      <Route exact path="/dashboard/perfil" component={Perfil} />
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
      <IonTabButton tab="perfil" href="/dashboard/perfil">
        <IonIcon icon={personCircleOutline} />
        <IonLabel>Perfil</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

export default Dashboard;
