/**
 * @file bullmq-queue.adapter.ts
 * @module documents/infrastructure
 * @description Adaptador de infraestructura para la gestión de colas usando
 * BullMQ. Implementa el IQueuePort definido en la capa de aplicación.
 */

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  IQueuePort,
  EnqueuedJobResult,
} from '../../../application/ports/out/queue.port';

@Injectable()
export class BullMqQueueAdapter implements IQueuePort {
  constructor(@InjectQueue('blockchain-queue') private readonly queue: Queue) {}

  async getWaitingCount(): Promise<number> {
    return this.queue.getWaitingCount();
  }

  async addRegisterJob(
    hash: string,
    deferred: boolean,
    userId: string,
  ): Promise<EnqueuedJobResult> {
    const job = await this.queue.add(
      'register-document',
      { hash, deferred, userId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    if (!job.id) throw new Error('BullMQ no devolvió un ID para el job');

    return { jobId: job.id };
  }
}
