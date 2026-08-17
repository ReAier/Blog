import type { ImageAsset, PageResult } from '../types';
import { fileForm, queryString, request } from './transport';

export const imagesApi = {
  listImages: (options: { query?: string; page?: number } = {}) => (
    request<PageResult<ImageAsset>>(`/images${queryString(options)}`)
  ),
  uploadImage: (file: File) => request<ImageAsset>('/images', {
    method: 'POST',
    rawBody: fileForm(file, {}),
  }),
  deleteImage: (id: string) => request<{ ok: boolean; trashId?: string }>(
    `/images/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  ),
  restoreImage: (trashId: string) => request<ImageAsset | { ok: true }>(
    `/images/${encodeURIComponent(trashId)}/restore`,
    { method: 'POST' },
  ),
};
