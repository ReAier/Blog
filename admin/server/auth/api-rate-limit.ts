export type ApiRateLimitKind = 'regular' | 'upload';

export interface ApiRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class ApiTokenRateLimiter {
  readonly regularLimit: number;
  readonly uploadLimit: number;
  readonly windowMs: number;
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(options: {
    regularLimit?: number;
    uploadLimit?: number;
    windowMs?: number;
  } = {}) {
    this.regularLimit = options.regularLimit ?? 120;
    this.uploadLimit = options.uploadLimit ?? 20;
    this.windowMs = options.windowMs ?? 60_000;
  }

  consume(tokenId: string, kind: ApiRateLimitKind, now = Date.now()): ApiRateLimitResult {
    const limit = kind === 'upload' ? this.uploadLimit : this.regularLimit;
    const key = `${kind}:${tokenId}`;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= limit) {
      return { allowed: false, limit, remaining: 0, resetAt: bucket.resetAt };
    }
    bucket.count += 1;
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }
}
