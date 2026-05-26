/**
 * @file secret-manager.port.ts
 * @module documents/infrastructure
 * @description Puerto interno del adaptador de blockchain para la obtención
 * de secretos criptográficos. Abstrae el proveedor concreto de BlockchainService,
 * permitiendo sustituirlo sin modificar la lógica de firma de transacciones.
 */

export abstract class SecretManagerPort {
  abstract getPrivateKey(): Promise<string>;
}
