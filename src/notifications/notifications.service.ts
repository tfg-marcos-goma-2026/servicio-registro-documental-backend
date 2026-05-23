/**
 * @file notifications.service.ts
 * @module notifications
 * @description Servicio central del sistema de notificaciones. Aplica el
 *   patrón Strategy para enrutar cada notificación al canal correcto sin que
 *   los consumidores necesiten conocer los detalles
 *   de ningún canal concreto.
 *
 *   Selección de estrategia:
 *     - deferred=true  → LogNotificationStrategy  (canal asíncrono / diferido).
 *     - deferred=false → WebSocketNotificationStrategy (canal en tiempo real).
 *
 *   Para añadir un nuevo canal (email, push, SMS) basta con implementar
 *   NotificationStrategy y registrarlo en NotificationsModule, sin tocar
 *   este servicio ni DocumentsProcessor.
 */

import { Injectable } from '@nestjs/common';
import {
  NotificationPayload,
  NotificationStrategy,
} from './notification-strategy.interface';
import { LogNotificationStrategy } from './strategies/log-notification.strategy';
import { WebSocketNotificationStrategy } from './strategies/websocket-notification.strategy';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly logStrategy: LogNotificationStrategy,
    private readonly wsStrategy: WebSocketNotificationStrategy,
  ) {}

  /**
   * Selecciona la estrategia adecuada según el modo del job y delega el envío.
   *
   * @param payload  - Datos completos de la notificación.
   * @param deferred - true para canal diferido (log), false para tiempo real (WebSocket).
   */
  async enviarNotificacion(
    payload: NotificationPayload,
    deferred: boolean,
  ): Promise<void> {
    const strategy: NotificationStrategy = deferred
      ? this.logStrategy
      : this.wsStrategy;

    await strategy.send(payload);
  }
}
