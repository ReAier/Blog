import type {
  ContentErrorCode,
  ContentErrorDetails,
  ContentErrorPayload,
} from '../../shared/content-types';

export class ContentRepositoryError extends Error implements ContentErrorPayload {
  readonly code: ContentErrorCode;
  readonly details?: ContentErrorDetails;

  constructor(code: ContentErrorCode, message: string, details?: ContentErrorDetails) {
    super(message);
    this.name = 'ContentRepositoryError';
    this.code = code;
    this.details = details;
  }
}

export class ContentTooLargeError extends ContentRepositoryError {
  constructor(message: string, details?: ContentErrorDetails) {
    super('CONTENT_TOO_LARGE', message, details);
    this.name = 'ContentTooLargeError';
  }
}

export class ContentValidationError extends ContentRepositoryError {
  constructor(message: string, details?: ContentErrorDetails) {
    super('CONTENT_VALIDATION_FAILED', message, details);
    this.name = 'ContentValidationError';
  }
}

export class ContentPathError extends ContentRepositoryError {
  constructor(message: string, details?: ContentErrorDetails) {
    super('CONTENT_PATH_INVALID', message, details);
    this.name = 'ContentPathError';
  }
}

export class ContentNotFoundError extends ContentRepositoryError {
  constructor(message: string, details?: ContentErrorDetails) {
    super('CONTENT_NOT_FOUND', message, details);
    this.name = 'ContentNotFoundError';
  }
}

export class ContentConflictError extends ContentRepositoryError {
  constructor(message: string, details?: ContentErrorDetails) {
    super('CONTENT_CONFLICT', message, details);
    this.name = 'ContentConflictError';
  }
}

export class ContentDuplicateError extends ContentRepositoryError {
  constructor(message: string, details?: ContentErrorDetails) {
    super('CONTENT_DUPLICATE', message, details);
    this.name = 'ContentDuplicateError';
  }
}
