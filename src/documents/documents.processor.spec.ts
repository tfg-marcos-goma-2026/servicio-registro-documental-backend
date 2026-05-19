import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsProcessor } from './documents.processor';
import { BlockchainService } from '../blockchain/blockchain.service';
import { DocumentsGateway } from './documents.gateway';
import { Job } from 'bullmq';

describe('DocumentsProcessor', () => {
  let processor: DocumentsProcessor;

  const mockBlockchainService = {
    registrarHash: jest.fn(),
  };

  const mockDocumentsGateway = {
    emitJobSuccess: jest.fn(),
    emitJobFailed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsProcessor,
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: DocumentsGateway,
          useValue: mockDocumentsGateway,
        },
      ],
    }).compile();

    processor = module.get<DocumentsProcessor>(DocumentsProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe procesar un job de register-document exitosamente', async () => {
    mockBlockchainService.registrarHash.mockResolvedValue(
      '0xTransaccionExitosa',
    );

    const mockJob = {
      name: 'register-document',
      id: 'job-123',
      data: { hash: '0xHashDePrueba' },
    } as unknown as Job<{ hash: string }, any, string>;

    await expect(processor.process(mockJob)).resolves.toEqual({
      txHash: '0xTransaccionExitosa',
    });

    expect(mockBlockchainService.registrarHash).toHaveBeenCalledWith(
      '0xHashDePrueba',
    );
    expect(mockDocumentsGateway.emitJobSuccess).toHaveBeenCalledWith(
      'job-123',
      '0xTransaccionExitosa',
    );
  });

  it('debe lanzar error si la transaccion falla para que BullMQ reintente', async () => {
    mockBlockchainService.registrarHash.mockRejectedValue(
      new Error('Fallo simulado en la red'),
    );

    const mockJob = {
      name: 'register-document',
      id: 'job-123',
      data: { hash: '0xHashDePrueba' },
    } as unknown as Job<{ hash: string }, any, string>;

    await expect(processor.process(mockJob)).rejects.toThrow(
      'Fallo simulado en la red',
    );

    expect(mockDocumentsGateway.emitJobFailed).toHaveBeenCalledWith(
      'job-123',
      'Fallo simulado en la red',
    );
  });

  it('debe lanzar error si el nombre del job no es soportado', async () => {
    const mockJob = {
      name: 'unknown-job',
      id: 'job-999',
      data: { hash: '' },
    } as unknown as Job<{ hash: string }, any, string>;

    await expect(processor.process(mockJob)).rejects.toThrow(
      'Job name no soportado: unknown-job',
    );
    expect(mockBlockchainService.registrarHash).not.toHaveBeenCalled();
    expect(mockDocumentsGateway.emitJobSuccess).not.toHaveBeenCalled();
    expect(mockDocumentsGateway.emitJobFailed).not.toHaveBeenCalled();
  });
});