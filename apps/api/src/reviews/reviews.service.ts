import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  type CreateReviewDto,
  type RatingSummary,
  type RatingsPage,
  type Review,
  type ReviewRole,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/** How many reviews each list on the ratings screen carries. */
const PAGE = 20;

/**
 * Themes counted in review text.
 *
 * A small, fixed list rather than free extraction: these are the things
 * people actually write about in this market, and a fixed list can be
 * translated and cannot surface something embarrassing from a stranger's
 * sentence. A review mentioning several counts for each.
 */
const THEMES: { theme: string; words: RegExp }[] = [
  { theme: 'punctuality', words: /\b(punctual|on time|ontime|late|early)\b/i },
  { theme: 'communication', words: /\b(communicat|reply|replied|responsive|contact)/i },
  { theme: 'quality', words: /\b(quality|careful|clean|thorough|neat|professional)/i },
  { theme: 'attitude', words: /\b(polite|friendly|honest|respect|helpful|attitude)/i },
  { theme: 'speed', words: /\b(fast|quick|slow|speed)\b/i },
  { theme: 'reliability', words: /\b(reliab|depend|trust|showed up|no show)/i },
  { theme: 'payment', words: /\b(paid|payment|salary|wage)\b/i },
];

/**
 * Ratings and reviews, in both directions.
 *
 * A review can only be written about a job the two people actually shared,
 * and only about the side the subject was on: the person who posted the job
 * is reviewed as a recruiter, the person who was hired as a worker. That
 * check is what makes a rating here worth more than a star on a page anyone
 * can post to.
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async page(userId: string, role: ReviewRole): Promise<RatingsPage> {
    const [summary, received, given] = await Promise.all([
      this.summary(userId, role),
      this.prisma.review.findMany({
        where: { subjectId: userId, subjectRole: role },
        orderBy: { createdAt: 'desc' },
        take: PAGE,
        include: REVIEW_INCLUDE,
      }),
      this.prisma.review.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        take: PAGE,
        include: REVIEW_INCLUDE,
      }),
    ]);

    return {
      summary,
      received: received.map((row) => toReview(row, 'author')),
      given: given.map((row) => toReview(row, 'subject')),
    };
  }

  /** The figures at the top of the screen, for one role. */
  async summary(userId: string, role: ReviewRole): Promise<RatingSummary> {
    const [rows, grouped, jobsCompleted] = await Promise.all([
      this.prisma.review.findMany({
        where: { subjectId: userId, subjectRole: role },
        select: { rating: true, comment: true, onTime: true, wouldWorkAgain: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { subjectId: userId, subjectRole: role },
        _count: { _all: true },
      }),
      role === 'WORKER'
        ? this.prisma.jobApplication.count({
            where: { userId, status: 'ACCEPTED' },
          })
        : this.prisma.jobApplication.count({
            where: { status: 'ACCEPTED', job: { postedBy: userId } },
          }),
    ]);

    const distribution: RatingSummary['distribution'] = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const row of grouped) {
      const key = String(row.rating) as keyof RatingSummary['distribution'];
      if (key in distribution) distribution[key] = row._count._all;
    }

    return {
      role,
      average: rows.length
        ? Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) * 10) / 10
        : null,
      count: rows.length,
      distribution,
      jobsCompleted,
      onTimeRate: rate(rows.map((row) => row.onTime)),
      wouldWorkAgainRate: rate(rows.map((row) => row.wouldWorkAgain)),
      themes: countThemes(rows.map((row) => row.comment)),
    };
  }

  /**
   * Leave a review.
   *
   * Refuses unless this pair shared the job in the direction claimed, and
   * refuses a second review of the same person for the same job — the unique
   * index says so too, but answering with a sentence beats a constraint name.
   * A finished job still counts: the end of the work is when people review.
   */
  async create(authorId: string, dto: CreateReviewDto): Promise<Review> {
    if (dto.subjectId === authorId) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'You cannot review yourself',
        HttpStatus.BAD_REQUEST,
      );
    }

    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, postedBy: true },
    });
    if (!job) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No job with that id', HttpStatus.NOT_FOUND);
    }

    // Reviewing a worker: the author must own the job, and the subject must
    // have been hired for it. Reviewing a recruiter: the reverse.
    const worker = dto.subjectRole === 'WORKER' ? dto.subjectId : authorId;
    const recruiter = dto.subjectRole === 'WORKER' ? authorId : dto.subjectId;

    const hired = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId: job.id, userId: worker } },
      select: { status: true },
    });

    if (job.postedBy !== recruiter || !hired || hired.status !== 'ACCEPTED') {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'You can only review someone you worked with on that job',
        HttpStatus.FORBIDDEN,
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        jobId_authorId_subjectId: {
          jobId: job.id,
          authorId,
          subjectId: dto.subjectId,
        },
      },
    });
    if (existing) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'You have already reviewed this person for this job',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.review.create({
      data: {
        jobId: job.id,
        authorId,
        subjectId: dto.subjectId,
        subjectRole: dto.subjectRole,
        rating: dto.rating,
        comment: dto.comment && dto.comment.trim() ? dto.comment.trim() : null,
        onTime: dto.onTime ?? null,
        wouldWorkAgain: dto.wouldWorkAgain ?? null,
      },
      include: REVIEW_INCLUDE,
    });

    this.logger.log(
      `Review ${created.id}: ${dto.rating}★ for ${dto.subjectId} as ${dto.subjectRole}`,
    );
    return toReview(created, 'subject');
  }
}

const REVIEW_INCLUDE = {
  job: { select: { id: true, title: true } },
  author: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true } },
  subject: { select: { id: true, publicId: true, firstName: true, lastName: true, phone: true } },
} satisfies Prisma.ReviewInclude;

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

/** The other person in the exchange — whichever side the reader is not on. */
function toReview(row: ReviewRow, counterpart: 'author' | 'subject'): Review {
  const other = row[counterpart];
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    onTime: row.onTime,
    wouldWorkAgain: row.wouldWorkAgain,
    subjectRole: row.subjectRole,
    createdAt: row.createdAt.toISOString(),
    counterpart: {
      id: other.id,
      publicId: other.publicId,
      name: [other.firstName, other.lastName].filter(Boolean).join(' ') || other.phone,
    },
    job: { id: row.job.id, title: row.job.title },
  };
}

/** A percentage of the people who answered, or null when nobody did. */
function rate(answers: (boolean | null)[]): number | null {
  const given = answers.filter((answer): answer is boolean => answer !== null);
  if (given.length === 0) return null;
  return Math.round((given.filter(Boolean).length / given.length) * 100);
}

function countThemes(comments: (string | null)[]): RatingSummary['themes'] {
  const counts = new Map<string, number>();
  for (const comment of comments) {
    if (!comment) continue;
    for (const { theme, words } of THEMES) {
      if (words.test(comment)) counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([theme, mentions]) => ({ theme, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 3);
}
