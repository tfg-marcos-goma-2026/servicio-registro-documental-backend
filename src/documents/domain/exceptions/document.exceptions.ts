/**
 * @file document.exceptions.ts
 * @module documents/domain
 * @description Excepciones puras de dominio para el módulo de documentos.
 * Permiten a la capa de aplicación expresar errores de negocio sin
 * acoplarse a frameworks HTTP (como HttpException de NestJS).
 */

/** El hash proporcionado no cumple el formato bytes32 (0x + 64 hex). */
export class InvalidDocumentHashException extends Error {
  constructor(raw: string) {
    super(
      `El hash "${raw}" no es un bytes32 válido (0x + 64 caracteres hexadecimales).`,
    );
    this.name = 'InvalidDocumentHashException';
  }
}

/** El documento ya existe en el contrato inteligente. */
export class DuplicateDocumentException extends Error {
  constructor(hash: string) {
    super(`El documento con hash ${hash} ya está registrado en la blockchain.`);
    this.name = 'DuplicateDocumentException';
  }
}

/** El sistema está bajo carga extrema y no puede aceptar nuevas solicitudes. */
export class SystemOverloadedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SystemOverloadedException';
  }
}
