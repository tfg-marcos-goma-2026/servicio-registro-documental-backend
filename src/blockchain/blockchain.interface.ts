/**
 * @file blockchain.interface.ts
 * @module blockchain
 * @description Token de inyección e interfaz del servicio de blockchain.
 *   Define el contrato que deben cumplir tanto la implementación real
 *   (BlockchainService) como la de pruebas (MockBlockchainService),
 *   permitiendo intercambiarlas sin modificar los consumidores.
 */

/** Token de inyección de dependencias para el servicio de blockchain. */
export const BLOCKCHAIN_SERVICE = 'BLOCKCHAIN_SERVICE';

/**
 * Contrato que expone las dos operaciones sobre el contrato inteligente:
 * escritura (registrar) y lectura (verificar).
 */
export interface IBlockchainService {
  /**
   * Registra el hash de un documento en el contrato inteligente.
   * @param hash - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @returns Hash de la transacción confirmada en la blockchain.
   */
  registrarHash(hash: string): Promise<string>;

  /**
   * Consulta si un hash ya existe en el contrato inteligente.
   * @param hash - Hash bytes32 del documento en formato hexadecimal (0x...).
   * @returns Objeto con `existe`, la dirección del `emisor` y el `timestamp`
   *   Unix (en segundos) del momento del registro.
   */
  verificarHash(hash: string): Promise<{
    existe: boolean;
    emisor: string;
    timestamp: number;
  }>;
}
