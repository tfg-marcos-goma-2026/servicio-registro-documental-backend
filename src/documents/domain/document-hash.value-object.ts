/**
 * @file document-hash.value-object.ts
 * @module documents/domain
 * @description Objeto de valor que representa el hash SHA-256 de un documento
 * en formato bytes32. Encapsula la regla de negocio del formato válido y
 * garantiza que ningún hash malformado pueda circular por la capa de
 * aplicación o infraestructura.
 *
 * Al ser inmutable y auto-validante, cualquier instancia existente de
 * DocumentHash es por definición un hash válido — no hace falta volver a
 * comprobarlo en los casos de uso ni en los adaptadores.
 */

import { InvalidDocumentHashException } from './exceptions/document.exceptions';

export class DocumentHash {
  private static readonly BYTES32_REGEX = /^0x[a-fA-F0-9]{64}$/;

  private constructor(private readonly value: string) {}

  /**
   * Crea un DocumentHash validado a partir de una cadena hexadecimal.
   * @param raw - Cadena en formato 0x + 64 caracteres hexadecimales.
   * @throws InvalidDocumentHashException si el formato no es bytes32 válido.
   */
  static create(raw: string): DocumentHash {
    if (!DocumentHash.BYTES32_REGEX.test(raw)) {
      throw new InvalidDocumentHashException(raw);
    }
    return new DocumentHash(raw);
  }

  /** Devuelve el valor primitivo para pasarlo a adaptadores de infraestructura. */
  toString(): string {
    return this.value;
  }

  /** Comprueba igualdad estructural entre dos hashes. */
  equals(other: DocumentHash): boolean {
    return this.value === other.value;
  }
}
