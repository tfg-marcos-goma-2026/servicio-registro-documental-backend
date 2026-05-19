import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockBlockchainService = {
    registrarHash: jest.fn(),
    verificarHash: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('debe registrar y devolver la transacción', async () => {
    mockBlockchainService.registrarHash.mockResolvedValue('0xTX');
    const result = await service.registerDocument('hash123');
    expect(result.success).toBe(true);
    expect(result.transactionHash).toBe('0xTX');
  });

  it('debe devolver error si falla el registro', async () => {
    mockBlockchainService.registrarHash.mockRejectedValue(
      new Error('Fallo de red'),
    );
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
