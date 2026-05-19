import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';
import { ConfigService } from '@nestjs/config';
import { SecretManager } from '../vault/secret-manager.interface';

// Mockeamos la librería externa ethers
jest.mock('ethers', () => {
  const mockTx = {
    wait: jest.fn().mockResolvedValue({ hash: '0xTransaccion' }),
  };
  const mockContractInstance = {
    registrar: jest.fn().mockResolvedValue(mockTx),
    verificar: jest.fn().mockResolvedValue([true, '0xEmisor', 1620000000n]),
  };

  return {
    ethers: {
      JsonRpcProvider: jest.fn(),
      Wallet: jest.fn(),
      Contract: jest.fn(() => mockContractInstance),
    },
  };
});

describe('BlockchainService', () => {
  let service: BlockchainService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BLOCKCHAIN_RPC_URL') return 'http://localhost:8545';
      if (key === 'REGISTRO_CONTRATO_ADDRESS') return '0xContrato';
      return null;
    }),
  };

  const mockSecretManager = {
    getPrivateKey: jest.fn().mockResolvedValue('0xClavePrivada'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SecretManager, useValue: mockSecretManager },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);

    service.onModuleInit();
  });

  it('debe registrar un hash y devolver el ID de la transacción', async () => {
    const txHash = await service.registrarHash('0xHashDocumento');
    expect(mockSecretManager.getPrivateKey).toHaveBeenCalled();
    expect(txHash).toBe('0xTransaccion');
  });

  it('debe verificar un hash correctamente', async () => {
    const result = await service.verificarHash('0xHashDocumento');
    expect(result.existe).toBe(true);
    expect(result.emisor).toBe('0xEmisor');
  });

  it('debe lanzar error si faltan variables de entorno al iniciar', () => {
    mockConfigService.get.mockReturnValueOnce(null);

    expect(() => {
      service.onModuleInit();
    }).toThrow(
      '[BlockchainService] Faltan variables RPC o Contract Address en el .env',
    );
  });
});
