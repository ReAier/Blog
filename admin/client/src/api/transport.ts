const API_BASE = '/api';
const csrfStorageKey = 'aier-admin-csrf';
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const csrfExemptPaths = new Set([
  '/auth/login',
]);
const transientGatewayStatuses = new Set([502, 503, 504]);
const retryableMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const transientRetryDelays = [300, 700, 1_500, 3_000] as const;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  revision?: string;
  rawBody?: BodyInit;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export class ApiConflictError<T = unknown> extends ApiError {
  readonly current?: T;
  readonly revision?: string;

  constructor(message: string, current?: T, revision?: string) {
    super(message, 409, current);
    this.name = 'ApiConflictError';
    this.current = current;
    this.revision = revision;
  }
}

export function endpoint(path: string) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function getCsrfToken(): string | undefined {
  try {
    return window.sessionStorage.getItem(csrfStorageKey) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setCsrfToken(value?: string): void {
  try {
    if (value) window.sessionStorage.setItem(csrfStorageKey, value);
    else window.sessionStorage.removeItem(csrfStorageKey);
  } catch {
    // Storage can be unavailable in privacy modes.
  }
}

async function readPayload(response: Response) {
  const type = response.headers.get('content-type') ?? '';
  if (response.status === 204) return undefined;
  if (type.includes('application/json')) return response.json();
  return response.text();
}

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function looksLikeHtml(value: string): boolean {
  return /<(?:!doctype|html|head|body|title|h1)\b/i.test(value);
}

function responseErrorMessage(payload: unknown, status: number): string {
  if (transientGatewayStatuses.has(status)) {
    return '后台服务正在重启，请稍候重试。';
  }
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (typeof payload === 'string') {
    const message = payload.trim();
    if (message && !looksLikeHtml(message) && message.length <= 500) return message;
  }
  return `请求失败（${status}）`;
}

async function fetchWithTransientRetry(
  path: string,
  init: RequestInit,
  method: string,
): Promise<Response> {
  const canRetry = retryableMethods.has(method);
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(endpoint(path), init);
      if (
        canRetry
        && transientGatewayStatuses.has(response.status)
        && attempt < transientRetryDelays.length
      ) {
        await response.body?.cancel().catch(() => undefined);
        await wait(transientRetryDelays[attempt]!);
        continue;
      }
      return response;
    } catch (error) {
      if (!canRetry || attempt >= transientRetryDelays.length) throw error;
      await wait(transientRetryDelays[attempt]!);
    }
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
  allowCsrfRecovery = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.rawBody;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  const revision = options.revision;
  if (revision) headers.set('If-Match', revision);
  const method = (options.method ?? 'GET').toUpperCase();
  if (unsafeMethods.has(method) && !csrfExemptPaths.has(path)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetchWithTransientRetry(path, {
    ...options,
    body,
    headers,
    credentials: 'same-origin',
  }, method);
  const payload = await readPayload(response);

  const errorCode = payload && typeof payload === 'object' && 'code' in payload
    ? String((payload as { code?: unknown }).code ?? '')
    : '';
  if (
    response.status === 403
    && errorCode === 'CSRF_REJECTED'
    && unsafeMethods.has(method)
    && options.rawBody === undefined
    && allowCsrfRecovery
  ) {
    await request<{ csrfToken?: string }>('/auth/session', {}, false);
    return request<T>(path, options, false);
  }

  if (response.status === 401) {
    setCsrfToken(undefined);
    window.dispatchEvent(new CustomEvent('admin:auth-required'));
  }

  if (response.status === 409) {
    const conflict = payload as {
      message?: string;
      current?: unknown;
      revision?: string;
      details?: { actualRevision?: string };
    } | undefined;
    throw new ApiConflictError(
      conflict?.message ?? '内容已被其他会话修改。',
      conflict?.current,
      conflict?.revision
        ?? conflict?.details?.actualRevision
        ?? response.headers.get('etag')
        ?? undefined,
    );
  }
  if (!response.ok) {
    throw new ApiError(
      responseErrorMessage(payload, response.status),
      response.status,
      typeof payload === 'string' && looksLikeHtml(payload) ? undefined : payload,
    );
  }
  if (payload && typeof payload === 'object' && 'csrfToken' in payload) {
    setCsrfToken(String((payload as { csrfToken?: string }).csrfToken ?? ''));
  }
  return payload as T;
}

export function queryString(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}

export function fileForm(file: File, fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append('file', file);
  return form;
}
