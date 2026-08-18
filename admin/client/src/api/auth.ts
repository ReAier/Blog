import type {
  AdminKeyCreation,
  AdminKeyRecord,
  AdminPermission,
  AdminRole,
  ApiTokenCreation,
  ApiTokenRecord,
  ApiTokenScope,
  DashboardSnapshot,
  SessionUser,
} from '../types';
import { request, setCsrfToken } from './transport';

export const authApi = {
  session: () => request<SessionUser>('/auth/session'),
  login: (input: { key: string }) => request<SessionUser>('/auth/login', { method: 'POST', body: input }),
  logout: async () => {
    await request<void>('/auth/logout', { method: 'POST' });
    setCsrfToken(undefined);
  },
  dashboard: () => request<DashboardSnapshot>('/dashboard'),
  listApiTokens: () => request<ApiTokenRecord[]>('/auth/ai-keys'),
  createApiToken: (input: { name: string; scopes: ApiTokenScope[]; expiresInDays: 7 | 30 | 365 | null }) => (
    request<ApiTokenCreation>('/auth/ai-keys', { method: 'POST', body: input })
  ),
  updateApiToken: (id: string, input: Partial<{ name: string; scopes: ApiTokenScope[]; expiresAt: number | null }>) => (
    request<ApiTokenRecord>(`/auth/ai-keys/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
  ),
  revokeApiToken: (id: string) => request<{ ok: true }>(`/auth/ai-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listAdminKeys: () => request<AdminKeyRecord[]>('/auth/admin-keys'),
  adminKeyOptions: () => request<{ permissions: AdminPermission[]; roles: Record<Exclude<AdminRole, 'custom'>, AdminPermission[]> }>('/auth/admin-key-options'),
  createAdminKey: (input: { name: string; role: AdminRole; permissions: AdminPermission[]; expiresInDays: 7 | 30 | 365 | null }) => (
    request<AdminKeyCreation>('/auth/admin-keys', { method: 'POST', body: input })
  ),
  updateAdminKey: (id: string, input: Partial<Pick<AdminKeyRecord, 'name' | 'role' | 'permissions' | 'expiresAt'>>) => (
    request<AdminKeyRecord>(`/auth/admin-keys/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
  ),
  revokeAdminKey: (id: string) => request<{ ok: true; self: boolean }>(`/auth/admin-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
