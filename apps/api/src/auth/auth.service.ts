import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { OtpPurpose } from '@prisma/client';
import {
  ApiErrorCode,
  maskPhone,
  normalizeBdPhone,
  type AuthSession,
  type AuthTokens,
  type LoginDto,
  type LogoutDto,
  type OtpRequestDto,
  type OtpRequestResponse,
  type OtpVerifyDto,
  type PasswordResetConfirmDto,
  type RefreshDto,
} from '@workflex/shared';
import { AppException } from '../common/exceptions/app.exception';
import { UsersService } from '../users/users.service';
import { PasswordService } from '../users/password.service';
import { OtpService } from './otp.service';
import { TokenService, type SessionContext } from './token.service';

/**
 * A real scrypt hash of a random string. Verified against when no account
 * exists so the timing of a failed sign-in does not reveal that.
 */
const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
  ) {}

  async requestOtp(dto: OtpRequestDto): Promise<OtpRequestResponse> {
    // Deliberately not checked: whether the phone belongs to an existing
    // account. Answering that would turn this endpoint into a free
    // "is this number registered?" oracle.
    return this.otp.issue(dto.phone, dto.purpose as OtpPurpose);
  }

  async verifyOtp(
    dto: OtpVerifyDto,
    ctx: SessionContext,
  ): Promise<AuthSession> {
    await this.otp.verify(dto.phone, dto.code, dto.purpose as OtpPurpose);

    const existing = await this.users.findByPhone(dto.phone);
    const isNewUser = existing === null;
    const user = existing ?? (await this.users.createFromPhone(dto.phone));

    if (user.status !== 'ACTIVE') {
      throw new AppException(
        ApiErrorCode.ACCOUNT_SUSPENDED,
        'This account is not active. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    // An older account may predate phone verification; record it now.
    if (!user.phoneVerifiedAt) {
      await this.users.markPhoneVerified(user.id);
      user.phoneVerifiedAt = new Date();
    }

    this.logger.log(
      `${isNewUser ? 'Registered' : 'Signed in'} ${maskPhone(user.phone)}`,
    );

    return {
      user: await this.users.toAuthUser(user),
      tokens: await this.tokens.issuePair(user, ctx),
      isNewUser,
    };
  }

  /**
   * Password sign-in.
   *
   * Every failure returns the same code and message. Distinguishing "no such
   * number" from "wrong password" would turn this endpoint into a way to
   * enumerate which phone numbers hold accounts.
   */
  async login(dto: LoginDto, ctx: SessionContext): Promise<AuthSession> {
    const user = await this.users.findByPhone(dto.phone);

    if (!user?.passwordHash) {
      // Still spend the hashing time so a missing account is not detectable
      // from how quickly the request comes back.
      await this.passwords.verify(dto.password, DUMMY_HASH);
      throw this.invalidCredentials();
    }

    const matches = await this.passwords.verify(dto.password, user.passwordHash);
    if (!matches) throw this.invalidCredentials();

    if (user.status !== 'ACTIVE') {
      throw new AppException(
        ApiErrorCode.ACCOUNT_SUSPENDED,
        'This account is not active. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    this.logger.log(`Password sign-in ${maskPhone(user.phone)}`);

    return {
      user: await this.users.toAuthUser(user),
      tokens: await this.tokens.issuePair(user, ctx),
      isNewUser: false,
    };
  }

  private invalidCredentials(): AppException {
    return new AppException(
      ApiErrorCode.INVALID_CREDENTIALS,
      'The mobile number or password is incorrect.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  /**
   * Sends a reset code. The response is identical whether or not the number
   * is registered, for the same enumeration reason as login.
   */
  async requestPasswordReset(phone: string): Promise<{ expiresIn: number }> {
    const user = await this.users.findByPhone(phone);

    if (user) {
      await this.otp.issue(phone, 'PASSWORD_RESET' as OtpPurpose);
    } else {
      this.logger.warn(
        `Password reset requested for unknown number ${maskPhone(phone)}`,
      );
    }

    return { expiresIn: 300 };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto): Promise<void> {
    const phone = normalizeBdPhone(dto.phone);
    await this.otp.verify(phone, dto.code, 'PASSWORD_RESET' as OtpPurpose);

    const user = await this.users.findByPhone(phone);
    if (!user) throw this.invalidCredentials();

    await this.users.setPasswordHash(
      user.id,
      await this.passwords.hash(dto.password),
    );

    // Anyone holding a session on the old password loses it. A reset is the
    // remedy for a compromised account, so it has to end other sessions.
    await this.tokens.revokeAllForUser(user.id);
    this.logger.log(`Password reset completed for ${maskPhone(user.phone)}`);
  }

  async refresh(dto: RefreshDto, ctx: SessionContext): Promise<AuthTokens> {
    return this.tokens.rotate(dto.refreshToken, ctx);
  }

  async logout(dto: LogoutDto, userId: string): Promise<void> {
    if (dto.allDevices) {
      await this.tokens.revokeAllForUser(userId);
      return;
    }
    if (dto.refreshToken) {
      await this.tokens.revoke(dto.refreshToken);
    }
  }
}
