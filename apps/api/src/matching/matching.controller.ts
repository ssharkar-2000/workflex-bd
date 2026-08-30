import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorCode } from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CvService } from './cv.service';
import type { Env } from '../config/env.schema';

/**
 * PDF as well as images, unlike the identity documents.
 *
 * A CV is a document people already have as a file, and forcing them to
 * photograph a PDF to upload it would be absurd. The identity pipeline stays
 * images-only because it runs face and card-quality checks that need a photo.
 */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

@ApiTags('cv')
@ApiBearerAuth()
@Controller('cv')
export class MatchingController {
  constructor(
    private readonly cv: CvService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: "The account's CV and what was read from it" })
  async status(@CurrentUser('userId') userId: string) {
    return this.cv.status(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Upload or replace a CV, then parse it' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) throw AppException.notFound('No file was uploaded');

    if (!ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      throw new AppException(
        ApiErrorCode.UPLOAD_INVALID_TYPE,
        'Upload your CV as a PDF or a photo.',
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

    const previous = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'CV' } },
    });

    const key = this.storage.buildKey(userId, 'CV', file.originalname);
    const stored = await this.storage.save(key, file.buffer);

    await this.prisma.document.upsert({
      where: { userId_kind: { userId, kind: 'CV' } },
      create: {
        userId,
        kind: 'CV',
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        originalName: file.originalname ?? null,
      },
      update: {
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        originalName: file.originalname ?? null,
      },
    });

    // Replacing a CV should not leave the old file behind.
    if (previous && previous.storageKey !== stored.storageKey) {
      await this.storage.remove(previous.storageKey).catch(() => undefined);
    }

    // Parsing is awaited rather than backgrounded: the upload screen shows
    // what was understood, and a fire-and-forget parse would leave the user
    // staring at an empty profile with nothing to wait for.
    return this.cv.parseStoredCv(userId);
  }

  @Post('reparse')
  @ApiOperation({ summary: 'Re-read the stored CV without re-uploading' })
  async reparse(@CurrentUser('userId') userId: string) {
    return this.cv.parseStoredCv(userId);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove the CV and its parsed profile' })
  async remove(@CurrentUser('userId') userId: string) {
    return this.cv.remove(userId);
  }
}
