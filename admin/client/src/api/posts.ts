import type {
  PostDocument,
  PostHistoryEntry,
  PostHistoryRevision,
  PostPageResult,
  PostSaveInput,
  PreviewResponse,
} from '../types';
import { endpoint, fileForm, queryString, request } from './transport';

const manualHistoryHeaders = (historyGroup?: string) => historyGroup ? {
  'X-History-Mode': 'manual',
  'X-History-Group': historyGroup,
} : undefined;

export const postsApi = {
  listPosts: (options: { query?: string; status?: string; tags?: string; page?: number; includeDeleted?: boolean } = {}) => (
    request<PostPageResult>(`/posts${queryString(options)}`)
  ),
  getPost: (slug: string) => request<PostDocument>(`/posts/${encodeURIComponent(slug)}`),
  createPost: (input: PostSaveInput, historyGroup?: string) => request<PostDocument>('/posts', {
    method: 'POST',
    body: input,
    headers: manualHistoryHeaders(historyGroup),
  }),
  savePost: (input: PostSaveInput, revision: string, historyGroup?: string) => (
    request<PostDocument>(`/posts/${encodeURIComponent(input.slug)}`, {
      method: 'PUT',
      body: input,
      revision,
      headers: manualHistoryHeaders(historyGroup),
    })
  ),
  deletePost: (slug: string, revision: string) => request<PostDocument>(
    `/posts/${encodeURIComponent(slug)}`,
    { method: 'DELETE', revision },
  ),
  restorePost: (slug: string, revision: string) => request<PostDocument>(
    `/posts/${encodeURIComponent(slug)}/restore`,
    { method: 'POST', revision },
  ),
  migratePostSlug: (slug: string, newSlug: string, revision: string) => request<PostDocument>(
    `/posts/${encodeURIComponent(slug)}/migrate-slug`,
    { method: 'POST', revision, body: { newSlug } },
  ),
  importPost: (file: File) => request<PostDocument>('/posts/import', {
    method: 'POST',
    rawBody: fileForm(file, {}),
  }),
  postDownloadUrl: (slug: string) => endpoint(`/posts/${encodeURIComponent(slug)}/download`),
  listPostHistory: (slug: string) => request<PostHistoryEntry[]>(`/posts/${encodeURIComponent(slug)}/history`),
  getPostHistoryRevision: (slug: string, revisionNumber: number) => request<PostHistoryRevision>(
    `/posts/${encodeURIComponent(slug)}/history/${revisionNumber}`,
  ),
  restorePostHistory: (slug: string, revisionNumber: number, revision: string) => request<PostDocument>(
    `/posts/${encodeURIComponent(slug)}/history/${revisionNumber}/restore`,
    { method: 'POST', revision },
  ),
  previewInstant: (markdown: string) => request<PreviewResponse>(
    '/previews/instant',
    { method: 'POST', body: { markdown } },
  ),
};
