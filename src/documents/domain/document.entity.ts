/**
 * @file document.entity.ts
 * @module documents/domain
 * @description Entidad raíz del contexto de documentos. Representa un
 * documento registrado en la blockchain con su hash, el emisor que lo firmó
 * y la marca de tiempo del registro.
 *
 * En este sistema el documento no se almacena localmente. Esta entidad se usa para
 * transportar y operar sobre los datos verificados que devuelve la blockchain, sin
 * acoplar esa lógica a ningún detalle de infraestructura.
 */

import { DocumentHash } from './document-hash.value-object';

export class Document {
  private constructor(
    readonly hash: DocumentHash,
    readonly emisor: string,
    readonly registradoEn: Date,
  ) {}

  /**
   * Reconstruye una entidad Document a partir de los datos devueltos por
   * la blockchain. Usado por VerifyDocumentService al confirmar un registro.
   *
   * @param hash        - Hash bytes32 del documento ya validado.
   * @param emisor      - Dirección Ethereum del firmante.
   * @param timestampSeg - Timestamp Unix en segundos devuelto por el contrato.
   */
  static fromBlockchain(
    hash: DocumentHash,
    emisor: string,
    timestampSeg: number,
  ): Document {
    return new Document(hash, emisor, new Date(timestampSeg * 1000));
  }

  /**
   * Devuelve la fecha de registro formateada según el locale indicado.
   * Centraliza el formateo de fechas en el dominio, fuera de los adaptadores.
   *
   * @param locale - Locale BCP-47, por defecto 'es-ES'.
   */
  formatTimestamp(locale = 'es-ES'): string {
    return this.registradoEn.toLocaleString(locale);
  }
}
