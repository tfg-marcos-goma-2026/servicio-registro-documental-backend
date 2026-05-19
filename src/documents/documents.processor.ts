import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BlockchainService } from '../blockchain/blockchain.service';
import { DocumentsGateway } from './documents.gateway';

@Processor('blockchain-queue')
export class DocumentsProcessor extends WorkerHost {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly documentsGateway: DocumentsGateway,
  ) {
    super();
  }

  async process(job: Job<{ hash: string }, any, string>): Promise<any> {
    const jobId = job.id!;
    switch (job.name) {
      case 'register-document': {
        console.log(
          `[Processor] Iniciando job ${jobId} para el hash: ${job.data.hash}`,
        );
        try {
          const txHash = await this.blockchainService.registrarHash(
            job.data.hash,
          );
          console.log(`[Processor] Job ${jobId} completado. TxHash: ${txHash}`);

          this.documentsGateway.emitJobSuccess(jobId, txHash);
          return { txHash };
        } catch (error) {
          console.error(`[Processor] Error en job ${jobId}:`, error);

          const errorMessage =
            error instanceof Error ? error.message : 'Error en blockchain';

          this.documentsGateway.emitJobFailed(jobId, errorMessage);
          throw error;
        }
      }
      default:
        throw new Error(`Job name no soportado: ${job.name}`);
    }
  }
}
