/**
 * @file register-document.service.spec.ts
 * @module documents/application
 * @description Test unitario del caso de uso de registro. Valida la lógica de
 * negocio de backpressure y load shedding aislada de cualquier framework,
 * incluyendo la validación de formato delegada en el dominio.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RegisterDocumentService } from './register-document.service';
import { I_BLOCKCHAIN_PORT } from '../ports/out/blockchain.port';
import { I_QUEUE_PORT } from '../ports/out/queue.port';
import {
  DuplicateDocumentException,
  InvalidDocumentHashException,
  SystemOverloadedException,
} from '../../domain/exceptions/document.exceptions';

/** Hash bytes32 válido usado como fixture en todos los tests. */
const VALID_HASH =
  '0xe8c6b5b48b78e66a103cd2c79aa19cd869a7e53fe31bba832f4592bf92e567c8';

describe('RegisterDocumentService', () => {
  let service: RegisterDocumentService;

  const mockBlockchainPort = {
    verificarHash: jest.fn(),
    registrarHash: jest.fn(),
  };

  const mockQueuePort = {
    getWaitingCount: jest.fn(),
    addRegisterJob: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterDocumentService,
        { provide: I_BLOCKCHAIN_PORT, useValue: mockBlockchainPort },
        { provide: I_QUEUE_PORT, useValue: mockQueuePort },
        { provide: 'HIGH_LOAD_LIMIT', useValue: 50 },
        { provide: 'EXTREME_LOAD_LIMIT', useValue: 100 },
      ],
    }).compile();

    service = module.get<RegisterDocumentService>(RegisterDocumentService);
  });

  describe('validación de dominio', () => {
    it('debe lanzar InvalidDocumentHashException si el hash no tiene formato bytes32', async () => {
      await expect(service.execute('hash-invalido')).rejects.toThrow(
        InvalidDocumentHashException,
      );
      expect(mockBlockchainPort.verificarHash).not.toHaveBeenCalled();
    });

    it('debe lanzar InvalidDocumentHashException si el hash tiene longitud incorrecta', async () => {
      await expect(service.execute('0xabc123')).rejects.toThrow(
        InvalidDocumentHashException,
      );
    });
  });

  describe('comprobación de duplicados', () => {
    it('debe lanzar DuplicateDocumentException si el documento ya existe', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({ existe: true });
      await expect(service.execute(VALID_HASH)).rejects.toThrow(
        DuplicateDocumentException,
      );
    });
  });

  describe('load shedding', () => {
    it('debe lanzar SystemOverloadedException bajo carga extrema (≥ 100 jobs)', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({ existe: false });
      mockQueuePort.getWaitingCount.mockResolvedValue(100);
      await expect(service.execute(VALID_HASH)).rejects.toThrow(
        SystemOverloadedException,
      );
    });

    it('debe encolar como "deferred" bajo alta carga (≥ 50 y < 100 jobs)', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({ existe: false });
      mockQueuePort.getWaitingCount.mockResolvedValue(60);
      mockQueuePort.addRegisterJob.mockResolvedValue({ jobId: 'job-1' });

      const result = await service.execute(VALID_HASH);

      expect(result.status).toBe('deferred');
      expect(mockQueuePort.addRegisterJob).toHaveBeenCalledWith(
        VALID_HASH,
        true,
        expect.any(String),
      );
    });

    it('debe encolar como "pending" bajo carga normal (< 50 jobs)', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({ existe: false });
      mockQueuePort.getWaitingCount.mockResolvedValue(10);
      mockQueuePort.addRegisterJob.mockResolvedValue({ jobId: 'job-2' });

      const result = await service.execute(VALID_HASH);

      expect(result.status).toBe('pending');
      expect(mockQueuePort.addRegisterJob).toHaveBeenCalledWith(
        VALID_HASH,
        false,
        expect.any(String),
      );
    });
  });

  describe('resultado exitoso', () => {
    it('debe devolver el jobId y el hash canónico en la respuesta', async () => {
      mockBlockchainPort.verificarHash.mockResolvedValue({ existe: false });
      mockQueuePort.getWaitingCount.mockResolvedValue(0);
      mockQueuePort.addRegisterJob.mockResolvedValue({ jobId: 'job-42' });

      const result = await service.execute(VALID_HASH);

      expect(result).toMatchObject({
        success: true,
        hash: VALID_HASH,
        jobId: 'job-42',
      });
    });
  });
});
