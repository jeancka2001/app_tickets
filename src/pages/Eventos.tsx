import { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonButton,
  IonSearchbar,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { locationOutline, calendarNumberOutline, pricetagOutline } from 'ionicons/icons';
import axios from 'axios';
import './Eventos.css';

interface Localidad {
  id: number;
  localidad: string;
  precio_normal: string;
}

interface Evento {
  id: number;
  nombreConcierto: string;
  fechaConcierto: string;
  horaConcierto: string;
  lugarConcierto: string;
  cuidadConcert: string;
  imagenConcierto: string;
  codigoEvento: string;
  localidades?: Localidad[];
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatFecha = (fecha: string) => {
  const [y, m, d] = fecha.split('-');
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`;
};

const precioDesde = (localidades?: Localidad[]) => {
  if (!localidades?.length) return 'Ver precios';
  const min = Math.min(...localidades.map((l) => parseFloat(l.precio_normal)));
  return `Desde $${min.toFixed(2)}`;
};

const Eventos: React.FC = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const cargarEventos = async () => { 
      try {
        const { data } = await axios.get(
          'https://api.t-ickets.com/ms_login/listareventos/ACTIVO/',
          {
            headers: {
              'Authorization': 'Basic Ym9sZXRlcmlhOmJvbGV0ZXJpYQ==',
            },
          }
        );
        if (data.success) {
          setEventos(data.data);
        } else {
          setError('No se pudieron cargar los eventos');
        }
      } catch {
        setError('Error al conectar con el servidor');
      } finally {
        setCargando(false);
      }
    };
    cargarEventos();
  }, []);

  const eventosFiltrados = eventos.filter((ev) =>
    ev.nombreConcierto.toLowerCase().includes(busqueda.toLowerCase()) ||
    ev.cuidadConcert.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="eventos-toolbar">
          <IonTitle>Eventos</IonTitle>
        </IonToolbar>
        <IonToolbar className="search-toolbar">
          <IonSearchbar
            placeholder="Buscar eventos..."
            className="eventos-search"
            value={busqueda}
            onIonInput={(e) => setBusqueda(e.detail.value!)}
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="eventos-content">
        {cargando && (
          <div className="loading-state">
            <IonSpinner name="crescent" className="loading-spinner" />
            <IonText><p>Cargando eventos...</p></IonText>
          </div>
        )}

        {!cargando && error && (
          <div className="error-state">
            <IonText color="danger"><p>{error}</p></IonText>
          </div>
        )}

        {!cargando && !error && (
          <div className="eventos-list">
            {eventosFiltrados.length === 0 && (
              <div className="empty-search">
                <IonText color="medium"><p>No se encontraron eventos</p></IonText>
              </div>
            )}

            {eventosFiltrados.map((ev) => (
              <div key={ev.id} className="evento-card">
                <div className="evento-banner">
                  <img
                    src={ev.imagenConcierto}
                    alt={ev.nombreConcierto}
                    className="evento-img"
                  />
                </div>
                <div className="evento-body">
                  <h2 className="evento-nombre">{ev.nombreConcierto}</h2>
                  <div className="evento-detalle">
                    <IonIcon icon={calendarNumberOutline} />
                    <span>{formatFecha(ev.fechaConcierto)} · {ev.horaConcierto}</span>
                  </div>
                  <div className="evento-detalle">
                    <IonIcon icon={locationOutline} />
                    <span>{ev.lugarConcierto}, {ev.cuidadConcert}</span>
                  </div>
                  <div className="evento-footer">
                    <div className="evento-precio">
                      <IonIcon icon={pricetagOutline} />
                      <span>{precioDesde(ev.localidades)}</span>
                    </div>
                    <IonButton size="small" className="btn-comprar">
                      Comprar
                    </IonButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Eventos;
