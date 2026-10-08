import { assertHttpsUrl, fetchText, normalizePackUrl, PackFetchError } from '../fetch';

const okResponse = (body: string, init: { status?: number; headers?: Record<string, string> } = {}) =>
  ({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    statusText: init.status === 404 ? 'Not Found' : '',
    headers: { get: (k: string) => init.headers?.[k.toLowerCase()] ?? null },
    text: async () => body,
  }) as unknown as Response;

describe('pack fetching', () => {
  it('rewrites GitHub blob URLs to raw URLs', () => {
    expect(normalizePackUrl('https://github.com/me/repo/blob/main/packs/a.json')).toBe(
      'https://raw.githubusercontent.com/me/repo/main/packs/a.json',
    );
    expect(normalizePackUrl(' https://example.com/a.json ')).toBe('https://example.com/a.json');
  });

  it('rejects non-https and malformed URLs', () => {
    expect(() => assertHttpsUrl('http://example.com/a.json')).toThrow(/https/);
    expect(() => assertHttpsUrl('not a url')).toThrow(/valid URL/);
    expect(() => assertHttpsUrl('')).toThrow(PackFetchError);
  });

  it('returns the body on success', async () => {
    const fetchImpl = jest.fn(async () => okResponse('hello'));
    await expect(fetchText('https://example.com/x', { fetchImpl })).resolves.toBe('hello');
  });

  it('turns HTTP errors, network errors and oversize bodies into friendly PackFetchErrors', async () => {
    await expect(fetchText('https://example.com/x', { fetchImpl: async () => okResponse('', { status: 404 }) })).rejects.toMatchObject({ kind: 'http', message: expect.stringContaining('404') });
    await expect(
      fetchText('https://example.com/x', {
        fetchImpl: async () => {
          throw new TypeError('Network request failed');
        },
      }),
    ).rejects.toMatchObject({ kind: 'network' });
    await expect(fetchText('https://example.com/x', { fetchImpl: async () => okResponse('', { headers: { 'content-length': '5000000' } }) })).rejects.toMatchObject({ kind: 'size' });
    await expect(fetchText('https://example.com/x', { fetchImpl: async () => okResponse('x'.repeat(1_000_001)) })).rejects.toMatchObject({ kind: 'size' });
  });

  it('times out a hanging request', async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    await expect(fetchText('https://example.com/x', { fetchImpl, timeoutMs: 20 })).rejects.toMatchObject({ kind: 'timeout' });
  });
});
