/**
 * @file vault.adapter.spec.ts
 * @module documents/infrastructure
 * @description Test unitario del adaptador de Vault. Verifica la obtención
 * de la clave privada y el manejo de errores de comunicación.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { VaultAdapter } from './vault.adapter';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

describe('VaultAdapter', () => {
  let adapter: VaultAdapter;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        VAULT_ENDPOINT: 'http://localhost:8200',
        VAULT_TOKEN: 'test-token',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultAdapter,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    adapter = module.get(VaultAdapter);
  });

  it('debe devolver la clave privada cuando Vault responde correctamente', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { data: { privateKey: '0xPRIVATE_KEY' } },
        }),
    });

    const key = await adapter.getPrivateKey();

    expect(key).toBe('0xPRIVATE_KEY');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8200/v1/secret/data/blockchain',
      expect.objectContaining({
        headers: { 'X-Vault-Token': 'test-token' },
      }),
    );
  });

  it('debe lanzar InternalServerErrorException si Vault responde con error HTTP', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    });

    await expect(adapter.getPrivateKey()).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('debe lanzar InternalServerErrorException si fetch lanza una excepción de red', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(adapter.getPrivateKey()).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
