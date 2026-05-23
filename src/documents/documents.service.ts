/**
 * @file documents.service.ts
 * @module documents
 * @description Servicio de negocio del módulo de documentos. Implementa la
 *   lógica de registro y verificación de documentos aplicando dos mecanismos
 *   de protección ante alta carga:
 *
 *   - HIGH_LOAD:    cuando la cola supera este umbral, el job se marca como
 *                   "deferred" y el usuario recibe una notificación asíncrona
 *                   en lugar de una respuesta por WebSocket.
 *   - EXTREME_LOAD: cuando la cola supera este umbral, la petición se rechaza
 *                   con 503 para proteger los recursos del Secret Manager y blockchain.
 *
 * Variables de entorno relevantes:
 *   - QUEUE_HIGH_LOAD_LIMIT    Umbral de carga alta.
 *   - QUEUE_EXTREME_LOAD_LIMIT Umbral de carga extrema.
 */

import {
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import * as blockchainInterface from '../blockchain/blockchain.interface';

/** Respuesta devuelta por registerDocument al cliente HTTP. */
export interface RegisterResult {
  success: boolean;
  /** pending: se notificará por WebSocket. deferred: se notificará por email/log. */
  status: 'deferred' | 'pending';
  message: string;
  hash: string;
  jobId: string | undefined;
}

/** Respuesta devuelta por verifyDocument al cliente HTTP. */
export interface VerifyResult {
  success: boolean;
  isVerified: boolean;
  hash: string;
  error?: string;
  /** Fecha y hora del registro formateada en locale es-ES. */
  timestamp?: string;
  issuer?: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly HIGH_LOAD_LIMIT: number;
  private readonly EXTREME_LOAD_LIMIT: number;

  constructor(
    @InjectQueue('blockchain-queue') private blockchainQueue: Queue,
    @Inject(blockchainInterface.BLOCKCHAIN_SERVICE)
    private blockchainService: blockchainInterface.IBlockchainService,
    private configService: ConfigService,
  ) {
    this.HIGH_LOAD_LIMIT = this.configService.get<number>(
      'QUEUE_HIGH_LOAD_LIMIT',
      50,
    );
    this.EXTREME_LOAD_LIMIT = this.configService.get<number>(
      'QUEUE_EXTREME_LOAD_LIMIT',
      100,
    );
  }

  /**
   * Registra un documento en la blockchain de forma asíncrona mediante cola.
   *
   * Flujo:
   *   1. Verifica en la blockchain que el hash no esté ya registrado (409 si lo está).
   *   2. Comprueba el nivel de carga de la cola y aplica load-shedding si procede.
   *   3. Encola el job con política de reintentos (3 intentos, backoff exponencial).
   *   4. Devuelve 202 con el jobId para que el cliente pueda suscribirse por WebSocket.
   *
   * @param hash - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @returns Objeto RegisterResult con jobId y estado inicial del job.
   * @throws ConflictException (409) si el documento ya está registrado.
   * @throws ServiceUnavailableException (503) si la cola está en carga extrema.
   * @throws InternalServerErrorException (500) si falla el encolado.
   */
  async registerDocument(hash: string): Promise<RegisterResult> {
    const comprobacion = await this.blockchainService.verificarHash(hash);
    if (comprobacion.existe) {
      throw new ConflictException(
        'El documento ya está registrado en la blockchain',
      );
    }

    const waitingCount = await this.blockchainQueue.getWaitingCount();

    if (waitingCount >= this.EXTREME_LOAD_LIMIT) {
      this.logger.warn(
        `Tráfico extremo bloqueado. Trabajos en cola: ${waitingCount}`,
      );
      throw new ServiceUnavailableException(
        'Servicio temporalmente saturado. Inténtalo más tarde.',
      );
    }

    const isDeferred = waitingCount >= this.HIGH_LOAD_LIMIT;
    const mockUserId = 'user-tfg-123';

    this.logger.log(
      `Encolando registro (${isDeferred ? 'DIFERIDO' : 'NORMAL'}): ${hash}`,
    );

    try {
      const job = await this.blockchainQueue.add(
        'register-document',
        { hash, deferred: isDeferred, userId: mockUserId },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );

      return {
        success: true,
        status: isDeferred ? 'deferred' : 'pending',
        message: isDeferred
          ? 'Alta demanda: Documento encolado. Se le notificará asíncronamente.'
          : 'Documento encolado para registro en tiempo real',
        hash,
        jobId: job.id,
      };
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Error al procesar la solicitud de registro',
      );
    }
  }

  /**
   * Consulta el contrato inteligente para comprobar si un documento está
   * registrado, devolviendo el emisor y la marca de tiempo si existe.
   *
   * @param hash - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @returns Objeto VerifyResult con el resultado de la verificación.
   * @throws InternalServerErrorException (500) si falla la consulta al contrato.
   */
  async verifyDocument(hash: string): Promise<VerifyResult> {
    this.logger.log(`Verificando en blockchain: ${hash}`);

    try {
      const data = await this.blockchainService.verificarHash(hash);

      if (!data.existe) {
        return {
          success: false,
          isVerified: false,
          hash,
          error: 'El documento no consta en el registro',
        };
      }

      return {
        success: true,
        isVerified: true,
        hash,
        timestamp: new Date(data.timestamp * 1000).toLocaleString('es-ES'),
        issuer: data.emisor,
      };
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException(
        'Error al consultar el contrato inteligente',
      );
    }
  }
}
