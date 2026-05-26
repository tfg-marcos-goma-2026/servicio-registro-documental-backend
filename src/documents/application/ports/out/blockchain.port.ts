/**
 * @file blockchain.port.ts
 * @module documents/application
 * @description Puerto de salida que define el contrato para
 * interactuar con la red blockchain. Aisla los casos de uso de la librería
 * concreta o de los detalles de red.
 */

export const I_BLOCKCHAIN_PORT = Symbol('I_BLOCKCHAIN_PORT');

export interface DocumentVerificationData {
  existe: boolean;
  emisor: string;
  timestamp: number;
}

export interface IBlockchainPort {
  registrarHash(hash: string): Promise<string>;
  verificarHash(hash: string): Promise<DocumentVerificationData>;
}
