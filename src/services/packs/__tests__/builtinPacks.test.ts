import fs from 'fs';
import path from 'path';

import { BUILTIN_PACKS } from '../../../../assets/packs';
import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { seedBuiltinPacks } from '../builtin';
import { BUILTIN_CATEGORIES } from '../categories';
import { extractVariables, hasBalancedBraces } from '../../template';
import { validatePack } from '../validate';

const PACK_DIR = path.join(__dirname, '../../../../assets/packs');
const files = fs.readdirSync(PACK_DIR).filter((f) => f.endsWith('.json')).sort();

describe('bundled starter packs', () => {
  it('has pack files and the index lists every one of them', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(BUILTIN_PACKS).toHaveLength(files.length);
    const indexed = BUILTIN_PACKS.map((p) => (p as { name: string }).name).sort();
    const onDisk = files.map((f) => JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), 'utf8')).name).sort();
    expect(indexed).toEqual(onDisk);
  });

  it.each(files)('%s matches the pack schema', (file) => {
    const raw = JSON.parse(fs.readFileSync(path.join(PACK_DIR, file), 'utf8'));
    const result = validatePack(raw, { requireDescriptions: true });
    if (!result.ok) throw new Error(`${file}:\n${result.errors.join('\n')}`);
    const { pack } = result;
    expect((BUILTIN_CATEGORIES as readonly string[]).includes(pack.category)).toBe(true);
    expect(pack.items.length).toBeGreaterThanOrEqual(10);
    expect(pack.items.length).toBeLessThanOrEqual(30);
    for (const item of pack.items) {
      expect(['snippet', 'command', 'checklist']).toContain(item.type ?? 'snippet');
      expect(hasBalancedBraces(item.body)).toBe(true);
      expect(item.body).not.toMatch(/^\s|\s$/);
      expect(item.body).not.toMatch(/\\['"]?$/); // stray trailing backslash from an escaping mistake
      expect(item.description).not.toMatch(/\n/);
      extractVariables(item.body); // must not throw
    }
  });

  it('has unique pack names and only Study & Career is pinned', () => {
    const packs = BUILTIN_PACKS.map((p) => p as { name: string; category: string; pinned?: boolean });
    expect(new Set(packs.map((p) => p.name)).size).toBe(packs.length);
    const pinned = packs.filter((p) => p.pinned === true).map((p) => p.name);
    expect(pinned).toEqual(['Study & Career']);
  });

  it('covers every category', () => {
    const cats = new Set(BUILTIN_PACKS.map((p) => (p as { category: string }).category));
    for (const c of BUILTIN_CATEGORIES) expect(cats.has(c)).toBe(true);
  });

  it('Study & Career loads with every item pinned, and an unpinned item stays unpinned after a pack update', () => {
    const repos = createRepos(createTestDb());
    const result = seedBuiltinPacks(repos, BUILTIN_PACKS);
    expect(result.invalid).toEqual([]);

    const pack = repos.packs.findByName('Study & Career');
    expect(pack).not.toBeNull();
    expect(pack!.pinnedDefault).toBe(true);
    const items = repos.items.list({ category: 'Study & Career' });
    expect(items.length).toBe(pack!.itemCount);
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items.every((i) => i.pinned && i.source === 'builtin')).toBe(true);
    expect(repos.items.pinned().map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());

    // Other packs are not pinned.
    expect(repos.items.list({ category: 'Daily dev work' }).some((i) => i.pinned)).toBe(false);

    // User unpins one item; a pack update (new version) must not re-pin it.
    repos.items.setPinned(items[0].id, false);
    const bundled = BUILTIN_PACKS.map((p) =>
      (p as { name: string }).name === 'Study & Career' ? { ...(p as object), version: 'next' } : p,
    );
    const second = seedBuiltinPacks(repos, bundled);
    expect(second.updated).toEqual(['Study & Career']);
    expect(repos.items.get(items[0].id)!.pinned).toBe(false);
    expect(repos.items.list({ category: 'Study & Career' }).filter((i) => i.pinned)).toHaveLength(items.length - 1);
  });

  it('installs all packs and makes them searchable', () => {
    const repos = createRepos(createTestDb());
    const result = seedBuiltinPacks(repos, BUILTIN_PACKS);
    expect(result.installed).toHaveLength(files.length);
    expect(repos.items.count()).toBeGreaterThan(100);
    expect(repos.items.search('rebase').length).toBeGreaterThan(0);
  });
});
