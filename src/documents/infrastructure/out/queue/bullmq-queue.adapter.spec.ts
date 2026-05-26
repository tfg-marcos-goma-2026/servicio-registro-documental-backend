/**
 * @file bullmq-queue.adapter.spec.ts
 * @module documents/infrastructure
 * @description Test unitario del adaptador de cola BullMQ. Verifica que
 * los métodos del puerto IQueuePort se traducen correctamente a llamadas
 * a la API de BullMQ.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BullMqQueueAdapter } from './bullmq-queue.adapter';
import { getQueueToken } from '@nestjs/bullmq';

describe('BullMqQueueAdapter', () => {
  let adapter: BullMqQueueAdapter;

  const mockQueue = {
    getWaitingCount: jest.fn(),
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullMqQueueAdapter,
        {
          provide: getQueueToken('blockchain-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    adapter = module.get(BullMqQueueAdapter);
  });

  describe('getWaitingCount', () => {
    it('debe delegar en queue.getWaitingCount', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(42);

      const count = await adapter.getWaitingCount();

      expect(count).toBe(42);
      expect(mockQueue.getWaitingCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('addRegisterJob', () => {
    it('debe añadir el job con la política de reintentos y devolver el jobId', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-abc' });

      const result = await adapter.addRegisterJob('0xhash', false, 'user-1');

      expect(result).toEqual({ jobId: 'job-abc' });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'register-document',
        { hash: '0xhash', deferred: false, userId: 'user-1' },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    });

    it('debe lanzar error si BullMQ no devuelve un id', async () => {
      mockQueue.add.mockResolvedValue({ id: undefined });

      await expect(
        adapter.addRegisterJob('0xhash', false, 'user-1'),
      ).rejects.toThrow('BullMQ no devolvió un ID para el job');
    });
  });
});
