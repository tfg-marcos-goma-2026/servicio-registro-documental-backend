/**
 * @file blockchain.service.spec.ts
 * @module documents/infrastructure
 * @description Test unitario de BlockchainService. Mockea ethers.js, Redlock
 * y SecretManagerPort para verificar la lógica de registro y verificación
 * sin necesitar un nodo real ni Redis.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { SecretManagerPort } from './vault/secret-manager.port';
import { ethers } from 'ethers';

const mockWait = jest.fn();
const mockRegistrar = jest.fn();
const mockVerificar = jest.fn();
const mockSend = jest.fn();

const mockWallet: { address: string } = { address: '0xWalletAddress' };

jest.mock('ethers', () => {
  const actual = jest.requireActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    ethers: {
      ...(actual as { ethers?: object }).ethers,
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        send: mockSend,
      })),
      Contract: jest
        .fn()
        .mockImplementation(
          (_addr: string, _abi: unknown, runner: unknown) => ({
            registrar: mockRegistrar,
            verificar: mockVerificar,
            runner,
          }),
        ),
      Wallet: jest.fn().mockImplementation(() => mockWallet),
      isError: jest.fn().mockReturnValue(false),
    },
  };
});

const mockRelease = jest.fn().mockResolvedValue(undefined);
const mockAcquire = jest.fn().mockResolvedValue({ release: mockRelease });

jest.mock('redlock', () => {
  return jest.fn().mockImplementation(() => ({ acquire: mockAcquire }));
});

describe('BlockchainService', () => {
  let service: BlockchainService;

  const mockConfigService = {
    get: jest.fn((key: string, def?: unknown) => {
      const cfg: Record<string, unknown> = {
        BLOCKCHAIN_RPC_URL: 'http://localhost:8545',
        REGISTRO_CONTRATO_ADDRESS: '0xContrato',
      };
      return cfg[key] ?? def;
    }),
  };

  const mockSecretManager = {
    getPrivateKey: jest.fn().mockResolvedValue('0xPrivKey'),
  };

  const mockRedisClient = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SecretManagerPort, useValue: mockSecretManager },
        { provide: 'REDIS_CLIENT', useValue: mockRedisClient },
      ],
    }).compile();

    service = module.get(BlockchainService);
    service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('debe inicializarse correctamente con variables de entorno presentes', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('debe lanzar error si faltan variables de entorno', () => {
      const badConfig = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const badService = new BlockchainService(
        badConfig as unknown as ConfigService,
        mockSecretManager,
        mockRedisClient as never,
      );

      expect(() => badService.onModuleInit()).toThrow(
        '[BlockchainService] Faltan variables RPC o Contract Address en el .env',
      );
    });
  });

  describe('registrarHash', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue('0x5');
      mockWait.mockResolvedValue({ hash: '0xTxHash' });
      mockRegistrar.mockResolvedValue({ wait: mockWait });
    });

    it('debe registrar el hash y devolver el txHash', async () => {
      const result = await service.registrarHash('0xDocHash');

      expect(result).toBe('0xTxHash');
      expect(mockAcquire).toHaveBeenCalledWith(['locks:blockchain-tx'], 15000);
      expect(mockRelease).toHaveBeenCalled();
    });

    it('debe liberar el lock incluso si registrar lanza error', async () => {
      mockRegistrar.mockRejectedValue(new Error('tx fallida'));

      await expect(service.registrarHash('0xDocHash')).rejects.toThrow(
        'tx fallida',
      );

      expect(mockRelease).toHaveBeenCalled();
    });

    it('debe lanzar SYSTEM_BUSY_LOCK_ACQUISITION_FAILED si Redlock falla', async () => {
      const redlockError = new Error('ExecutionError');
      redlockError.name = 'ExecutionError';
      mockAcquire.mockRejectedValueOnce(redlockError);

      await expect(service.registrarHash('0xDocHash')).rejects.toThrow(
        'SYSTEM_BUSY_LOCK_ACQUISITION_FAILED',
      );
    });

    it('debe lanzar DUPLICATE_HASH si el contrato rechaza por duplicado (reason)', async () => {
      const isErrorMock = jest.mocked(ethers.isError);
      isErrorMock.mockReturnValueOnce(true);

      const contractError = {
        reason: 'El documento ya esta registrado',
        shortMessage: '',
      };
      mockRegistrar.mockRejectedValue(contractError);

      await expect(service.registrarHash('0xDocHash')).rejects.toThrow(
        'DUPLICATE_HASH',
      );
    });

    it('debe lanzar DUPLICATE_HASH si el contrato rechaza por duplicado (shortMessage)', async () => {
      const isErrorMock = jest.mocked(ethers.isError);
      isErrorMock.mockReturnValueOnce(true);

      const contractError = {
        reason: '',
        shortMessage: 'El documento ya esta registrado',
      };
      mockRegistrar.mockRejectedValue(contractError);

      await expect(service.registrarHash('0xDocHash')).rejects.toThrow(
        'DUPLICATE_HASH',
      );
    });

    it('debe relanzar el error si isError=true pero no es duplicado', async () => {
      const isErrorMock = jest.mocked(ethers.isError);
      isErrorMock.mockReturnValueOnce(true);

      const contractError = new Error('otro error de contrato');
      (
        contractError as Error & { reason: string; shortMessage: string }
      ).reason = 'otro motivo';
      (
        contractError as Error & { reason: string; shortMessage: string }
      ).shortMessage = 'otro';

      mockRegistrar.mockRejectedValue(contractError);

      await expect(service.registrarHash('0xDocHash')).rejects.toThrow(
        'otro error de contrato',
      );
    });

    it('debe reutilizar el writableContract en llamadas sucesivas', async () => {
      await service.registrarHash('0xHash1');
      await service.registrarHash('0xHash2');

      expect(mockSecretManager.getPrivateKey).toHaveBeenCalledTimes(1);
    });
  });

  describe('verificarHash', () => {
    it('debe devolver existe=true con emisor y timestamp cuando el hash existe', async () => {
      mockVerificar.mockResolvedValue([true, '0xEmisor', BigInt(1700000000)]);

      const result = await service.verificarHash('0xDocHash');

      expect(result).toEqual({
        existe: true,
        emisor: '0xEmisor',
        timestamp: 1700000000,
      });
    });

    it('debe devolver existe=false cuando el hash no está registrado', async () => {
      mockVerificar.mockResolvedValue([false, '0x000', BigInt(0)]);

      const result = await service.verificarHash('0xDocHash');

      expect(result.existe).toBe(false);
    });
  });
});
