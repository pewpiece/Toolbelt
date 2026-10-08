export class PackFetchError extends Error {
  readonly kind: 'url' | 'network' | 'timeout' | 'http' | 'size';
  constructor(kind: PackFetchError['kind'], message: string) {
    super(message);
    this.name = 'PackFetchError';
    this.kind = kind;
  }
}

export const MAX_BYTES = 1_000_000;
export const TIMEOUT_MS = 15_000;

/** Turns a github.com "blob" page URL into the raw file URL; leaves other URLs alone. */
export function normalizePackUrl(input: string): string {
  const url = input.trim();
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url;
}

export function assertHttpsUrl(input: string): string {
  const url = normalizePackUrl(input);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PackFetchError('url', 'That is not a valid URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new PackFetchError('url', 'Only https:// URLs are supported.');
  }
  return url;
}

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Downloads text with a timeout and a size cap. Never throws anything but PackFetchError. */
export async function fetchText(input: string, opts: FetchOptions = {}): Promise<string> {
  const url = assertHttpsUrl(input);
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? TIMEOUT_MS);

  try {
    const res = await doFetch(url, { signal: controller.signal, headers: { Accept: 'application/json, text/markdown, text/plain, */*' } });
    if (!res.ok) throw new PackFetchError('http', `The server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) throw new PackFetchError('size', 'That file is too large (over 1 MB).');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new PackFetchError('size', 'That file is too large (over 1 MB).');
    return text;
  } catch (e) {
    if (e instanceof PackFetchError) throw e;
    if (timedOut) throw new PackFetchError('timeout', 'The request timed out. Check your connection and try again.');
    throw new PackFetchError('network', 'Could not reach the server. Check your connection and the URL.');
  } finally {
    clearTimeout(timer);
  }
}
