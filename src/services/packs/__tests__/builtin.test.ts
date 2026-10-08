import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { seedBuiltinPacks, seedBuiltinPacksAsync } from '../builtin';

const mk = (version: string, extra: unknown[] = []) => ({
  name: 'Study',
  category: 'Study & Career',
  version,
  pinned: true,
  items: [{ title: 'A', body: 'a', description: 'd' }, ...extra],
});

describe('seedBuiltinPacks', () => {
  it('installs on first launch, is a no-op on the second, and honours removal', () => {
    const repos = createRepos(createTestDb());
    expect(seedBuiltinPacks(repos, [mk('1')])).toMatchObject({ installed: ['Study'], updated: [], invalid: [] });
    expect(repos.items.pinned()).toHaveLength(1);
    expect(seedBuiltinPacks(repos, [mk('1')])).toMatchObject({ installed: [], updated: [] });

    repos.packs.remove(repos.packs.findByName('Study')!.id);
    expect(seedBuiltinPacks(repos, [mk('1')])).toMatchObject({ installed: [] });
    expect(repos.packs.list()).toEqual([]);
  });

  it('applies a newer bundled version without re-pinning an unpinned item', () => {
    const repos = createRepos(createTestDb());
    seedBuiltinPacks(repos, [mk('1')]);
    const a = repos.items.list()[0];
    repos.items.setPinned(a.id, false);
    const r = seedBuiltinPacks(repos, [mk('2', [{ title: 'B', body: 'b', description: 'd' }])]);
    expect(r.updated).toEqual(['Study']);
    expect(repos.items.get(a.id)!.pinned).toBe(false);
    expect(repos.items.list().find((i) => i.title === 'B')!.pinned).toBe(true);
  });

  it('reports invalid bundled packs instead of throwing', () => {
    const repos = createRepos(createTestDb());
    const r = seedBuiltinPacks(repos, [{ name: 'Broken', items: [] }, mk('1')]);
    expect(r.invalid).toEqual(['Broken']);
    expect(r.installed).toEqual(['Study']);
  });
});

describe('seedBuiltinPacksAsync', () => {
  const pack = (name: string) => ({ name, category: 'Reference', version: '1', items: [{ title: 'A', body: 'a', description: 'd' }] });

  it('installs every pack, reports progress after each one and yields between them', async () => {
    const repos = createRepos(createTestDb());
    const progress: string[] = [];
    let ticks = 0;
    const timer = setInterval(() => ticks++, 0); // only advances if the seeder yields to the event loop
    const result = await seedBuiltinPacksAsync(repos, [pack('P1'), pack('P2'), pack('P3')], (p) =>
      progress.push(`${p.done}/${p.total}`),
    );
    clearInterval(timer);
    expect(result.installed).toEqual(['P1', 'P2', 'P3']);
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
    expect(ticks).toBeGreaterThan(0);
    expect(repos.packs.list()).toHaveLength(3);
  });

  it('does nothing, quickly and without progress, once installed', async () => {
    const repos = createRepos(createTestDb());
    await seedBuiltinPacksAsync(repos, [pack('P1'), pack('P2')]);
    const onProgress = jest.fn();
    const again = await seedBuiltinPacksAsync(repos, [pack('P1'), pack('P2')], onProgress);
    expect(again).toEqual({ installed: [], updated: [], invalid: [] });
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('keeps going after an invalid pack', async () => {
    const repos = createRepos(createTestDb());
    const result = await seedBuiltinPacksAsync(repos, [{ name: 'Bad' }, pack('Good')]);
    expect(result).toMatchObject({ installed: ['Good'], invalid: ['Bad'] });
  });
});
