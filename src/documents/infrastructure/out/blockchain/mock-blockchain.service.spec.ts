/**
 * @file mock-blockchain.service.spec.ts
 * @module documents/infrastructure
 * @description Test unitario del adaptador mock de blockchain. Verifica que
 * las latencias configurables se aplican y que los valores devueltos
 * cumplen el contrato de IBlockchainPort sin necesitar infraestructura real.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MockBlockchainService } from './mock-blockchain.service';
import { ConfigService } from '@nestjs/config';

describe('MockBlockchainService', () => {
  let service: MockBlockchainService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        VAULT_MOCK_LATENCY_MS: 10,
        BLOCKCHAIN_MOCK_LATENCY_MS: 20,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockBlockchainService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(MockBlockchainService);
  });

  describe('registrarHash', () => {
    it('debe devolver un txHash con formato 0x + 64 caracteres hexadecimales', async () => {
      const txHash = await service.registrarHash('0xcualquierhash');

      expect(txHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('debe completarse tras las latencias configuradas', async () => {
      const inicio = Date.now();
      await service.registrarHash('0xhash');
      const duracion = Date.now() - inicio;

      expect(duracion).toBeGreaterThanOrEqual(28);
    });
  });

  describe('verificarHash', () => {
    it('debe retornar siempre existe=false (mock sin estado)', async () => {
      const result = await service.verificarHash('0xcualquierhash');

      expect(result).toEqual({
        existe: false,
        emisor: '0x000...000',
        timestamp: 0,
      });
    });
  });

  describe('onModuleInit', () => {
    it('debe ejecutarse sin lanzar errores', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });
});
