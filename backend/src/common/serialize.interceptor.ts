import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Prisma returns BigInt for money columns and Decimal for rating/lat/lng.
 * JSON.stringify throws on BigInt, so everything is normalised to a JSON-safe
 * shape here rather than in each service. Money stays an integer (paisa) —
 * formatting to "৳25,000" happens in the app, not the API.
 */
function normalise(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Prisma Decimal instances expose toFixed / toString.
    if (typeof (obj as any).toFixed === 'function' && typeof (obj as any).d !== 'undefined') {
      return Number(obj.toString());
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, normalise(v)]));
  }
  return value;
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(normalise));
  }
}
