import { Test, TestingModule } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

describe('VaultService', () => {
  let service: VaultService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'VAULT_ENDPOINT') return 'http://localhost:8200';
      if (key === 'VAULT_TOKEN') return 'token-test';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe obtener la clave privada correctamente', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ data: { data: { privateKey: '0xClaveSecreta' } } }),
    });

    const key = await service.getPrivateKey();
    expect(key).toBe('0xClaveSecreta');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8200/v1/secret/data/blockchain',
      expect.any(Object),
    );
  });

  it('debe lanzar InternalServerError si fetch falla', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    await expect(service.getPrivateKey()).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
