/**
 * @file verify-document.service.ts
 * @module documents/application
 * @description Caso de uso para verificar si un documento está registrado en
 * la blockchain. Valida el formato del hash en el dominio, orquesta la
 * consulta al puerto de salida y delega el formateo de la respuesta en la
 * entidad Document, manteniendo ese conocimiento fuera de la infraestructura.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import * as blockchainPort from '../ports/out/blockchain.port';
import { DocumentHash } from '../../domain/document-hash.value-object';
import { Document } from '../../domain/document.entity';

export interface VerifyDocumentResult {
  success: boolean;
  isVerified: boolean;
  hash: string;
  error?: string;
  /** Fecha y hora del registro formateada en locale es-ES. */
  timestamp?: string;
  issuer?: string;
}

@Injectable()
export class VerifyDocumentService {
  private readonly logger = new Logger(VerifyDocumentService.name);

  constructor(
    @Inject(blockchainPort.I_BLOCKCHAIN_PORT)
    private readonly blockchainPort: blockchainPort.IBlockchainPort,
  ) {}

  /**
   * Consulta el contrato inteligente para comprobar si un documento está
   * registrado, devolviendo el emisor y la marca de tiempo si existe.
   *
   * Flujo:
   * 1. Valida el formato bytes32 del hash en el dominio (DocumentHash.create).
   * 2. Consulta el puerto de blockchain.
   * 3. Si existe, reconstruye la entidad Document y delega el formateo.
   *
   * @param rawHash - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @returns Objeto VerifyDocumentResult con el resultado de la verificación.
   * @throws InvalidDocumentHashException si el formato del hash no es bytes32 válido.
   */
  async execute(rawHash: string): Promise<VerifyDocumentResult> {
    // La validación de formato ocurre en el dominio antes de cualquier llamada de red.
    const hash = DocumentHash.create(rawHash);

    this.logger.log(`Verificando en blockchain: ${hash.toString()}`);

    const data = await this.blockchainPort.verificarHash(hash.toString());

    if (!data.existe) {
      return {
        success: false,
        isVerified: false,
        hash: rawHash,
        error: 'El documento no consta en el registro',
      };
    }

    const document = Document.fromBlockchain(hash, data.emisor, data.timestamp);

    return {
      success: true,
      isVerified: true,
      hash: rawHash,
      timestamp: document.formatTimestamp(),
      issuer: document.emisor,
    };
  }
}
