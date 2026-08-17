import type { TrashItemType, TrashResult } from '../types';
import { request } from './transport';

export const trashApi = {
  listTrash: () => request<TrashResult>('/trash'),
  deleteTrashItem: (type: TrashItemType, id: string) => request<{ ok: true }>(
    `/trash/${type}/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  ),
  restoreTrashItem: (type: TrashItemType, id: string) => request<{ ok: true }>(
    `/trash/${type}/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
  ),
};
