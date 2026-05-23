/**
 * @file documents.processor.ts
 * @module documents
 * @description Procesador de la cola "blockchain-queue". Consume los jobs
 *   encolados por DocumentsService y ejecuta el registro en la blockchain.
 *   La concurrencia se controla mediante la variable de entorno
 *   WORKER_CONCURRENCY.
 *
 *   Estrategia de notificación según el modo del job:
 *     - NORMAL   (deferred=false): notificación en tiempo real por WebSocket.
 *     - DIFERIDO (deferred=true):  notificación asíncrona por el canal
 *                                  configurado en NotificationsService.
 *
 *   Gestión de errores:
 *     - DUPLICATE_HASH: el job se considera completado (no se reintenta)
 *       porque el documento ya estaba registrado antes de entrar en cola.
 *     - Cualquier otro error: se relanza para que BullMQ aplique la política
 *       de reintentos con backoff exponencial (3 intentos, 5 s de base).
 *
 * Variables de entorno relevantes:
 *   - WORKER_CONCURRENCY  Número de jobs procesados en paralelo (defecto: 5).
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import * as blockchainInterface from '../blockchain/blockchain.interface';
import { NotificationsService } from '../notifications/notifications.service';

/** Datos que viajan dentro de cada job de registro. */
export interface RegisterJobData {
  hash: string;
  /** true cuando el job fue encolado bajo alta demanda (modo diferido). */
  deferred: boolean;
  userId: string;
}

/** Resultado que devuelve el procesador al completar un job. */
type JobResult = { txHash: string } | { error: string };

@Processor('blockchain-queue', {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
})
export class DocumentsProcessor extends WorkerHost {
  constructor(
    @Inject(blockchainInterface.BLOCKCHAIN_SERVICE)
    private readonly blockchainService: blockchainInterface.IBlockchainService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  /**
   * Punto de entrada de BullMQ. Enruta cada job a su manejador según el nombre.
   * @param job - Job recibido de la cola.
   * @throws Error si el nombre del job no está soportado.
   */
  async process(job: Job<RegisterJobData, unknown, string>): Promise<unknown> {
    switch (job.name) {
      case 'register-document':
        return this.handleRegisterDocument(job as Job<RegisterJobData>);
      default:
        throw new Error(`Job name no soportado: ${job.name}`);
    }
  }

  /**
   * Ejecuta el registro en blockchain y notifica el resultado delegando
   * completamente en NotificationsService la elección del canal.
   *
   * @param job - Job con hash, modo deferred e identificador de usuario.
   * @returns { txHash } en caso de éxito, { error } si era un duplicado.
   * @throws El error original para cualquier fallo reintentable.
   */
  private async handleRegisterDocument(
    job: Job<RegisterJobData>,
  ): Promise<JobResult> {
    const jobId = job.id!;
    const { hash, deferred, userId } = job.data;

    console.log(`[Processor] Iniciando job ${jobId} para el hash: ${hash}`);

    try {
      const txHash = await this.blockchainService.registrarHash(hash);
      console.log(`[Processor] Job ${jobId} completado. TxHash: ${txHash}`);

      await this.notificationsService.enviarNotificacion(
        {
          userId,
          title: 'Registro Documental Completado',
          message: `Su documento con huella ${hash.slice(0, 10)}... ha sido registrado.\nTxHash: ${txHash}`,
          jobId,
          txHash,
          status: 'completed',
        },
        deferred,
      );

      return { txHash };
    } catch (error: unknown) {
      const finalErrorMsg = this.resolveErrorMessage(error);
      console.error(`[Processor] Error en job ${jobId}: ${finalErrorMsg}`);

      await this.notificationsService.enviarNotificacion(
        {
          userId,
          title: 'Fallo en Registro Documental',
          message: `No se pudo registrar su documento (${hash.slice(0, 10)}...). Motivo: ${finalErrorMsg}`,
          jobId,
          error: finalErrorMsg,
          status: 'failed',
        },
        deferred,
      );

      if (finalErrorMsg === 'El documento ya fue registrado previamente') {
        return { error: finalErrorMsg };
      }
      throw error;
    }
  }

  /**
   * Traduce los códigos de error internos a mensajes legibles para el usuario.
   * @param error - Error capturado en el bloque catch.
   * @returns Mensaje en lenguaje natural.
   */
  private resolveErrorMessage(error: unknown): string {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    return message === 'DUPLICATE_HASH'
      ? 'El documento ya fue registrado previamente'
      : 'Error en la red blockchain';
  }
}
