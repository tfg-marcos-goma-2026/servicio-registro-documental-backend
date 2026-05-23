import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MockBlockchainService } from './mock-blockchain.service';

describe('MockBlockchainService', () => {
  let service: MockBlockchainService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockBlockchainService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: number) => {
              if (key === 'VAULT_MOCK_LATENCY_MS') return 100;
              if (key === 'BLOCKCHAIN_MOCK_LATENCY_MS') return 200;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MockBlockchainService>(MockBlockchainService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('onModuleInit()', () => {
    it('imprime las latencias y el throughput estimado al arrancar', () => {
      service.onModuleInit();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('MODO MOCK ACTIVO'),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('100ms'),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('200ms'),
      );
    });

    it('incluye los valores sugeridos de HIGH_LOAD y EXTREME_LOAD', () => {
      service.onModuleInit();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('HIGH_LOAD'),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('EXTREME_LOAD'),
      );
    });
  });

  describe('registrarHash()', () => {
    it('devuelve un txHash en formato 0x + 64 caracteres hexadecimales', async () => {
      const promise = service.registrarHash('0xabc');
      await jest.runAllTimersAsync();
      const txHash = await promise;

      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('genera txHashes distintos en cada llamada', async () => {
      const p1 = service.registrarHash('0xabc');
      await jest.runAllTimersAsync();
      const tx1 = await p1;

      const p2 = service.registrarHash('0xabc');
      await jest.runAllTimersAsync();
      const tx2 = await p2;

      expect(tx1).not.toBe(tx2);
    });

    it('espera la latencia de Vault antes de continuar', async () => {
      const promise = service.registrarHash('0xabc');

      await jest.advanceTimersByTimeAsync(99);
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Secreto obtenido'),
      );

      await jest.advanceTimersByTimeAsync(1);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Secreto obtenido'),
      );

      await jest.runAllTimersAsync();
      await promise;
    });
  });

  describe('verificarHash()', () => {
    it('devuelve siempre existe=false', async () => {
      const result = await service.verificarHash('0xabc');
      expect(result.existe).toBe(false);
    });

    it('devuelve timestamp=0', async () => {
      const result = await service.verificarHash('0xabc');
      expect(result.timestamp).toBe(0);
    });

    it('devuelve una dirección de emisor placeholder', async () => {
      const result = await service.verificarHash('0xabc');
      expect(result.emisor).toBeTruthy();
    });

    it('resuelve sin importar el hash recibido', async () => {
      await expect(service.verificarHash('0x111')).resolves.toBeDefined();
      await expect(service.verificarHash('0x222')).resolves.toBeDefined();
    });
  });
});
