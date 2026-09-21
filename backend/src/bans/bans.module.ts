import { Module } from '@nestjs/common';
import { BansController } from './bans.controller';
import { BansCronService } from './bans.cron';
import { BansService } from './bans.service';

@Module({
  controllers: [BansController],
  providers: [BansService, BansCronService],
  exports: [BansService],
})
export class BansModule {}
