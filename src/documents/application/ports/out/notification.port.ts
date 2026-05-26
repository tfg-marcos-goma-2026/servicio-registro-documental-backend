/**
 * @file notification.port.ts
 * @module documents/application
 * @description Puerto de salida que define el contrato para enviar
 * notificaciones al usuario. Desacopla los casos de uso y el procesador
 * del canal concreto (WebSocket, email, log, etc.).
 */

export const I_NOTIFICATION_PORT = Symbol('I_NOTIFICATION_PORT');

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  jobId?: string;
  txHash?: string;
  error?: string;
  status?: 'completed' | 'failed';
}

export interface INotificationPort {
  /**
   * Envía una notificación al canal adecuado según el modo del job.
   * @param payload - Datos de la notificación.
   * @param deferred - true para canal diferido, false para tiempo real.
   */
  send(payload: NotificationPayload, deferred: boolean): Promise<void>;
}
