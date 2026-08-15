import { describe, expect, it } from 'vitest';
import { ApiTokenRateLimiter } from '../admin/server/auth/api-rate-limit';

describe('API token rate limiter', () => {
  it('uses independent rolling-minute limits for regular requests and uploads', () => {
    const limiter = new ApiTokenRateLimiter({ regularLimit: 2, uploadLimit: 1, windowMs: 60_000 });
    const now = Date.UTC(2026, 7, 15);

    expect(limiter.consume('token-1', 'regular', now)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('token-1', 'regular', now + 1)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume('token-1', 'regular', now + 2)).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.consume('token-1', 'upload', now + 3)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume('token-1', 'upload', now + 4)).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.consume('token-2', 'regular', now + 5)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('token-1', 'regular', now + 60_000)).toMatchObject({ allowed: true, remaining: 1 });
  });
});
