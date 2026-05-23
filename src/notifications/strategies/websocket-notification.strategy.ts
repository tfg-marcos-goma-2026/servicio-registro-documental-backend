/**
 * @file websocket-notification.strategy.ts
 * @module notifications/strategies
 * @description Estrategia de notificación en tiempo real mediante WebSocket y
 *   único punto de gestión del protocolo Socket.io. Fusiona las dos
 *   responsabilidades que estaban repartidas entre DocumentsGateway y la
 *   estrategia previa, eliminando la indirección innecesaria:
 *
 *     1. Protocolo: gestiona la suscripción de clientes a salas job-{jobId}
 *        mediante el evento "join-job".
 *     2. Notificación: implementa NotificationStrategy para emitir el evento
 *        "job-status" cuando el procesador termina o falla un job.
 *
 *   Al estar decorada con @WebSocketGateway, NestJS inyecta automáticamente
 *   el servidor Socket.io real en @WebSocketServer(), lo que hace inviable
 *   separar ambas responsabilidades sin perder esa inyección.
 */

import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  NotificationStrategy,
  NotificationPayload,
} from '../notification-strategy.interface';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class WebSocketNotificationStrategy implements NotificationStrategy {
  @WebSocketServer()
  server!: Server;

  readonly name = 'WEBSOCKET';

  /**
   * Suscribe al cliente a la sala del job indicado para que reciba las
   * notificaciones de estado correspondientes.
   *
   * @param client - Socket del cliente que realiza la suscripción.
   * @param data   - Objeto con el jobId al que el cliente quiere suscribirse.
   */
  @SubscribeMessage('join-job')
  async handleJoinJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    const room = `job-${data.jobId}`;
    await client.join(room);
    console.log(
      `[WebSocket] Cliente ${client.id} se ha unido a la sala: ${room}`,
    );
  }

  /**
   * Emite el evento "job-status" a la sala del job correspondiente.
   * Si el status es 'completed' emite el txHash; si es 'failed' emite el error.
   *
   * @param payload - Debe incluir jobId y status. txHash si completed, error si failed.
   */
  send(payload: NotificationPayload): Promise<void> {
    const { jobId, status, txHash, error } = payload;

    if (!jobId || !status) {
      console.warn(
        `[WebSocketNotificationStrategy] Payload incompleto: falta jobId o status.`,
      );
      return Promise.resolve();
    }

    if (status === 'completed' && txHash) {
      this.server.to(`job-${jobId}`).emit('job-status', {
        status: 'completed',
        txHash,
      });
    } else if (status === 'failed' && error) {
      this.server.to(`job-${jobId}`).emit('job-status', {
        status: 'failed',
        error,
      });
    }

    return Promise.resolve();
  }
}
