import { Module } from '@nestjs/common';
import { VaultService } from './vault.service';
import { SecretManager } from './secret-manager.interface';

@Module({
  providers: [
    {
      provide: SecretManager,
      useClass: VaultService,
    },
  ],
  exports: [SecretManager],
})
export class VaultModule {}
