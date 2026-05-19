import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockBlockchainService = {
    verificarHash: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: getQueueToken('blockchain-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('debe encolar el registro y devolver el job Id', async () => {
    mockQueue.add.mockResolvedValue({ id: 'job-1' });
    const result = await service.registerDocument('hash123');

    expect(mockQueue.add).toHaveBeenCalledWith(
      'register-document',
      { hash: 'hash123' },
      expect.any(Object),
    );
    expect(result.success).toBe(true);
    expect(result.jobId).toBe('job-1');
  });

  it('debe devolver error si falla el encolado', async () => {
    mockQueue.add.mockRejectedValue(new Error('Redis down'));
    await expect(service.registerDocument('hash123')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

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
