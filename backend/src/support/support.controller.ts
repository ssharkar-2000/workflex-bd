import { Body, Controller, Post } from '@nestjs/common';
import { SendSupportMessageDto } from './dto/support.dto';
import { SupportService } from './support.service';

/**
 * Item 9 — the endpoint the Help screen posts to.
 *
 * Deliberately not behind JwtAuthGuard: the guard protects *admin* sessions,
 * and this is the user-facing side of support. The caller identifies the user
 * by passing `workerId`/`employerId`; a message with neither still opens a
 * ticket as a guest rather than being refused, because someone who can't sign
 * in is exactly the person who most needs to reach support.
 */
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('messages')
  send(@Body() dto: SendSupportMessageDto) {
    return this.support.sendMessage(dto);
  }
}
