import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '@workflex/shared';

/**
 * Every error the client is meant to branch on carries a stable `code`.
 * The mobile app switches on the code and renders its own Bangla/English
 * copy, so server messages are for developers, not end users.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppException(
      ApiErrorCode.UNAUTHORIZED,
      message,
      HttpStatus.UNAUTHORIZED,
    );
  }

  static forbidden(message = 'Not allowed') {
    return new AppException(
      ApiErrorCode.FORBIDDEN,
      message,
      HttpStatus.FORBIDDEN,
    );
  }

  static notFound(message = 'Not found') {
    return new AppException(
      ApiErrorCode.NOT_FOUND,
      message,
      HttpStatus.NOT_FOUND,
    );
  }

  /** `required` tells the app which verification screen to route to. */
  static verificationRequired(required: 1 | 2) {
    return new AppException(
      ApiErrorCode.VERIFICATION_REQUIRED,
      'A higher verification level is required for this action',
      HttpStatus.FORBIDDEN,
      { required },
    );
  }
}
