import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { seedBuiltinPacks } from '../builtin';

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
