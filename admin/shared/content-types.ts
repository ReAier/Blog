export interface PostDocument {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  draft: boolean;
  featured: boolean;
  cover?: string;
  body: string;
}

export interface StoredPostDocument extends PostDocument {
  fileName: string;
  revision: string;
  deleted: boolean;
}

export interface ClipMetadata {
  title: string;
  description?: string;
  language: string;
  file: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClipReference {
  kind: 'body';
  postSlug: string;
}

export interface ClipDocument extends ClipMetadata {
  slug: string;
  code: string;
  metadataRevision: string;
  codeRevision: string;
  references: ClipReference[];
}

export type ImageReferenceKind = 'body' | 'cover';

export interface ImageReference {
  kind: ImageReferenceKind;
  postSlug: string;
  value: string;
}

export interface ImageAsset {
  path: string;
  fileName: string;
  byteSize: number;
  revision: string;
  references: ImageReference[];
}

export type ContentMutationAction = 'create' | 'update' | 'soft-delete' | 'restore';
export type ContentMutationEntity = 'post' | 'clip-metadata' | 'clip-code';

export interface ContentMutationRecord {
  action: ContentMutationAction;
  entity: ContentMutationEntity;
  id: string;
  beforeRevision: string | null;
  afterRevision: string | null;
}

export interface ContentHistoryWriter {
  record(record: ContentMutationRecord): void | Promise<void>;
}

export type ContentErrorCode =
  | 'CONTENT_CONFLICT'
  | 'CONTENT_DUPLICATE'
  | 'CONTENT_NOT_FOUND'
  | 'CONTENT_PATH_INVALID'
  | 'CONTENT_TOO_LARGE'
  | 'CONTENT_VALIDATION_FAILED';

export interface ContentErrorDetails {
  [key: string]: unknown;
}

export interface ContentErrorPayload {
  code: ContentErrorCode;
  message: string;
  details?: ContentErrorDetails;
}

export interface ContentMutationOptions {
  expectedRevision?: string | null;
}

export interface RevisionedText {
  content: string;
  revision: string;
}
