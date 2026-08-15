// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../admin/client/src/api/client';

function response(body: string, status: number, contentType: string) {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('admin API transient upstream recovery', () => {
  it('retries idempotent GET requests when Nginx temporarily returns 502 HTML', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response('<html><h1>502 Bad Gateway</h1></html>', 502, 'text/html'))
      .mockResolvedValueOnce(response('[]', 200, 'application/json'));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = api.listPublishJobs();
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows a concise restart message instead of rendering an HTML gateway page', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      response('<html><head><title>502 Bad Gateway</title></head><body>nginx</body></html>', 502, 'text/html'),
    ));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = api.listPublishJobs();
    const rejection = expect(resultPromise).rejects.toMatchObject({
      status: 502,
      message: '后台服务正在重启，请稍候重试。',
    });
    await vi.runAllTimersAsync();

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('does not retry unsafe publish requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response('<html><h1>502 Bad Gateway</h1></html>', 502, 'text/html'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.publish()).rejects.toMatchObject({
      status: 502,
      message: '后台服务正在重启，请稍候重试。',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
describe('admin API CSRF recovery', () => {
  it('refreshes the session token and retries an unsafe request once after CSRF rejection', async () => {
    sessionStorage.setItem('aier-admin-csrf', 'stale-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(
        JSON.stringify({ code: 'CSRF_REJECTED', message: 'Invalid CSRF token.' }),
        403,
        'application/json',
      ))
      .mockResolvedValueOnce(response(
        JSON.stringify({ username: 'owner', csrfToken: 'fresh-token' }),
        200,
        'application/json',
      ))
      .mockResolvedValueOnce(response(
        JSON.stringify({ id: 'publish-1', status: 'queued' }),
        200,
        'application/json',
      ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.publish()).resolves.toMatchObject({ id: 'publish-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/session');
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('X-CSRF-Token'))
      .toBe('fresh-token');
  });
});


describe('admin API authentication expiry', () => {
  it('clears cached CSRF state and broadcasts an authentication event on 401', async () => {
    sessionStorage.setItem('aier-admin-csrf', 'expired-token');
    const listener = vi.fn();
    window.addEventListener('admin:auth-required', listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(
      JSON.stringify({ code: 'AUTH_REQUIRED', message: 'Authentication is required.' }),
      401,
      'application/json',
    )));

    await expect(api.listPublishJobs()).rejects.toMatchObject({ status: 401 });

    expect(sessionStorage.getItem('aier-admin-csrf')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('admin:auth-required', listener);
  });
});
