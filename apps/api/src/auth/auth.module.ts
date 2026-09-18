import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SmsModule } from '../sms/sms.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  // global: true so the app-wide JwtAuthGuard can inject JwtService without
  // every feature module re-importing JwtModule.
  // UsersModule exports PasswordService, which login and reset both need.
  imports: [JwtModule.register({ global: true }), SmsModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService],
  exports: [TokenService],
})
export class AuthModule {}
