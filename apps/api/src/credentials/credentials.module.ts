import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { IssuingService } from './issuing.service';

/**
 * TrustChain: signed credentials and the ledger they sit in.
 *
 * IssuingService is exported rather than routed. Filing a credential is an
 * institution's action, not an app user's, and the endpoint it will need
 * belongs behind whatever authentication institutions are given — not behind
 * the bearer token a worker's phone holds.
 */
@Module({
  controllers: [CredentialsController],
  providers: [CredentialsService, IssuingService],
  exports: [CredentialsService, IssuingService],
})
export class CredentialsModule {}
