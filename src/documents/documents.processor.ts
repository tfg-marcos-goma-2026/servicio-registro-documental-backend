import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BlockchainService } from '../blockchain/blockchain.service';

@Processor('blockchain-queue')
export class DocumentsProcessor extends WorkerHost {
  constructor(private readonly blockchainService: BlockchainService) {
    super();
  }

  async process(job: Job<{ hash: string }, any, string>): Promise<any> {
    switch (job.name) {
      case 'register-document': {
        console.log(
          `[Processor] Iniciando job ${job.id} para el hash: ${job.data.hash}`,
        );
        try {
          const txHash = await this.blockchainService.registrarHash(
            job.data.hash,
          );
          console.log(
            `[Processor] Job ${job.id} completado. TxHash: ${txHash}`,
          );
          return { txHash };
        } catch (error) {
          console.error(`[Processor] Error en job ${job.id}:`, error);
          throw error;
        }
      }
      default:
        throw new Error(`Job name no soportado: ${job.name}`);
    }
  }
}
