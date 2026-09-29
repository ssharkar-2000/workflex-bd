import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorCode, declareCourseSchema, type DeclareCourseDto } from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { StorageService } from '../storage/storage.service';
import { CoursesService } from './courses.service';
import type { Env } from '../config/env.schema';

/**
 * A certificate is whatever the course handed over: a PDF, or a screenshot of
 * the completion page. Both are normal, so both are accepted.
 */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

@ApiTags('learning')
@ApiBearerAuth()
@Controller('learning')
export class LearningController {
  constructor(
    private readonly courses: CoursesService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('courses')
  @ApiOperation({
    summary: 'Free courses for the skills this account is missing',
  })
  async suggestions(@CurrentUser('userId') userId: string) {
    return this.courses.suggest(userId);
  }

  @Get('completions')
  @ApiOperation({ summary: 'Courses this account says it finished' })
  async completions(@CurrentUser('userId') userId: string) {
    return this.courses.completions(userId);
  }

  @Post('completions')
  @ApiOperation({ summary: 'Say you finished one of the suggested courses' })
  async declare(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(declareCourseSchema)) dto: DeclareCourseDto,
  ) {
    return this.courses.declare(userId, dto);
  }

  @Post('completions/:id/certificate')
  @ApiOperation({ summary: 'Attach the certificate for a finished course' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async certificate(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) throw AppException.notFound('No file was uploaded');

    if (!ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      throw new AppException(
        ApiErrorCode.UPLOAD_INVALID_TYPE,
        'Upload the certificate as a PDF or a photo.',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const max = this.config.get('MAX_UPLOAD_BYTES', { infer: true });
    if (file.buffer.byteLength > max) {
      throw new AppException(
        ApiErrorCode.UPLOAD_TOO_LARGE,
        `That file is too large. Maximum ${Math.round(max / 1_000_000)} MB.`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // Scoped to the owner in the query itself: a completion id from somebody
    // else's account must not be a way to write into their row.
    const row = await this.prisma.courseCompletion.findFirst({
      where: { id, userId },
      select: { id: true, storageKey: true },
    });
    if (!row) throw AppException.notFound('Course not found');

    const key = this.storage.buildKey(userId, 'COURSE_CERT', file.originalname);
    const stored = await this.storage.save(key, file.buffer);

    await this.prisma.courseCompletion.update({
      where: { id: row.id },
      data: {
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        originalName: file.originalname ?? null,
      },
    });

    // The replaced file goes only after the row points at the new one, so a
    // failure here never leaves a completion pointing at nothing.
    if (row.storageKey) {
      await this.storage.remove(row.storageKey).catch(() => {});
    }

    return { ok: true };
  }

  /** Lets somebody see the certificate they uploaded. Own files only. */
  @Get('completions/:id/certificate')
  @ApiOperation({ summary: 'Fetch the certificate you attached' })
  async download(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const row = await this.prisma.courseCompletion.findFirst({
      where: { id, userId },
      select: { storageKey: true, mimeType: true },
    });
    if (!row?.storageKey) throw AppException.notFound('No certificate yet');

    res.setHeader('Content-Type', row.mimeType ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(await this.storage.read(row.storageKey));
  }
}
