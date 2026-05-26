/**
 * @file register-document.service.ts
 * @module documents/application
 * @description Caso de uso para registrar un documento. Valida el formato del
 * hash en el dominio, implementa la lógica de backpressure y load shedding,
 * y orquesta los puertos de salida. Completamente aislado de NestJS HTTP
 * y de la infraestructura.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import * as blockchainPort from '../ports/out/blockchain.port';
import * as queuePort from '../ports/out/queue.port';
import { DocumentHash } from '../../domain/document-hash.value-object';
import {
  DuplicateDocumentException,
  SystemOverloadedException,
} from '../../domain/exceptions/document.exceptions';

export interface RegisterDocumentResult {
  success: boolean;
  /** pending: se notificará por WebSocket. deferred: se notificará por canal diferido. */
  status: 'deferred' | 'pending';
  message: string;
  hash: string;
  jobId: string;
}

@Injectable()
export class RegisterDocumentService {
  private readonly logger = new Logger(RegisterDocumentService.name);

  constructor(
    @Inject(blockchainPort.I_BLOCKCHAIN_PORT)
    private readonly blockchainPort: blockchainPort.IBlockchainPort,
    @Inject(queuePort.I_QUEUE_PORT)
    private readonly queuePort: queuePort.IQueuePort,
    @Inject('HIGH_LOAD_LIMIT') private readonly highLoadLimit: number,
    @Inject('EXTREME_LOAD_LIMIT') private readonly extremeLoadLimit: number,
  ) {}

  /**
   * Registra un documento en la blockchain de forma asíncrona mediante cola.
   *
   * Flujo:
   * 1. Valida el formato bytes32 del hash en el dominio (DocumentHash.create).
   * 2. Verifica en la blockchain que el hash no esté ya registrado.
   * 3. Comprueba el nivel de carga de la cola y aplica load-shedding si procede.
   * 4. Encola el job con política de reintentos (3 intentos, backoff exponencial).
   * 5. Devuelve el jobId para que el cliente pueda suscribirse por WebSocket.
   *
   * @param rawHash  - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @param userId   - Identificador del usuario que realiza el registro.
   * @returns Objeto con jobId y estado inicial del job.
   * @throws InvalidDocumentHashException si el formato del hash no es bytes32 válido.
   * @throws DuplicateDocumentException   si el documento ya está registrado.
   * @throws SystemOverloadedException    si la cola está en carga extrema.
   */
  async execute(
    rawHash: string,
    userId: string = 'user-tfg-123',
  ): Promise<RegisterDocumentResult> {
    const hash = DocumentHash.create(rawHash);

    const comprobacion = await this.blockchainPort.verificarHash(
      hash.toString(),
    );
    if (comprobacion.existe) {
      throw new DuplicateDocumentException(hash.toString());
    }

    const waitingCount = await this.queuePort.getWaitingCount();

    if (waitingCount >= this.extremeLoadLimit) {
      this.logger.warn(
        `Tráfico extremo bloqueado. Trabajos en cola: ${waitingCount}`,
      );
      throw new SystemOverloadedException(
        'Servicio temporalmente saturado. Inténtalo más tarde.',
      );
    }

    const isDeferred = waitingCount >= this.highLoadLimit;

    this.logger.log(
      `Encolando registro (${isDeferred ? 'DIFERIDO' : 'NORMAL'}): ${hash.toString()}`,
    );

    const job = await this.queuePort.addRegisterJob(
      hash.toString(),
      isDeferred,
      userId,
    );

    return {
      success: true,
      status: isDeferred ? 'deferred' : 'pending',
      message: isDeferred
        ? 'Alta demanda: Documento encolado. Se le notificará asíncronamente.'
        : 'Documento encolado para registro en tiempo real',
      hash: hash.toString(),
      jobId: job.jobId,
    };
  }
}
