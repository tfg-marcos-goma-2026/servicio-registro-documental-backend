import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { VaultModule } from '../vault/vault.module';

@Module({
  imports: [VaultModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
