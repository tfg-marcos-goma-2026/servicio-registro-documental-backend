import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import * as blockchainInterface from '../blockchain/blockchain.interface';
import {
  InternalServerErrorException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockBlockchainService = {
    verificarHash: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    getWaitingCount: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      if (key === 'QUEUE_HIGH_LOAD_LIMIT') return 50;
      if (key === 'QUEUE_EXTREME_LOAD_LIMIT') return 100;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: blockchainInterface.BLOCKCHAIN_SERVICE,
          useValue: mockBlockchainService,
        },
        {
          provide: getQueueToken('blockchain-queue'),
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);

    mockBlockchainService.verificarHash.mockResolvedValue({ existe: false });
    mockQueue.getWaitingCount.mockResolvedValue(0);
    mockQueue.add.mockResolvedValue({ id: 'job-1' });
  });

  describe('registerDocument', () => {
    it('debe lanzar ConflictException si el documento ya existe (Duplicado)', async () => {
      mockBlockchainService.verificarHash.mockResolvedValue({ existe: true });

      await expect(service.registerDocument('0xHash')).rejects.toThrow(
        ConflictException,
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('debe lanzar ServiceUnavailableException si la cola supera el límite extremo (Load Shedding)', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(100);

      await expect(service.registerDocument('0xHash')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('debe encolar como DIFERIDO si la cola supera el límite alto (Backpressure)', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(50);

      const result = await service.registerDocument('0xHash');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'register-document',
        { hash: '0xHash', deferred: true, userId: 'user-tfg-123' },
        expect.any(Object),
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe('deferred');
    });

    it('debe encolar como NORMAL si la carga es baja', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(5);

      const result = await service.registerDocument('0xHash');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'register-document',
        { hash: '0xHash', deferred: false, userId: 'user-tfg-123' },
        expect.any(Object),
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('debe devolver InternalServerErrorException si falla la inserción en Redis', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis Timeout'));

      await expect(service.registerDocument('0xHash')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyDocument', () => {
    it('debe devolver isVerified false si el documento no existe', async () => {
      mockBlockchainService.verificarHash.mockResolvedValue({ existe: false });
      const result = await service.verifyDocument('hash123');
      expect(result.isVerified).toBe(false);
    });

    it('debe devolver error si falla la verificación', async () => {
      mockBlockchainService.verificarHash.mockRejectedValue(
        new Error('Fallo de red'),
      );
      await expect(service.verifyDocument('hash123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
