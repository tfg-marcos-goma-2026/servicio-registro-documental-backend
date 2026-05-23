/**
 * @file notification-strategy.interface.ts
 * @module notifications
 * @description Contrato del patrón Strategy para el sistema de notificaciones.
 *   Todas las estrategias concretas deben implementar esta interfaz, lo que
 *   permite a NotificationsService delegar el envío sin conocer el canal
 *   subyacente (log, WebSocket, email, etc.).
 *
 *   El payload es un objeto genérico para que cada estrategia pueda extraer
 *   los campos que necesite sin forzar una firma de método distinta por canal.
 *   Campos mínimos recomendados:
 *     - userId  : destinatario de la notificación.
 *     - title   : asunto o título del mensaje.
 *     - message : cuerpo en texto plano (usado por estrategias de texto).
 *   Campos opcionales para estrategias estructuradas (WebSocket):
 *     - jobId   : identificador del job al que pertenece la notificación.
 *     - txHash  : hash de la transacción (en caso de éxito).
 *     - error   : mensaje de error (en caso de fallo).
 *     - status  : 'completed' | 'failed'.
 */

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  jobId?: string;
  txHash?: string;
  error?: string;
  status?: 'completed' | 'failed';
}

export interface NotificationStrategy {
  /** Nombre identificativo del canal. Usado para logs y selección dinámica. */
  readonly name: string;

  /**
   * Envía la notificación al canal concreto que implementa la estrategia.
   * @param payload - Datos de la notificación. Ver NotificationPayload.
   */
  send(payload: NotificationPayload): Promise<void>;
}
