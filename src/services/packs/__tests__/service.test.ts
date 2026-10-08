import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { createPackService, PackImportError, parsePackText, summarize } from '../service';

const res = (body: string, status = 200) =>
  ({ ok: status < 400, status, statusText: '', headers: { get: () => null }, text: async () => body }) as unknown as Response;

const pack = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: 'Mine',
    category: 'Custom',
    version: '1',
    items: [
      { title: 'One', body: 'echo 1', description: 'first' },
      { title: 'Two', body: 'echo 2', description: 'second' },
    ],
    ...over,
  });

function setup(responses: Record<string, string | number>) {
  const repos = createRepos(createTestDb());
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const r = responses[url];
    if (r === undefined) throw new TypeError('offline');
    return typeof r === 'number' ? res('', r) : res(r);
  }) as unknown as typeof fetch;
  return { repos, calls, service: createPackService(repos, { fetchImpl }) };
}

describe('parsePackText', () => {
  it('detects JSON packs and tldr pages, and rejects junk', () => {
    expect(parsePackText(pack()).source).toBe('url');
    expect(parsePackText('# ls\n\n> List.\n\n- List files:\n\n`ls -la`\n').source).toBe('tldr');
    expect(() => parsePackText('')).toThrow(/empty/);
    expect(() => parsePackText('{oops')).toThrow(/could not be parsed/);
    expect(() => parsePackText('{"name":"x"}')).toThrow(/Not a valid pack/);
    expect(() => parsePackText('hello world')).toThrow(/Unrecognised/);
  });
});

describe('pack service', () => {
  const URL1 = 'https://example.com/mine.json';

  it('imports a JSON pack from a URL', async () => {
    const { repos, service } = setup({ [URL1]: pack() });
    const r = await service.importFromUrl(URL1);
    expect(r).toMatchObject({ name: 'Mine', added: 2, created: true });
    expect(repos.packs.list()[0]).toMatchObject({ name: 'Mine', sourceUrl: URL1, category: 'Custom' });
    expect(repos.items.list().every((i) => i.source === 'url')).toBe(true);
    expect(summarize(r)).toBe('Mine: 2 added, 0 updated.');
  });

  it('imports a tldr page', async () => {
    const u = 'https://raw.githubusercontent.com/tldr-pages/tldr/main/pages/common/ls.md';
    const { repos, service } = setup({ [u]: '# ls\n\n> List directory contents.\n\n- List all files:\n\n`ls -la`\n' });
    await service.importFromUrl(u);
    expect(repos.items.list()[0]).toMatchObject({ source: 'tldr', body: 'ls -la', title: 'ls: List all files' });
    expect(repos.packs.categories()).toEqual(['tldr pages']);
  });

  it('fails gracefully when offline, on HTTP errors and on bad content, installing nothing', async () => {
    const { repos, service } = setup({ 'https://example.com/404': 404, 'https://example.com/bad': 'nonsense' });
    await expect(service.importFromUrl('https://example.com/down')).rejects.toMatchObject({ kind: 'network' });
    await expect(service.importFromUrl('https://example.com/404')).rejects.toMatchObject({ kind: 'http' });
    await expect(service.importFromUrl('https://example.com/bad')).rejects.toBeInstanceOf(PackImportError);
    await expect(service.importFromUrl('ftp://example.com')).rejects.toMatchObject({ kind: 'url' });
    expect(repos.packs.list()).toEqual([]);
  });

  it('refuses to overwrite an existing pack of the same name from a different source', async () => {
    const { repos, service } = setup({ [URL1]: pack({ name: 'Git' }) });
    repos.packs.apply({ name: 'Git', category: 'Daily', version: '1', items: [{ title: 'Stash', body: 'git stash', description: 'd' }] }, { source: 'builtin' });
    await expect(service.importFromUrl(URL1)).rejects.toThrow(/already installed \(built-in\)/);
    expect(repos.items.list().map((i) => i.title)).toEqual(['Stash']);
  });

  it('update merges new content and never touches user items or pin choices', async () => {
    const responses: Record<string, string | number> = { [URL1]: pack({ pinned: true }) };
    const { repos, service } = setup(responses);
    const { packId } = await service.importFromUrl(URL1);
    const one = repos.items.list().find((i) => i.title === 'One')!;
    repos.items.setPinned(one.id, false);
    const edited = repos.items.list().find((i) => i.title === 'Two')!;
    repos.items.update(edited.id, { title: 'Two', body: 'my version' });
    const mine = repos.items.create({ title: 'Personal', body: 'secret' });

    responses[URL1] = pack({
      version: '2',
      pinned: true,
      items: [
        { title: 'One', body: 'echo ONE', description: 'first v2' },
        { title: 'Two', body: 'echo TWO', description: 'second v2' },
        { title: 'Three', body: 'echo 3', description: 'new' },
      ],
    });
    const r = await service.updatePack(packId);
    expect(r).toMatchObject({ added: 1, updated: 1, skippedUser: 1, removed: 0 });
    expect(repos.items.get(one.id)).toMatchObject({ body: 'echo ONE', pinned: false });
    expect(repos.items.get(edited.id)).toMatchObject({ body: 'my version', source: 'user' });
    expect(repos.items.get(mine.id)).toMatchObject({ body: 'secret' });
    expect(repos.items.list().find((i) => i.title === 'Three')?.pinned).toBe(true);
    expect(summarize(r)).toContain('1 of your edited items kept');
  });

  it('update reports "up to date" when the version has not changed', async () => {
    const { service } = setup({ [URL1]: pack() });
    const { packId } = await service.importFromUrl(URL1);
    expect(await service.updatePack(packId)).toMatchObject({ upToDate: true });
  });

  it('update fails cleanly offline, for built-in packs, and when the file now names another pack', async () => {
    const responses: Record<string, string | number> = { [URL1]: pack() };
    const { repos, service } = setup(responses);
    const { packId } = await service.importFromUrl(URL1);
    delete responses[URL1];
    await expect(service.updatePack(packId)).rejects.toMatchObject({ kind: 'network' });
    expect(repos.items.list()).toHaveLength(2);

    responses[URL1] = pack({ name: 'Other', version: '9' });
    await expect(service.updatePack(packId)).rejects.toThrow(/Import it as a new pack/);

    const builtin = repos.packs.apply({ name: 'B', category: 'C', version: '1', items: [{ title: 'x', body: 'y', description: 'z' }] }, { source: 'builtin' });
    await expect(service.updatePack(builtin.packId)).rejects.toThrow(/updated with the app/);
    await expect(service.updatePack(9999)).rejects.toThrow(/no longer installed/);
  });
});
