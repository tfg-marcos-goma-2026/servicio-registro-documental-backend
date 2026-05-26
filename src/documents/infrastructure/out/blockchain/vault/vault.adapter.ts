/**
 * @file vault.adapter.ts
 * @module documents/infrastructure
 * @description Adaptador de salida que implementa SecretManagerPort
 * comunicándose con HashiCorp Vault mediante su API HTTP.
 *
 * Variables de entorno requeridas:
 * - VAULT_ENDPOINT  URL base del servidor Vault.
 * - VAULT_TOKEN     Token de autenticación con permisos de lectura.
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretManagerPort } from './secret-manager.port';

interface VaultResponse {
  data: { data: { privateKey: string } };
}

@Injectable()
export class VaultAdapter implements SecretManagerPort {
  constructor(private readonly configService: ConfigService) {}

  async getPrivateKey(): Promise<string> {
    const vaultEndpoint = this.configService.get<string>('VAULT_ENDPOINT');
    const vaultToken = this.configService.get<string>('VAULT_TOKEN');

    try {
      const response = await fetch(
        `${vaultEndpoint}/v1/secret/data/blockchain`,
        { headers: { 'X-Vault-Token': vaultToken! } },
      );

      if (!response.ok) {
        throw new Error('No se pudo autorizar la extracción del secreto');
      }

      const json = (await response.json()) as VaultResponse;
      return json.data.data.privateKey;
    } catch (error) {
      console.error('[VaultAdapter] Error crítico:', error);
      throw new InternalServerErrorException(
        'Error de comunicación con HashiCorp Vault',
      );
    }
  }
}
