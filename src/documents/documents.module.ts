/**
 * @file documents.module.ts
 * @module documents
 * @description Módulo principal de la funcionalidad de registro documental.
 *   Agrupa el controlador HTTP, el servicio de negocio, el procesador de cola
 *   y el gateway de WebSocket. Registra la cola "blockchain-queue" de BullMQ
 *   que actúa como buffer entre las peticiones HTTP y las transacciones en
 *   blockchain.
 *
 * Dependencias externas:
 *   - BullModule       Cola de trabajos para procesamiento asíncrono.
 *   - BlockchainModule Acceso al contrato inteligente.
 *   - NotificationsModule Estrategias de notificación al usuario.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DocumentsProcessor } from './documents.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'blockchain-queue' }),
    BlockchainModule.register(),
    NotificationsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsProcessor],
})
export class DocumentsModule {}
