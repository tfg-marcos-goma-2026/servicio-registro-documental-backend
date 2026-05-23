/**
 * @file notifications.module.ts
 * @module notifications
 * @description Módulo que registra todas las estrategias de notificación
 *   disponibles y las expone a través de NotificationsService.
 */

import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { LogNotificationStrategy } from './strategies/log-notification.strategy';
import { WebSocketNotificationStrategy } from './strategies/websocket-notification.strategy';

@Module({
  providers: [
    NotificationsService,
    LogNotificationStrategy,
    WebSocketNotificationStrategy,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
