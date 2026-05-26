/**
 * @file documents.module.ts
 * @module documents
 * @description Módulo ensamblador de la Arquitectura Hexagonal. Conecta los
 * puertos definidos en la capa de aplicación con los adaptadores
 * implementados en la capa de infraestructura. Contiene toda la lógica de
 * selección entre implementación real y mock de blockchain.
 *
 * Variables de entorno relevantes:
 * - BLOCKCHAIN_MOCK_MODE  Si es "true", se usa MockBlockchainService.
 * - REDIS_HOST / REDIS_PORT  Conexión a Redis para Redlock.
 */

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';

import { DocumentsController } from './infrastructure/in/http/documents.controller';
import { DocumentsProcessor } from './infrastructure/in/messaging/documents.processor';

import { BlockchainService } from './infrastructure/out/blockchain/blockchain.service';
import { MockBlockchainService } from './infrastructure/out/blockchain/mock-blockchain.service';
import { BullMqQueueAdapter } from './infrastructure/out/queue/bullmq-queue.adapter';
import { NotificationsAdapter } from './infrastructure/out/notifications/notifications.adapter';
import { LogNotificationAdapter } from './infrastructure/out/notifications/log-notification.adapter';
import { WebSocketNotificationAdapter } from './infrastructure/out/notifications/websocket-notification.adapter';
import { VaultAdapter } from './infrastructure/out/blockchain/vault/vault.adapter';
import { SecretManagerPort } from './infrastructure/out/blockchain/vault/secret-manager.port';

import { I_BLOCKCHAIN_PORT } from './application/ports/out/blockchain.port';
import { I_QUEUE_PORT } from './application/ports/out/queue.port';
import { I_NOTIFICATION_PORT } from './application/ports/out/notification.port';

import { RegisterDocumentService } from './application/services/register-document.service';
import { VerifyDocumentService } from './application/services/verify-document.service';

@Module({})
export class DocumentsModule {
  /**
   * Registra el módulo de forma dinámica para poder seleccionar en tiempo
   * de arranque la implementación real o mock de blockchain según
   * BLOCKCHAIN_MOCK_MODE, replicando el comportamiento que tenía BlockchainModule.
   */
  static register(): DynamicModule {
    const isMock = process.env.BLOCKCHAIN_MOCK_MODE === 'true';

    return {
      module: DocumentsModule,
      imports: [
        BullModule.registerQueue({ name: 'blockchain-queue' }),
        ConfigModule,
      ],
      controllers: [DocumentsController],
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: (config: ConfigService) =>
            new Redis({
              host: config.get<string>('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
            }),
          inject: [ConfigService],
        },

        {
          provide: SecretManagerPort,
          useClass: VaultAdapter,
        },

        {
          provide: I_BLOCKCHAIN_PORT,
          useClass: isMock ? MockBlockchainService : BlockchainService,
        },

        {
          provide: I_QUEUE_PORT,
          useClass: BullMqQueueAdapter,
        },

        LogNotificationAdapter,
        WebSocketNotificationAdapter,
        NotificationsAdapter,
        {
          provide: I_NOTIFICATION_PORT,
          useExisting: NotificationsAdapter,
        },

        {
          provide: 'HIGH_LOAD_LIMIT',
          useFactory: (config: ConfigService) =>
            config.get<number>('QUEUE_HIGH_LOAD_LIMIT', 50),
          inject: [ConfigService],
        },
        {
          provide: 'EXTREME_LOAD_LIMIT',
          useFactory: (config: ConfigService) =>
            config.get<number>('QUEUE_EXTREME_LOAD_LIMIT', 100),
          inject: [ConfigService],
        },

        RegisterDocumentService,
        VerifyDocumentService,

        DocumentsProcessor,
      ],
    };
  }
}
