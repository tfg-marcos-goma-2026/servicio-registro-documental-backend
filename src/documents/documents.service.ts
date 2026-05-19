import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class DocumentsService {
  constructor(private blockchainService: BlockchainService) {}

  async registerDocument(hash: string) {
    try {
      console.log(`[Backend] Registrando en blockchain: ${hash}`);
      const txHash = await this.blockchainService.registrarHash(hash);

      return {
        success: true,
        hash: hash,
        transactionHash: txHash,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error al registrar el documento en la blockchain',
      );
    }
  }

  async verifyDocument(hash: string) {
    try {
      console.log(`[Backend] Verificando en blockchain: ${hash}`);
      const data = await this.blockchainService.verificarHash(hash);

      if (!data.existe) {
        return {
          success: false,
          isVerified: false,
          hash: hash,
          error: 'El documento no consta en el registro',
        };
      }

      return {
        success: true,
        isVerified: true,
        hash: hash,
        timestamp: new Date(data.timestamp * 1000).toLocaleString('es-ES'),
        issuer: data.emisor,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error al consultar el contrato inteligente',
      );
    }
  }
}
