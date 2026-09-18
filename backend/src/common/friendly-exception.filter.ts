import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Item 14 — "technical kono problem asle oita user friendly message dekhabe."
 *
 * Without this, anything that wasn't an explicit HttpException fell through
 * Nest's default handler and reached the app as a bare
 * `{"statusCode":500,"message":"Internal server error"}` — and a raw Prisma
 * failure was worse: the app showed the user things like
 * `Invalid \`prisma.job.create()\` invocation: Unique constraint failed on the
 * fields: (\`code\`)`, which means nothing to anyone and leaks the schema.
 *
 * Every response now carries three fields:
 *   - `message`   what a person should read (plain language, says what to do)
 *   - `code`      a stable machine key the app maps to a translated string,
 *                 so Bangla users get Bangla instead of English from the API
 *   - `reference` short id also written to the server log, so a user can quote
 *                 it in a support ticket and an engineer can find the stack
 *
 * The real error is still logged in full server-side; only the response is
 * softened.
 */
@Catch()
export class FriendlyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Request');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = this.map(exception);
    const reference = Math.random().toString(36).slice(2, 8).toUpperCase();

    if (mapped.status >= 500) {
      this.logger.error(
        `[${reference}] ${request.method} ${request.url} — ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${reference}] ${request.method} ${request.url} — ${mapped.message}`);
    }

    response.status(mapped.status).json({
      statusCode: mapped.status,
      code: mapped.code,
      message: mapped.message,
      // Only surface a reference for the cases a user might need to report.
      ...(mapped.status >= 500 ? { reference } : {}),
    });
  }

  private map(exception: unknown): { status: number; code: string; message: string } {
    // Anything the app threw on purpose keeps its own wording — those
    // messages are already written for a person ("Only approved jobs can be
    // featured.") and translating them again here would lose that.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[] };
      const raw = typeof body === 'string' ? body : body?.message;
      const message = Array.isArray(raw) ? raw[0] : raw;
      return {
        status,
        code: this.codeForStatus(status),
        message: message ?? this.defaultForStatus(status),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            code: 'DUPLICATE',
            message: 'This already exists. Change the details and try again.',
          };
        case 'P2003':
          return {
            status: HttpStatus.BAD_REQUEST,
            code: 'LINKED_RECORD_MISSING',
            message: 'Something this is linked to is missing. Refresh and try again.',
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            code: 'NOT_FOUND',
            message: 'That record no longer exists. It may have just been removed.',
          };
        default:
          return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: 'SERVER_ERROR',
            message: 'We could not save that just now. Try again in a moment.',
          };
      }
    }

    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is starting up or briefly unavailable. Try again shortly.',
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'INVALID_REQUEST',
        message: 'Some of those details were not valid. Check the form and try again.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'SERVER_ERROR',
      message: 'Something went wrong on our side. Try again in a moment.',
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'INVALID_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'SESSION_EXPIRED';
      case HttpStatus.FORBIDDEN:
        return 'NOT_ALLOWED';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'DUPLICATE';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return status >= 500 ? 'SERVER_ERROR' : 'INVALID_REQUEST';
    }
  }

  private defaultForStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'Your session has expired. Sign in again to continue.';
      case HttpStatus.FORBIDDEN:
        return 'You do not have permission to do that.';
      case HttpStatus.NOT_FOUND:
        return 'We could not find that.';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too many attempts. Wait a moment and try again.';
      default:
        return 'Something went wrong. Try again in a moment.';
    }
  }

  private describe(exception: unknown): string {
    if (exception instanceof Error) return `${exception.name}: ${exception.message}`;
    return String(exception);
  }
}
