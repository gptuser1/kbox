import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDb, CRON_REQUEST_HEADERS, CRON_REQUEST_HEADER, MONITOR_REQUEST_HEADERS, MONITOR_REQUEST_HEADER } from '../src/abstraction/d1';

describe('CRON_REQUEST_HEADERS', () => {
  it('marks requests as kbox cron jobs', () => {
    expect(CRON_REQUEST_HEADER).toBe('X-Kbox-Cron');
    expect(CRON_REQUEST_HEADERS).toEqual({ 'X-Kbox-Cron': '1' });
  });
});

describe('MONITOR_REQUEST_HEADERS', () => {
  it('marks requests as kbox sys-monitor reports', () => {
    expect(MONITOR_REQUEST_HEADER).toBe('X-Kbox-Monitor');
    expect(MONITOR_REQUEST_HEADERS).toEqual({ 'X-Kbox-Monitor': '1' });
  });
});

describe('createDb cron header propagation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds the cron marker header when extraHeaders is provided', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const db = createDb('token', 'https://ocean.klinux.dpdns.org', CRON_REQUEST_HEADERS);
    await db.query('SELECT 1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ocean.klinux.dpdns.org/query');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Kbox-Cron']).toBe('1');
    expect(headers['Authorization']).toBe('Bearer token');
  });

  it('does not add the cron marker header by default', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const db = createDb('token', 'https://ocean.klinux.dpdns.org');
    await db.query('SELECT 1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Kbox-Cron']).toBeUndefined();
  });
});