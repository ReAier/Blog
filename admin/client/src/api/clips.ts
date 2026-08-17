import type { ClipDocument, ClipPageResult, ClipSaveInput, PostDocument } from '../types';
import { endpoint, fileForm, queryString, request } from './transport';

export const clipsApi = {
  listClips: (options: { query?: string; language?: string; page?: number } = {}) => (
    request<ClipPageResult>(`/clips${queryString(options)}`)
  ),
  getClip: (slug: string) => request<ClipDocument>(`/clips/${encodeURIComponent(slug)}`),
  createClip: (input: ClipSaveInput) => request<ClipDocument>('/clips', { method: 'POST', body: input }),
  saveClip: (input: ClipSaveInput, revision: string) => request<ClipDocument>(
    `/clips/${encodeURIComponent(input.slug)}`,
    { method: 'PUT', body: input, revision },
  ),
  migrateClipSlug: (slug: string, newFile: string, revision: string) => request<ClipDocument>(
    `/clips/${encodeURIComponent(slug)}/migrate-slug`,
    { method: 'POST', revision, body: { newFile } },
  ),
  importClip: (file: File, fields: Record<string, string>) => request<ClipDocument>('/clips/import', {
    method: 'POST',
    rawBody: fileForm(file, fields),
  }),
  clipDownloadUrl: (slug: string) => endpoint(`/clips/${encodeURIComponent(slug)}/download`),
  attachClipToPost: (postSlug: string, clipSlug: string, postRevision: string, insertOffset: number) => (
    request<PostDocument>(`/posts/${encodeURIComponent(postSlug)}/clip-references`, {
      method: 'POST',
      body: { clipSlug, expectedPostRevision: postRevision, insertOffset },
    })
  ),
  removeClipFromPost: (postSlug: string, clipSlug: string, postRevision: string) => request<{ ok: true }>(
    `/posts/${encodeURIComponent(postSlug)}/clip-references/${encodeURIComponent(clipSlug)}`,
    { method: 'DELETE', body: { expectedPostRevision: postRevision } },
  ),
  deleteClip: (slug: string) => request<{ ok: true }>(
    `/clips/${encodeURIComponent(slug)}`,
    { method: 'DELETE' },
  ),
};
