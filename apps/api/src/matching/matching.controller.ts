import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorCode,
  cvBulletsRequestSchema,
  cvSummaryRequestSchema,
  generateCvSchema,
  type CvBulletsDto,
  type CvSummaryDto,
  type GenerateCvDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { StorageService } from '../storage/storage.service';
import { CvService } from './cv.service';
import { CvWriterService } from './cv-writer.service';
import { AnalyzerService } from './analyzer.service';
import { SkillGapService } from './skill-gap.service';
import type { Env } from '../config/env.schema';

/**
 * PDF as well as images, unlike the identity documents.
 *
 * A CV is a document people already have as a file, and forcing them to
 * photograph a PDF to upload it would be absurd. The identity pipeline stays
 * images-only because it runs face and card-quality checks that need a photo.
 */
/**
 * A minute of video from a phone. Under the size cap this is generous; over
 * it, the upload is refused with the length as the reason, because "too
 * large" means nothing to somebody holding a two-minute clip.
 */
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/3gpp',
]);

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
    private readonly skillGap: SkillGapService,
    private readonly writer: CvWriterService,
    private readonly analyzer: AnalyzerService,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary: "Draft a CV from the account's own details, for the builder to edit",
  })
  async generate(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(generateCvSchema)) dto: GenerateCvDto,
  ) {
    return this.writer.generate(userId, dto);
  }

  @Post('summary')
  @ApiOperation({ summary: 'Rewrite the summary paragraph alone, for the builder' })
  async summary(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(cvSummaryRequestSchema)) dto: CvSummaryDto,
  ) {
    return this.writer.summary(userId, dto);
  }

  @Post('bullets')
  @ApiOperation({ summary: 'Suggest the points for one job on the CV' })
  async bullets(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(cvBulletsRequestSchema)) dto: CvBulletsDto,
  ) {
    return this.writer.bullets(userId, dto);
  }

  @Post('intro')
  @ApiOperation({ summary: 'Upload or replace the one-minute video intro' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadIntro(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) throw AppException.notFound('No file was uploaded');

    if (!ALLOWED_VIDEO_MIME.has(file.mimetype.toLowerCase())) {
      throw new AppException(
        ApiErrorCode.UPLOAD_INVALID_TYPE,
        'Upload the introduction as a video.',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    // Length is enforced where the video is made — the picker caps recording
    // at sixty seconds. Here it is size, which is what a server can actually
    // check without decoding the file.
    const max = this.config.get('MAX_UPLOAD_BYTES', { infer: true }) * 4;
    if (file.buffer.byteLength > max) {
      throw new AppException(
        ApiErrorCode.UPLOAD_TOO_LARGE,
        `That video is too large. Keep it to a minute, under ${Math.round(max / 1_000_000)} MB.`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const previous = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'INTRO_VIDEO' } },
      select: { storageKey: true },
    });

    const key = this.storage.buildKey(userId, 'INTRO_VIDEO', file.originalname);
    const stored = await this.storage.save(key, file.buffer);

    await this.prisma.document.upsert({
      where: { userId_kind: { userId, kind: 'INTRO_VIDEO' } },
      create: {
        userId,
        kind: 'INTRO_VIDEO',
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

    // Only once the row points at the new file, so a failure never leaves an
    // account pointing at a video that is no longer there.
    if (previous?.storageKey && previous.storageKey !== stored.storageKey) {
      await this.storage.remove(previous.storageKey).catch(() => {});
    }

    return this.cv.status(userId);
  }

  @Delete('intro')
  @ApiOperation({ summary: 'Remove the video introduction' })
  async removeIntro(@CurrentUser('userId') userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'INTRO_VIDEO' } },
      select: { storageKey: true },
    });
    if (doc) {
      await this.prisma.document.delete({
        where: { userId_kind: { userId, kind: 'INTRO_VIDEO' } },
      });
      await this.storage.remove(doc.storageKey).catch(() => {});
    }
    return this.cv.status(userId);
  }

  @Get('intro')
  @ApiOperation({ summary: 'Watch your own video introduction' })
  async watchIntro(
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'INTRO_VIDEO' } },
    });
    if (!doc) throw AppException.notFound('No introduction uploaded');

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(await this.storage.read(doc.storageKey));
  }

  @Get()
  @ApiOperation({ summary: "The account's CV and what was read from it" })
  async status(@CurrentUser('userId') userId: string) {
    return this.cv.status(userId);
  }

  @Get('analyze')
  @ApiOperation({
    summary: 'Score the CV against the open postings in this person’s own field',
  })
  async analyze(@CurrentUser('userId') userId: string) {
    return this.analyzer.analyze(userId);
  }

  @Get('skill-path')
  @ApiOperation({
    summary: 'Skills worth learning next, from live demand on the platform',
  })
  async skillPath(@CurrentUser('userId') userId: string) {
    // Null rather than an error when there is no CV: the dashboard card hides
    // itself, which is not a failure worth a status code.
    return { path: await this.skillGap.path(userId) };
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
