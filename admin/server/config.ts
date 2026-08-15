export interface AdminConfig {
  projectRoot: string;
  contentRoot: string;
  dataRoot: string;
  statePath: string;
  historyRoot: string;
  trashRoot: string;
  jobsRoot: string;
  previewsRoot: string;
  clientRoot: string;
  publicOrigin: string;
  secureCookies: boolean;
  host: string;
  port: number;
  masterKey?: Buffer;
}

export function createAdminConfig(overrides: Partial<AdminConfig> = {}): AdminConfig {
  const projectRoot = overrides.projectRoot ?? process.cwd();
  const dataRoot = overrides.dataRoot ?? process.env.BLOG_ADMIN_DATA_ROOT ?? (process.env.NODE_ENV === 'production' ? '/var/lib/aier-blog' : `${projectRoot}/.admin-data`);
  const contentRoot = overrides.contentRoot ?? process.env.BLOG_CONTENT_ROOT ?? `${projectRoot}/src/content`;
  const keyText = process.env.ADMIN_MASTER_KEY;
  const masterKey = overrides.masterKey ?? (keyText ? Buffer.from(keyText, /^[a-f0-9]{64}$/i.test(keyText) ? 'hex' : 'base64') : undefined);
  return {
    projectRoot,
    contentRoot,
    dataRoot,
    statePath: overrides.statePath ?? `${dataRoot}/state/admin.sqlite`,
    historyRoot: overrides.historyRoot ?? `${dataRoot}/history/blobs`,
    trashRoot: overrides.trashRoot ?? `${dataRoot}/trash`,
    jobsRoot: overrides.jobsRoot ?? `${dataRoot}/jobs`,
    previewsRoot: overrides.previewsRoot ?? `${dataRoot}/previews`,
    clientRoot: overrides.clientRoot ?? `${projectRoot}/admin/client/dist`,
    publicOrigin: overrides.publicOrigin ?? process.env.ADMIN_PUBLIC_ORIGIN ?? 'https://admin.blog.reaier.top',
    secureCookies: overrides.secureCookies ?? process.env.NODE_ENV === 'production',
    host: overrides.host ?? process.env.ADMIN_HOST ?? '127.0.0.1',
    port: overrides.port ?? Number(process.env.ADMIN_PORT ?? 4310),
    masterKey,
  };
}
