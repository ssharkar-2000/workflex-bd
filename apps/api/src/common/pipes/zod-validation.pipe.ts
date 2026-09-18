import { PipeTransform, HttpStatus } from '@nestjs/common';
import { ZodError, type ZodSchema, type z } from 'zod';
import { ApiErrorCode } from '@workflex/shared';
import { AppException } from '../exceptions/app.exception';

/**
 * Validates a request body against a schema from @workflex/shared, so the API
 * and the mobile app enforce exactly the same rules.
 *
 *   @Post('otp/request')
 *   request(@Body(new ZodValidationPipe(otpRequestSchema)) dto: OtpRequestDto) {}
 *
 * Note the pipe returns the schema *output*, so transforms have already run —
 * handlers receive a normalised +8801XXXXXXXXX phone, never raw user input.
 */
export class ZodValidationPipe<T extends ZodSchema>
  implements PipeTransform<unknown, z.output<T>>
{
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    try {
      return this.schema.parse(value) as z.output<T>;
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const key = issue.path.join('.') || '_';
          (fieldErrors[key] ??= []).push(issue.message);
        }
        throw new AppException(
          ApiErrorCode.VALIDATION_FAILED,
          'Validation failed',
          HttpStatus.UNPROCESSABLE_ENTITY,
          { fieldErrors },
        );
      }
      throw err;
    }
  }
}
