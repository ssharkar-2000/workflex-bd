import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { VerificationModule } from '../verification/verification.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [UsersModule, VerificationModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
