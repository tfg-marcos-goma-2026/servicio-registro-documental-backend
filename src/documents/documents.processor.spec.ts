import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsProcessor } from './documents.processor';
import { NotificationsService } from '../notifications/notifications.service';
import { Job } from 'bullmq';
import * as blockchainInterface from '../blockchain/blockchain.interface';
import { NotificationPayload } from '../notifications/notification-strategy.interface';

interface RegisterJobData {
  hash: string;
  deferred: boolean;
  userId: string;
}

describe('DocumentsProcessor', () => {
  let processor: DocumentsProcessor;

  const mockBlockchainService = {
    registrarHash: jest.fn(),
  };

  const mockNotificationsService = {
    enviarNotificacion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsProcessor,
        {
          provide: blockchainInterface.BLOCKCHAIN_SERVICE,
          useValue: mockBlockchainService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    processor = module.get<DocumentsProcessor>(DocumentsProcessor);
  });

  const createMockJob = (
    hash: string,
    deferred: boolean,
  ): Job<RegisterJobData, unknown, string> =>
    ({
      name: 'register-document',
      id: 'job-123',
      data: { hash, deferred, userId: 'user-1' },
    }) as unknown as Job<RegisterJobData, unknown, string>;

  it('debe procesar un job NORMAL y delegar notificación con deferred=false', async () => {
    mockBlockchainService.registrarHash.mockResolvedValue('0xTxExito');
    const job = createMockJob('0xHash', false);

    await expect(processor.process(job)).resolves.toEqual({
      txHash: '0xTxExito',
    });

    expect(mockNotificationsService.enviarNotificacion).toHaveBeenCalledWith(
      expect.objectContaining<Partial<NotificationPayload>>({
        userId: 'user-1',
        jobId: 'job-123',
        txHash: '0xTxExito',
        status: 'completed',
      }),
      false,
    );
  });

  it('debe procesar un job DIFERIDO y delegar notificación con deferred=true', async () => {
    mockBlockchainService.registrarHash.mockResolvedValue('0xTxExito');
    const job = createMockJob('0xHash', true);

    await expect(processor.process(job)).resolves.toEqual({
      txHash: '0xTxExito',
    });

    expect(mockNotificationsService.enviarNotificacion).toHaveBeenCalledWith(
      expect.objectContaining<Partial<NotificationPayload>>({
        userId: 'user-1',
        jobId: 'job-123',
        txHash: '0xTxExito',
        status: 'completed',
      }),
      true,
    );
  });

  it('debe notificar fallo y relanzar error si falla la blockchain (Job NORMAL)', async () => {
    mockBlockchainService.registrarHash.mockRejectedValue(
      new Error('Fallo simulado'),
    );
    const job = createMockJob('0xHash', false);

    await expect(processor.process(job)).rejects.toThrow('Fallo simulado');

    expect(mockNotificationsService.enviarNotificacion).toHaveBeenCalledWith(
      expect.objectContaining<Partial<NotificationPayload>>({
        userId: 'user-1',
        jobId: 'job-123',
        status: 'failed',
        error: 'Error en la red blockchain',
      }),
      false,
    );
  });

  it('debe gestionar DUPLICATE_HASH silenciosamente sin reintentos (Job NORMAL)', async () => {
    mockBlockchainService.registrarHash.mockRejectedValue(
      new Error('DUPLICATE_HASH'),
    );
    const job = createMockJob('0xHash', false);

    await expect(processor.process(job)).resolves.toEqual({
      error: 'El documento ya fue registrado previamente',
    });

    expect(mockNotificationsService.enviarNotificacion).toHaveBeenCalledWith(
      expect.objectContaining<Partial<NotificationPayload>>({
        status: 'failed',
        error: 'El documento ya fue registrado previamente',
      }),
      false,
    );
  });

  it('debe gestionar DUPLICATE_HASH notificando al usuario (Job DIFERIDO)', async () => {
    mockBlockchainService.registrarHash.mockRejectedValue(
      new Error('DUPLICATE_HASH'),
    );
    const job = createMockJob('0xHash', true);

    await expect(processor.process(job)).resolves.toEqual({
      error: 'El documento ya fue registrado previamente',
    });

    expect(mockNotificationsService.enviarNotificacion).toHaveBeenCalledWith(
      expect.objectContaining<Partial<NotificationPayload>>({
        status: 'failed',
        error: 'El documento ya fue registrado previamente',
      }),
      true,
    );
  });

  it('debe lanzar error si el nombre del job no es soportado', async () => {
    const job = {
      name: 'unknown-job',
      id: 'job-999',
      data: {},
    } as unknown as Job<RegisterJobData, unknown, string>;

    await expect(processor.process(job)).rejects.toThrow(
      'Job name no soportado: unknown-job',
    );
  });
});
