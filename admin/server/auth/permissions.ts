import type { AdminPermission } from './admin-keys';

export function requiredAdminPermission(method: string, route: string): AdminPermission | undefined {
  if (route === '/api/dashboard') return 'dashboard:read';
  if (route.startsWith('/api/auth/ai-keys')) return method === 'GET' ? 'ai-keys:read' : method === 'POST' ? 'ai-keys:create' : method === 'PATCH' ? 'ai-keys:update' : 'ai-keys:revoke';
  if (route === '/api/auth/admin-key-options') return 'admin-keys:read';
  if (route.startsWith('/api/auth/admin-keys')) return method === 'GET' ? 'admin-keys:read' : method === 'POST' ? 'admin-keys:create' : method === 'PATCH' ? 'admin-keys:update' : 'admin-keys:revoke';
  if (route.startsWith('/api/trash')) return method === 'GET' ? 'trash:read' : method === 'DELETE' ? 'trash:purge' : 'trash:restore';
  if (route.startsWith('/api/backups')) {
    if (method === 'GET') return route.includes('download') || route.endsWith('/export') ? 'backups:download' : 'backups:read';
    if (route.endsWith('/apply')) return 'backups:apply';
    if (route.includes('validate')) return 'backups:validate';
    return 'backups:create';
  }
  if (route.startsWith('/api/publish')) return method === 'GET' ? 'publish:read' : 'publish:run';
  if (route === '/api/logs') return 'logs:read';
  if (route.startsWith('/api/previews')) return 'preview:render';
  if (route.startsWith('/api/images')) {
    if (method === 'GET') return 'images:read';
    if (method === 'DELETE') return 'images:delete';
    if (route.endsWith('/restore')) return 'trash:restore';
    return 'images:upload';
  }
  if (route.startsWith('/api/clips') || route.includes('/clip-references') || route.includes('/clips/')) {
    if (method === 'GET') return route.endsWith('/download') ? 'clips:download' : 'clips:read';
    if (route.includes('migrate-slug')) return 'clips:slug:update';
    if (route.includes('clip-references') || route.includes('/clips/')) return 'clips:link';
    if (method === 'POST' && route.endsWith('/import')) return 'clips:import';
    if (method === 'POST') return 'clips:create';
    if (method === 'DELETE') return 'clips:delete';
    return 'clips:update';
  }
  if (route.startsWith('/api/posts')) {
    if (route.includes('/history') && route.endsWith('/restore')) return 'posts:history:restore';
    if (route.endsWith('/restore')) return 'trash:restore';
    if (method === 'GET') {
      if (route.endsWith('/download')) return 'posts:download';
      if (route.includes('/history')) return 'posts:history:read';
      return 'posts:read';
    }
    if (route.includes('migrate-slug')) return 'posts:slug:update';
    if (method === 'POST' && route.endsWith('/import')) return 'posts:import';
    if (method === 'POST') return 'posts:create';
    if (method === 'DELETE') return 'posts:delete';
    return 'posts:update';
  }
  return undefined;
}
