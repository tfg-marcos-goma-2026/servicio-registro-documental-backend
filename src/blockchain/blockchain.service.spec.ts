import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { SecretManager } from '../vault/secret-manager.interface';
import { ethers } from 'ethers';

const mockWait = jest.fn();
const mockRegistrar = jest.fn();
const mockVerificar = jest.fn();
const mockSend = jest.fn();

const mockWritableContract = {
  registrar: mockRegistrar,
  runner: {
    address: '0xWalletAddr',
    getAddress: jest.fn().mockResolvedValue('0xWalletAddr'),
  },
};
const mockReadOnlyContract = { verificar: mockVerificar };

jest.mock('ethers', () => {
  const original = jest.requireActual<typeof import('ethers')>('ethers');
  return {
    ...original,
    ethers: {
      ...original.ethers,
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        send: mockSend,
      })),
      Wallet: jest.fn().mockImplementation(() => ({ address: '0xWalletAddr' })),
      Contract: jest
        .fn()
        .mockImplementationOnce(() => mockReadOnlyContract)
        .mockImplementation(() => mockWritableContract),
    },
  };
});

const mockRelease = jest.fn().mockResolvedValue(undefined);
const mockAcquire = jest.fn().mockResolvedValue({ release: mockRelease });

jest.mock('redlock', () =>
  jest.fn().mockImplementation(() => ({
    acquire: mockAcquire,
  })),
);

const PRIVATE_KEY =
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const HASH = '0xabc123';
const TX_HASH = '0xTxSuccess';

function buildModule(
  rpcUrl = 'http://localhost:8545',
  contractAddress = '0xContractAddress',
) {
  return Test.createTestingModule({
    providers: [
      BlockchainService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => {
            if (key === 'BLOCKCHAIN_RPC_URL') return rpcUrl;
            if (key === 'REGISTRO_CONTRATO_ADDRESS') return contractAddress;
            return undefined;
          }),
        },
      },
      {
        provide: SecretManager,
        useValue: {
          getPrivateKey: jest.fn().mockResolvedValue(PRIVATE_KEY),
        },
      },
      {
        provide: 'REDIS_CLIENT',
        useValue: {},
      },
    ],
  }).compile();
}

describe('BlockchainService', () => {
  let service: BlockchainService;
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();

    (ethers.Contract as jest.Mock)
      .mockImplementationOnce(() => mockReadOnlyContract)
      .mockImplementation(() => mockWritableContract);

    module = await buildModule();
    service = module.get<BlockchainService>(BlockchainService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await module.close();
  });

  describe('onModuleInit()', () => {
    it('initialises without throwing when env vars are present', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('throws when BLOCKCHAIN_RPC_URL is missing', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          BlockchainService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: SecretManager, useValue: { getPrivateKey: jest.fn() } },
          { provide: 'REDIS_CLIENT', useValue: {} },
        ],
      }).compile();

      const svc = mod.get<BlockchainService>(BlockchainService);
      expect(() => svc.onModuleInit()).toThrow(
        '[BlockchainService] Faltan variables RPC o Contract Address en el .env',
      );
      await mod.close();
    });

    it('throws when REGISTRO_CONTRATO_ADDRESS is missing', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          BlockchainService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) =>
                key === 'BLOCKCHAIN_RPC_URL'
                  ? 'http://localhost:8545'
                  : undefined,
              ),
            },
          },
          { provide: SecretManager, useValue: { getPrivateKey: jest.fn() } },
          { provide: 'REDIS_CLIENT', useValue: {} },
        ],
      }).compile();

      const svc = mod.get<BlockchainService>(BlockchainService);
      expect(() => svc.onModuleInit()).toThrow(
        '[BlockchainService] Faltan variables RPC o Contract Address en el .env',
      );
      await mod.close();
    });
  });

  describe('registrarHash()', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue('0xa');
      mockRegistrar.mockResolvedValue({ wait: mockWait });
      mockWait.mockResolvedValue({ hash: TX_HASH });
    });

    it('acquires a Redlock lock before sending the transaction', async () => {
      await service.registrarHash(HASH);
      expect(mockAcquire).toHaveBeenCalledWith(['locks:blockchain-tx'], 15000);
    });

    it('queries the nonce with eth_getTransactionCount', async () => {
      await service.registrarHash(HASH);
      expect(mockSend).toHaveBeenCalledWith('eth_getTransactionCount', [
        '0xWalletAddr',
        'latest',
      ]);
    });

    it('calls registrar on the contract with the correct hash and nonce', async () => {
      await service.registrarHash(HASH);
      expect(mockRegistrar).toHaveBeenCalledWith(HASH, { nonce: 10 });
    });

    it('returns the transaction hash on success', async () => {
      const result = await service.registrarHash(HASH);
      expect(result).toBe(TX_HASH);
    });

    it('releases the lock even on success', async () => {
      await service.registrarHash(HASH);
      expect(mockRelease).toHaveBeenCalled();
    });

    it('throws DUPLICATE_HASH when the contract reverts with "El documento ya esta registrado"', async () => {
      const callError = Object.assign(new Error('CALL_EXCEPTION'), {
        code: 'CALL_EXCEPTION',
        reason: 'El documento ya esta registrado',
        shortMessage: 'El documento ya esta registrado',
      });
      jest.spyOn(ethers, 'isError').mockReturnValueOnce(true);
      mockRegistrar.mockRejectedValue(callError);

      await expect(service.registrarHash(HASH)).rejects.toThrow(
        'DUPLICATE_HASH',
      );
    });

    it('throws SYSTEM_BUSY_LOCK_ACQUISITION_FAILED when Redlock raises ExecutionError', async () => {
      const lockError = Object.assign(new Error('ExecutionError'), {
        name: 'ExecutionError',
      });
      mockAcquire.mockRejectedValueOnce(lockError);

      await expect(service.registrarHash(HASH)).rejects.toThrow(
        'SYSTEM_BUSY_LOCK_ACQUISITION_FAILED',
      );
    });

    it('re-throws unknown errors unchanged', async () => {
      const unknownError = new Error('Unknown network failure');
      mockRegistrar.mockRejectedValue(unknownError);

      await expect(service.registrarHash(HASH)).rejects.toThrow(
        'Unknown network failure',
      );
    });

    it('releases the lock even when an error is thrown', async () => {
      mockRegistrar.mockRejectedValue(new Error('Boom'));
      await expect(service.registrarHash(HASH)).rejects.toThrow();
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('verificarHash()', () => {
    it('returns existe, emisor, and timestamp for a registered hash', async () => {
      mockVerificar.mockResolvedValue([
        true,
        '0xEmitterAddress',
        BigInt(1716480000),
      ]);

      const result = await service.verificarHash(HASH);

      expect(result).toEqual({
        existe: true,
        emisor: '0xEmitterAddress',
        timestamp: 1716480000,
      });
    });

    it('returns existe=false for an unregistered hash', async () => {
      mockVerificar.mockResolvedValue([false, ethers.ZeroAddress, BigInt(0)]);

      const result = await service.verificarHash(HASH);

      expect(result.existe).toBe(false);
      expect(result.timestamp).toBe(0);
    });

    it('converts BigInt timestamp to a plain number', async () => {
      mockVerificar.mockResolvedValue([true, '0xEmitter', BigInt(9999999999)]);

      const result = await service.verificarHash(HASH);

      expect(typeof result.timestamp).toBe('number');
      expect(result.timestamp).toBe(9999999999);
    });

    it('propagates errors thrown by the contract', async () => {
      mockVerificar.mockRejectedValue(new Error('RPC error'));

      await expect(service.verificarHash(HASH)).rejects.toThrow('RPC error');
    });
  });
});
