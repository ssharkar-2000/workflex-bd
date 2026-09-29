import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';

/**
 * Google Meet for video interviews.
 *
 * Exported so the interviews module can create, move and cancel meetings
 * without knowing anything about OAuth.
 */
@Module({
  controllers: [GoogleController],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
