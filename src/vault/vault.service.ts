import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretManager } from './secret-manager.interface';
interface VaultResponse {
  data: {
    data: {
      privateKey: string;
    };
  };
}

@Injectable()
export class VaultService implements SecretManager {
  constructor(private configService: ConfigService) {}

  async getPrivateKey(): Promise<string> {
    const vaultEndpoint = this.configService.get<string>('VAULT_ENDPOINT');
    const vaultToken = this.configService.get<string>('VAULT_TOKEN');

    try {
      const response = await fetch(
        `${vaultEndpoint}/v1/secret/data/blockchain`,
        {
          headers: {
            'X-Vault-Token': vaultToken!,
          },
        },
      );

      if (!response.ok) {
        throw new Error('No se pudo autorizar la extracción del secreto');
      }

      const json = (await response.json()) as VaultResponse;
      return json.data.data.privateKey;
    } catch (error) {
      console.error('[VaultService] Error crítico:', error);
      throw new InternalServerErrorException(
        'Error de comunicación con HashiCorp Vault',
      );
    }
  }
}
