/**
 * @file verify-document.service.spec.ts
 * @module documents/application
 * @description Test unitario del caso de uso de verificación. Valida la
 * lógica de negocio aislada de cualquier framework, incluyendo la validación
 * de formato delegada en el dominio y el formateo de fechas via Document.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { VerifyDocumentService } from './verify-document.service';
import { I_BLOCKCHAIN_PORT } from '../ports/out/blockchain.port';
import { InvalidDocumentHashException } from '../../domain/exceptions/document.exceptions';

/** Hash bytes32 válido usado como fixture en todos los tests. */
const VALID_HASH =
  '0xe8c6b5b48b78e66a103cd2c79aa19cd869a7e53fe31bba832f4592bf92e567c8';

describe('VerifyDocumentService', () => {
  let service: VerifyDocumentService;

  const mockBlockchainPort = { verificarHash: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyDocumentService,
        { provide: I_BLOCKCHAIN_PORT, useValue: mockBlockchainPort },
      ],
    }).compile();

    service = module.get<VerifyDocumentService>(VerifyDocumentService);
  });

  describe('validación de dominio', () => {
    it('debe lanzar InvalidDocumentHashException si el hash no tiene formato bytes32', async () => {
      await expect(service.execute('hash-invalido')).rejects.toThrow(
        InvalidDocumentHashException,
      );
      expect(mockBlockchainPort.verificarHash).not.toHaveBeenCalled();
    });
  });

  describe('documento no registrado', () => {
    it('debe retornar isVerified=false si el hash no existe en blockchain', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({ existe: false });

      const result = await service.execute(VALID_HASH);

      expect(result).toMatchObject({
        success: false,
        isVerified: false,
        hash: VALID_HASH,
        error: 'El documento no consta en el registro',
      });
    });
  });

  describe('documento registrado', () => {
    it('debe retornar isVerified=true con emisor y timestamp formateado', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({
        existe: true,
        emisor: '0xAbC123',
        timestamp: 1_700_000_000,
      });

      const result = await service.execute(VALID_HASH);

      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.issuer).toBe('0xAbC123');
      expect(typeof result.timestamp).toBe('string');
      expect(result.timestamp).toBeTruthy();
    });

    it('debe delegar el formateo de fecha en la entidad Document (locale es-ES)', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({
        existe: true,
        emisor: '0xAbC123',
        timestamp: 1_700_000_000,
      });

      const result = await service.execute(VALID_HASH);

      expect(result.timestamp).toContain('2023');
    });
  });
});
