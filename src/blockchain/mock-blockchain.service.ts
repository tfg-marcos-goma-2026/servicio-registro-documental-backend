/**
 * @file mock-blockchain.service.ts
 * @module blockchain
 * @description Implementación simulada de IBlockchainService para entornos de
 *   desarrollo y pruebas de carga. Sustituye las llamadas reales a Vault y a
 *   la blockchain por retardos configurables, lo que permite reproducir las
 *   latencias de producción sin necesidad de infraestructura real.
 *
 * Variables de entorno relevantes:
 *   - VAULT_MOCK_LATENCY_MS      (por defecto: 200 ms)
 *   - BLOCKCHAIN_MOCK_LATENCY_MS (por defecto: 3000 ms)
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IBlockchainService } from './blockchain.interface';

@Injectable()
export class MockBlockchainService implements IBlockchainService, OnModuleInit {
  private readonly vaultLatencyMs: number;
  private readonly blockchainLatencyMs: number;
  private readonly totalLatencyMs: number;

  constructor(private readonly configService: ConfigService) {
    this.vaultLatencyMs = Number(
      this.configService.get<number>('VAULT_MOCK_LATENCY_MS', 200),
    );
    this.blockchainLatencyMs = Number(
      this.configService.get<number>('BLOCKCHAIN_MOCK_LATENCY_MS', 3000),
    );
    this.totalLatencyMs = this.vaultLatencyMs + this.blockchainLatencyMs;
  }

  /**
   * Imprime al arrancar las latencias configuradas y el throughput estimado
   * por worker, junto con los valores sugeridos de HIGH_LOAD y EXTREME_LOAD
   * para que el operador pueda ajustar el .env antes de lanzar pruebas.
   */
  onModuleInit() {
    const throughput = (1000 / this.totalLatencyMs).toFixed(3);
    console.warn(
      `[MockBlockchainService] MODO MOCK ACTIVO\n` +
        `  Vault latency:       ${this.vaultLatencyMs}ms\n` +
        `  Blockchain latency:  ${this.blockchainLatencyMs}ms\n` +
        `  Total por job:       ${this.totalLatencyMs}ms\n` +
        `  Throughput worker:   ${throughput} jobs/s\n` +
        `  HIGH_LOAD óptimo  (espera ≤30s):  ${Math.ceil(30 * parseFloat(throughput))} jobs\n` +
        `  EXTREME_LOAD óptimo (espera ≤2min): ${Math.ceil(120 * parseFloat(throughput))} jobs`,
    );
  }

  /**
   * Simula el flujo completo de registro: obtención del secreto desde Vault
   * (primer retardo) y confirmación de la transacción en blockchain (segundo
   * retardo). Devuelve un txHash hexadecimal aleatorio de 32 bytes.
   *
   * @param _hash - Hash del documento (no usado en la simulación).
   * @returns txHash simulado en formato 0x + 64 caracteres hexadecimales.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async registrarHash(_hash?: string): Promise<string> {
    await new Promise((r) => setTimeout(r, this.vaultLatencyMs));
    console.log(
      `[MockBlockchainService] Secreto obtenido (simulado). Enviando a blockchain...`,
    );

    await new Promise((r) => setTimeout(r, this.blockchainLatencyMs));

    const txHash =
      '0x' +
      Array.from(
        { length: 64 },
        () => '0123456789abcdef'[Math.floor(Math.random() * 16)],
      ).join('');

    console.log(`[MockBlockchainService] TxHash (mock): ${txHash}`);
    return txHash;
  }

  /**
   * Simula una verificación devolviendo siempre "no registrado".
   * En el mock no se mantiene estado, por lo que todo hash se considera nuevo.
   *
   * @param _hash - Hash del documento (no usado en la simulación).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verificarHash(_hash?: string): Promise<{
    existe: boolean;
    emisor: string;
    timestamp: number;
  }> {
    return Promise.resolve({
      existe: false,
      emisor: '0x000...000',
      timestamp: 0,
    });
  }
}
