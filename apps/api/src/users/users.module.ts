import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password.service';
import { ProfileService } from './profile.service';

@Module({
  imports: [MailModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    EmailVerificationService,
    PasswordService,
    ProfileService,
  ],
  exports: [UsersService, EmailVerificationService, PasswordService],
})
export class UsersModule {}
