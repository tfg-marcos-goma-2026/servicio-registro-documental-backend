import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DocumentsProcessor } from './documents.processor';

@Module({
  imports: [
    BlockchainModule,
    BullModule.registerQueue({
      name: 'blockchain-queue',
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsProcessor],
})
export class DocumentsModule {}
