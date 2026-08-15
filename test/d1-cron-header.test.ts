import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDb, SOURCE_HEADER } from '../src/abstraction/d1';

describe('SOURCE_HEADER', () => {
  it('uses X-Kbox-Source as the outbound source marker', () => {
    expect(SOURCE_HEADER).toBe('X-Kbox-Source');
  });
});

describe('createDb source header propagation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds the source marker header when a non-default source is provided', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const db = createDb('token', 'https://ocean.klinux.dpdns.org', 'cron');
    await db.query('SELECT 1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ocean.klinux.dpdns.org/query');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Kbox-Source']).toBe('cron');
    expect(headers['Authorization']).toBe('Bearer token');
  });

  it('marks monitor source requests', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const db = createDb('token', 'https://ocean.klinux.dpdns.org', 'monitor');
    await db.query('SELECT 1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Kbox-Source']).toBe('monitor');
  });

  it('defaults source to default', async () => {
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
    expect(headers['X-Kbox-Source']).toBe('default');
  });
});