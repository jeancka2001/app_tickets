import { PushNotifications, type PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

let inicializado = false;

/* Cuando la notificación push llega con la app ABIERTA, Android no la muestra
   solo por sí mismo (eso solo pasa en 2do plano/cerrada) — hay que mostrarla
   nosotros a mano con una notificación local idéntica. */
const mostrarComoLocal = async (notification: PushNotificationSchema): Promise<void> => {
  try {
    const permiso = await LocalNotifications.checkPermissions();
    if (permiso.display !== 'granted') {
      const pedido = await LocalNotifications.requestPermissions();
      if (pedido.display !== 'granted') return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483647),
          title: notification.title || 'T-ickets',
          body: notification.body || '',
        },
      ],
    });
  } catch (e) {
    console.warn('[push] no se pudo mostrar la notificación en primer plano', e);
  }
};

/* Pide permiso de notificaciones y registra el dispositivo en Firebase Cloud
   Messaging. No hace falta guardar el token en ningún backend propio: para
   enviar notificaciones masivas ("a todos") desde la Consola de Firebase
   alcanza con que el dispositivo esté registrado — Firebase lo rastrea solo. */
export const inicializarNotificaciones = async (): Promise<void> => {
  if (inicializado) return;
  inicializado = true;

  try {
    let estado = await PushNotifications.checkPermissions();

    if (estado.receive === 'prompt' || estado.receive === 'prompt-with-rationale') {
      estado = await PushNotifications.requestPermissions();
    }

    if (estado.receive !== 'granted') {
      console.log('[push] permiso de notificaciones no concedido:', estado.receive);
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      console.log('[push] dispositivo registrado en FCM, token:', token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.warn('[push] error al registrar el dispositivo', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[push] notificación recibida en primer plano', notification);
      mostrarComoLocal(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[push] el usuario tocó la notificación', action.notification);
    });
  } catch (e) {
    console.warn('[push] no se pudo inicializar notificaciones', e);
  }
};
