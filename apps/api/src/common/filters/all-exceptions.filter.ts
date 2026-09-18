import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { ApiErrorCode, type ApiError } from '@workflex/shared';
import { AppException } from '../exceptions/app.exception';

/**
 * Single exit point for errors: every failure leaves the API in the same
 * `ApiError` shape, so the mobile app has exactly one error contract to handle.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req.headers['x-request-id'] as string) || undefined;

    const { status, body } = this.toApiError(exception, requestId);

    // 5xx is our bug and needs the stack; 4xx is the caller's and does not.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, path: req.url, method: req.method, requestId },
        'Unhandled exception',
      );
    } else {
      this.logger.debug(
        { code: body.code, path: req.url, method: req.method, requestId },
        body.message,
      );
    }

    res.status(status).json(body);
  }

  private toApiError(
    exception: unknown,
    requestId?: string,
  ): { status: number; body: ApiError } {
    if (exception instanceof AppException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as {
        code: ApiErrorCode;
        message: string;
        details?: Record<string, unknown>;
      };
      const { fieldErrors, ...rest } = (res.details ?? {}) as {
        fieldErrors?: Record<string, string[]>;
      } & Record<string, unknown>;

      return {
        status,
        body: {
          statusCode: status,
          code: res.code,
          message: res.message,
          ...(fieldErrors ? { fieldErrors } : {}),
          ...(Object.keys(rest).length > 0 ? { details: rest } : {}),
          requestId,
        },
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: ApiErrorCode.RATE_LIMITED,
          message: 'Too many requests. Please slow down.',
          requestId,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ??
            exception.message);

      return {
        status,
        body: {
          statusCode: status,
          code: this.codeForStatus(status),
          message: Array.isArray(message) ? message.join('; ') : message,
          requestId,
        },
      };
    }

    // Never leak an internal message or stack to the client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        message: 'Something went wrong. Please try again.',
        requestId,
      },
    };
  }

  private codeForStatus(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.RATE_LIMITED;
      case HttpStatus.UNPROCESSABLE_ENTITY:
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCode.VALIDATION_FAILED;
      default:
        return ApiErrorCode.INTERNAL;
    }
  }
}
