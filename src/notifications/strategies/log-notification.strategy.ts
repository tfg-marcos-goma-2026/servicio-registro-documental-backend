/**
 * @file log-notification.strategy.ts
 * @module notifications/strategies
 * @description Estrategia de notificación por consola. Se usa en modo diferido
 *   cuando no hay un canal de comunicación en tiempo real disponible (p. ej.
 *   el usuario no tiene una conexión WebSocket activa porque envió la petición
 *   en un momento de alta carga). En producción, esta estrategia se sustituiría
 *   por una de email o push sin modificar ningún otro fichero.
 */

import { Injectable } from '@nestjs/common';
import {
  NotificationStrategy,
  NotificationPayload,
} from '../notification-strategy.interface';

@Injectable()
export class LogNotificationStrategy implements NotificationStrategy {
  readonly name = 'LOG_MOCK';

  /**
   * Imprime la notificación en la consola con formato legible.
   * @param payload - Datos de la notificación a mostrar.
   */
  send(payload: NotificationPayload): Promise<void> {
    console.log(`\n==================================================`);
    console.log(`[NOTIFICACIÓN ESTRATEGIA: ${this.name}]`);
    console.log(`Para Usuario ID: ${payload.userId}`);
    console.log(`Asunto: ${payload.title}`);
    console.log(`Mensaje: ${payload.message}`);
    console.log(`==================================================\n`);
    return Promise.resolve();
  }
}
