import type { BackupRecord, LogEntry, PageResult, PublishJob } from '../types';
import { endpoint, fileForm, queryString, request } from './transport';

export const operationsApi = {
  listBackups: () => request<BackupRecord[]>('/backups'),
  createBackup: () => request<BackupRecord>('/backups', { method: 'POST' }),
  validateStoredBackup: (id: string) => request<{
    id: string;
    manifest: { version: number; createdAt: string; files: unknown[] };
  }>(`/backups/${encodeURIComponent(id)}/validate`, { method: 'POST' }),
  validateBackup: (file: File) => request<{
    id: string;
    manifest: { version: number; createdAt: string; files: unknown[] };
  }>('/backups/validate', { method: 'POST', rawBody: fileForm(file, {}) }),
  applyBackup: (id: string) => request<{ snapshotPath: string; contentRoot: string }>(
    '/backups/apply',
    { method: 'POST', body: { id } },
  ),
  listPublishJobs: () => request<PublishJob[]>('/publish/jobs'),
  publish: () => request<PublishJob>('/publish', { method: 'POST' }),
  getPublishJob: (id: string) => request<PublishJob>(`/publish/jobs/${encodeURIComponent(id)}`),
  subscribePublishJob: (
    id: string,
    onJob: (job: PublishJob) => void,
    onError?: (error: Event) => void,
  ) => {
    const source = new EventSource(endpoint(`/publish/${encodeURIComponent(id)}/events`), {
      withCredentials: true,
    });
    source.addEventListener('publish', (event) => {
      onJob(JSON.parse((event as MessageEvent<string>).data) as PublishJob);
    });
    source.onerror = (event) => onError?.(event);
    return () => source.close();
  },
  listLogs: (options: { scope?: string; level?: string; cursor?: string } = {}) => (
    request<PageResult<LogEntry>>(`/logs${queryString(options)}`)
  ),
};
