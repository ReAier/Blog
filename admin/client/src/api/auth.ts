import type {
  AdminSetupChallenge,
  AdminSetupConfirmation,
  AdminSetupStatus,
  ApiTokenCreation,
  ApiTokenRecord,
  ApiTokenScope,
  DashboardSnapshot,
  SessionUser,
} from '../types';
import { request, setCsrfToken } from './transport';

export const authApi = {
  setupStatus: () => request<AdminSetupStatus>('/auth/setup/status'),
  beginSetup: (input: { token: string; username: string; password: string }) => (
    request<AdminSetupChallenge>('/auth/setup/begin', { method: 'POST', body: input })
  ),
  confirmSetup: (input: { challenge: string; totpCode: string }) => (
    request<AdminSetupConfirmation>('/auth/setup/confirm', { method: 'POST', body: input })
  ),
  session: () => request<SessionUser>('/auth/session'),
  login: (input: { username: string; password: string; totp?: string; recoveryCode?: string }) => (
    request<SessionUser>('/auth/login', { method: 'POST', body: input })
  ),
  logout: async () => {
    await request<void>('/auth/logout', { method: 'POST' });
    setCsrfToken(undefined);
  },
  dashboard: () => request<DashboardSnapshot>('/dashboard'),
  listApiTokens: () => request<ApiTokenRecord[]>('/auth/tokens'),
  createApiToken: (input: { name: string; scopes: ApiTokenScope[]; expiresInDays: number }) => (
    request<ApiTokenCreation>('/auth/tokens', { method: 'POST', body: input })
  ),
  revokeApiToken: (id: string) => request<{ ok: true }>(
    `/auth/tokens/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  ),
};
