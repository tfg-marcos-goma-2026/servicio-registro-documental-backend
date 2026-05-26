/**
 * @file queue.port.ts
 * @module documents/application
 * @description Puerto de salida para la gestión de colas asíncronas.
 * Desacopla la lógica de negocio de la tecnología subyacente
 */

export const I_QUEUE_PORT = Symbol('I_QUEUE_PORT');

export interface EnqueuedJobResult {
  jobId: string;
}

export interface IQueuePort {
  getWaitingCount(): Promise<number>;
  addRegisterJob(
    hash: string,
    deferred: boolean,
    userId: string,
  ): Promise<EnqueuedJobResult>;
}
