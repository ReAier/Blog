export type AdminRole = 'viewer' | 'editor' | 'publisher' | 'owner' | 'custom';

export type AdminPermission = string;

export interface SessionUser {
  id?: string;
  username: string;
  role?: AdminRole;
  permissions: AdminPermission[];
  csrfToken?: string;
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

export interface PostPageResult extends PageResult<PostSummary> {
  counts: {
    all: number;
    published: number;
    drafts: number;
    deleted: number;
  };
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
  relativePath?: string;
  publicUrl: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
}


export type TrashItemType = 'post' | 'clip' | 'image';

export interface TrashItem {
  id: string;
  type: TrashItemType;
  title: string;
  detail: string;
  deletedAt: string;
}

export interface TrashResult {
  items: TrashItem[];
}

export interface BackupRecord {
  id: string;
  name: string;
  createdAt: string;
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
  body: string;
}

export type PublishStatus = 'preparing' | 'queued' | 'validating' | 'building' | 'switching' | 'succeeded' | 'failed';

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
  clipStorageBytes?: number;
  imageStorageBytes?: number;
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
  expiresAt?: number;
  lastUsedAt?: number;
  revokedAt?: number;
}

export interface ApiTokenCreation {
  token: string;
  record: ApiTokenRecord;
}

export interface AdminKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  role: AdminRole;
  permissions: AdminPermission[];
  createdAt: number;
  expiresAt?: number;
  lastUsedAt?: number;
  revokedAt?: number;
  createdByKeyId?: string;
}

export interface AdminKeyCreation {
  key: string;
  record: AdminKeyRecord;
}
