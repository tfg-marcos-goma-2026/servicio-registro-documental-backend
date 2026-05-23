/**
 * @file blockchain.module.ts
 * @module blockchain
 * @description Módulo dinámico que registra el cliente Redis y el servicio de
 *   blockchain. La implementación concreta (real o mock) se selecciona en
 *   tiempo de arranque mediante la variable de entorno BLOCKCHAIN_MOCK_MODE,
 *   lo que permite ejecutar pruebas de carga sin depender de un nodo real.
 *
 * Variables de entorno relevantes:
 *   - BLOCKCHAIN_MOCK_MODE: si es "true", se usa MockBlockchainService.
 *   - REDIS_HOST / REDIS_PORT: conexión al cliente Redis compartido con Redlock.
 */

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { BLOCKCHAIN_SERVICE } from './blockchain.interface';
import { BlockchainService } from './blockchain.service';
import { MockBlockchainService } from './mock-blockchain.service';
import { VaultModule } from '../vault/vault.module';

@Module({})
export class BlockchainModule {
  /**
   * Registra el módulo de forma dinámica.
   * Evalúa BLOCKCHAIN_MOCK_MODE en tiempo de carga del módulo y vincula
   * BLOCKCHAIN_SERVICE a la clase correspondiente.
   */
  static register(): DynamicModule {
    const isMock = process.env.BLOCKCHAIN_MOCK_MODE === 'true';

    return {
      module: BlockchainModule,
      imports: [ConfigModule, VaultModule],
      providers: [
        {
          /** Cliente Redis compartido por BlockchainService y Redlock. */
          provide: 'REDIS_CLIENT',
          useFactory: (configService: ConfigService) => {
            return new Redis({
              host: configService.get<string>('REDIS_HOST', 'localhost'),
              port: configService.get<number>('REDIS_PORT', 6379),
            });
          },
          inject: [ConfigService],
        },
        {
          provide: BLOCKCHAIN_SERVICE,
          useClass: isMock ? MockBlockchainService : BlockchainService,
        },
      ],
      exports: [BLOCKCHAIN_SERVICE],
    };
  }
}
