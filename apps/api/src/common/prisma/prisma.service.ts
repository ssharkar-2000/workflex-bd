import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Connection-level failures worth waiting out; anything else fails fast. */
const RETRYABLE_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Server reachable but timed out
  'P1017', // Server closed the connection
  // Pool timeout. Reads like a capacity problem but on a serverless database
  // it is usually the same cold start as P1001 wearing a different hat: the
  // compute is waking, individual connections are slow to establish, and the
  // pool gives up before any of them land. Retrying rides it out.
  'P2024',
]);

const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Serverless Postgres (Neon here) suspends its compute when idle and takes
   * a few seconds to wake on the next connection. A single `$connect()` loses
   * that race, and because this runs in onModuleInit a rejection takes the
   * whole process down — so a cold database looked like a broken build.
   *
   * Retrying only helps for connection-level failures. Bad credentials or a
   * wrong database name (P1000/P1003) will fail identically every time, so
   * those still surface immediately rather than after 30 seconds of waiting.
   */
  async onModuleInit(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        this.logger.log(
          attempt === 1
            ? 'Connected to PostgreSQL'
            : `Connected to PostgreSQL after ${attempt} attempts`,
        );
        return;
      } catch (err) {
        const code = (err as { errorCode?: string }).errorCode;

        if (!code || !RETRYABLE_CODES.has(code) || attempt === MAX_ATTEMPTS) {
          console.error(
            `[PrismaService] Could not connect to the database${
              code ? ` (${code})` : ''
            } after ${attempt} attempt(s). ` +
              `Check DATABASE_URL, and that the database is awake and reachable.`,
          );
          throw err;
        }

        const delay = BASE_DELAY_MS * attempt;
        // Written straight to the console rather than through the Nest logger:
        // main.ts bootstraps with `bufferLogs: true`, so anything logged before
        // app.useLogger() is discarded if startup then fails — which is exactly
        // the case this message exists to explain.
        console.warn(
          `[PrismaService] Database not reachable yet (${code}, attempt ${attempt}/${MAX_ATTEMPTS}) — ` +
            `retrying in ${delay / 1000}s. A suspended serverless database takes a moment to wake.`,
        );
        await sleep(delay);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Used by GET /health to prove the DB is actually reachable. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.error({ err }, 'Database ping failed');
      return false;
    }
  }
}
