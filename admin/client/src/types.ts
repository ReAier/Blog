export interface SessionUser {
  username: string;
  displayName?: string;
  csrfToken?: string;
}

export interface AdminSetupStatus {
  required: boolean;
  tokenReady: boolean;
}

export interface AdminSetupChallenge {
  challenge: string;
  totpSecret: string;
  otpauthUri: string;
  expiresAt: number;
}

export interface AdminSetupConfirmation extends SessionUser {
  recoveryCodes: string[];
  idleExpiresAt: number;
  absoluteExpiresAt: number;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PostFrontmatter {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  draft: boolean;
  featured: boolean;
  cover?: string;
}

export interface PostSummary {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  draft: boolean;
  featured: boolean;
  tags: string[];
  revision: string;
  deleted?: boolean;
}

export interface PostDocument extends PostSummary {
  body: string;
  cover?: string;
}

export interface PostSaveInput {
  slug: string;
  frontmatter: PostFrontmatter;
  body: string;
}

export interface ClipSummary {
  slug: string;
  title: string;
  description: string;
  language: string;
  file: string;
  updatedAt?: string;
  revision: string;
  references: Array<{ postSlug: string; kind: 'body' }>;
}

export interface ClipPageResult extends PageResult<ClipSummary> {
  languages: string[];
}

export interface ClipDocument extends ClipSummary {
  code: string;
  createdAt: string;
}

export interface ClipSaveInput {
  slug: string;
  title: string;
  description: string;
  language: string;
  file: string;
  createdAt: string;
  updatedAt?: string;
  code: string;
}

export interface ImageAsset {
  id: string;
  name: string;
  originalName: string;
  url: string;
  markdownPath: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
  references: Array<{ postSlug: string; kind: 'body' | 'cover' }>;
}

export interface BackupRecord {
  id: string;
  name: string;
  createdAt: string;
  references?: Array<{ postSlug: string; kind: 'body' | 'cover' }>;
  byteSize: number;
  fileCount: number;
  downloadUrl: string;
}

export interface PostHistoryEntry {
  revisionNumber: number;
  blobSha256: string;
  createdAt: number;
  groupId: string;
}

export interface PostHistoryRevision extends PostHistoryEntry {
  content: string;
}

export type PublishStatus = 'queued' | 'validating' | 'building' | 'switching' | 'succeeded' | 'failed';

export interface PublishJob {
  id: string;
  status: PublishStatus;
  startedAt: string;
  finishedAt?: string;
  contentHash?: string;
  release?: string;
  log: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
}

export interface DashboardSnapshot {
  counts: {
    posts: number;
    drafts: number;
    clips: number;
    images: number;
  };
  orphanClips?: Array<{ file: string; slug: string }>;
  unreferencedImages?: string[];
  recentPosts: PostSummary[];
  latestPublish?: PublishJob;
  storageBytes?: number;
}

export interface PreviewResponse {
  html: string;
  generatedAt?: string;
  previewId?: string;
}



export type ApiTokenScope =
  | 'posts:read'
  | 'posts:write'
  | 'clips:read'
  | 'clips:write'
  | 'images:read'
  | 'images:write';

export interface ApiTokenRecord {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  createdAt: number;
  expiresAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
}

export interface ApiTokenCreation {
  token: string;
  record: ApiTokenRecord;
}
