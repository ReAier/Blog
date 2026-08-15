import { timingSafeEqual } from 'node:crypto';
import { hashOpaqueToken } from './sessions';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfRequest {
  method: string;
  origin: string | undefined;
  allowedOrigins: readonly string[];
  csrfToken: string | undefined;
  csrfTokenHash: string | undefined;
}

function canonicalOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function verifyCsrfRequest(request: CsrfRequest): boolean {
  if (safeMethods.has(request.method.toUpperCase())) {
    return true;
  }

  if (!request.origin || !request.csrfToken || !request.csrfTokenHash) {
    return false;
  }

  const requestOrigin = canonicalOrigin(request.origin);
  if (
    requestOrigin === null
    || !request.allowedOrigins.some((origin) => canonicalOrigin(origin) === requestOrigin)
  ) {
    return false;
  }

  const actualHash = Buffer.from(hashOpaqueToken(request.csrfToken), 'utf8');
  const expectedHash = Buffer.from(request.csrfTokenHash, 'utf8');
  return actualHash.length === expectedHash.length
    && timingSafeEqual(actualHash, expectedHash);
}
