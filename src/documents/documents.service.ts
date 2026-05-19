import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectQueue('blockchain-queue') private blockchainQueue: Queue,
    private blockchainService: BlockchainService,
  ) {}

  async registerDocument(hash: string) {
    try {
      console.log(`[Backend] Encolando registro en blockchain para: ${hash}`);

      const job = await this.blockchainQueue.add(
        'register-document',
        { hash },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      return {
        success: true,
        status: 'pending',
        message: 'Documento encolado para registro en blockchain',
        hash: hash,
        jobId: job.id,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Error al encolar el documento para su registro',
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
