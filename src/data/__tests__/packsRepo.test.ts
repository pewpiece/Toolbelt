import { createRepos } from '..';
import type { PackDef } from '../types';
import { createTestDb } from '@/db/testing';

function setup() {
  let t = 5000;
  return createRepos(createTestDb(), () => ++t);
}

const basePack = (over: Partial<PackDef> = {}): PackDef => ({
  name: 'Git',
  category: 'Daily dev work',
  version: '1',
  items: [
    { title: 'Undo commit', body: 'git reset --soft HEAD~1', description: 'Undo last commit', type: 'command', language: 'bash', tags: ['git'] },
    { title: 'Stash', body: 'git stash', description: 'Stash changes', type: 'command' },
  ],
  ...over,
});

describe('packs repository', () => {
  it('installs a pack with builtin items and a category', () => {
    const r = setup();
    const res = r.packs.apply(basePack(), { source: 'builtin' });
    expect(res).toMatchObject({ created: true, added: 2, updated: 0, removed: 0 });
    const items = r.items.list({ category: 'Daily dev work' });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.source === 'builtin' && !i.pinned)).toBe(true);
    expect(r.packs.categories()).toEqual(['Daily dev work']);
    expect(r.packs.list()[0]).toMatchObject({ name: 'Git', itemCount: 2 });
  });

  it('inserts items pinned when the pack is pinned', () => {
    const r = setup();
    r.packs.apply(basePack({ name: 'Study', pinned: true }), { source: 'builtin' });
    expect(r.items.list().every((i) => i.pinned)).toBe(true);
    expect(r.items.pinned()).toHaveLength(2);
  });

  it('refresh updates content but never touches user items', () => {
    const r = setup();
    const { packId } = r.packs.apply(basePack(), { source: 'builtin' });
    const mine = r.items.create({ title: 'My own', body: 'mine', tags: ['keep'] });
    r.items.setPinned(mine.id, true);

    // The user also edits a pack item: it becomes theirs and must survive a refresh intact.
    const undo = r.items.list().find((i) => i.title === 'Undo commit')!;
    const edited = r.items.update(undo.id, { title: 'Undo commit', body: 'MY VERSION', tags: ['mine'] });
    expect(edited.source).toBe('user');

    const res = r.packs.apply(
      basePack({
        version: '2',
        items: [
          { title: 'Undo commit', body: 'pack version', description: 'x' },
          { title: 'Stash', body: 'git stash -u', description: 'Stash incl. untracked' },
        ],
      }),
      { source: 'builtin' },
    );
    expect(res).toMatchObject({ created: false, added: 0, updated: 1, skippedUser: 1 });
    expect(r.items.get(mine.id)).toMatchObject({ body: 'mine', pinned: true, source: 'user' });
    expect(r.items.get(undo.id)).toMatchObject({ body: 'MY VERSION', source: 'user', tags: ['mine'] });
    expect(r.items.list().filter((i) => i.title === 'Undo commit')).toHaveLength(1);
    expect(r.items.list().find((i) => i.title === 'Stash')?.body).toBe('git stash -u');
    expect(r.packs.get(packId)?.version).toBe('2');
  });

  it('refresh never deletes user items even when the pack drops that title', () => {
    const r = setup();
    r.packs.apply(basePack(), { source: 'builtin' });
    const stash = r.items.list().find((i) => i.title === 'Stash')!;
    r.items.update(stash.id, { title: 'Stash', body: 'edited' });
    const res = r.packs.apply(basePack({ items: [basePack().items[0]] }), { source: 'builtin' });
    expect(res.removed).toBe(0);
    expect(r.items.get(stash.id)).not.toBeNull();
  });

  it('refresh removes non-user items that left the pack', () => {
    const r = setup();
    r.packs.apply(basePack(), { source: 'builtin' });
    const res = r.packs.apply(basePack({ items: [basePack().items[0]] }), { source: 'builtin' });
    expect(res).toMatchObject({ removed: 1, added: 0 });
    expect(r.items.list().map((i) => i.title)).toEqual(['Undo commit']);
    expect(r.items.search('stash')).toHaveLength(0);
  });

  it('refresh keeps pin state, use_count and last_used_at (an unpinned item is not re-pinned)', () => {
    const r = setup();
    r.packs.apply(basePack({ name: 'Study', pinned: true }), { source: 'builtin' });
    const item = r.items.list()[0];
    r.items.setPinned(item.id, false);
    r.items.recordCopy(item.id);
    r.packs.apply(basePack({ name: 'Study', pinned: true, version: '2' }), { source: 'builtin' });
    const after = r.items.get(item.id)!;
    expect(after.pinned).toBe(false);
    expect(after.useCount).toBe(1);
    expect(after.lastUsedAt).not.toBeNull();
    // ...while a brand new entry added by the update follows the pack default.
    r.packs.apply(
      basePack({
        name: 'Study',
        pinned: true,
        version: '3',
        items: [...basePack().items, { title: 'New one', body: 'n', description: 'd' }],
      }),
      { source: 'builtin' },
    );
    expect(r.items.list().find((i) => i.title === 'New one')?.pinned).toBe(true);
    expect(r.items.get(item.id)!.pinned).toBe(false);
  });

  it('keeps the search index in sync through refresh', () => {
    const r = setup();
    r.packs.apply(basePack(), { source: 'builtin' });
    r.packs.apply(
      basePack({ items: [{ title: 'Undo commit', body: 'git revert HEAD', description: 'Safe undo', tags: ['safe'] }] }),
      { source: 'builtin' },
    );
    expect(r.items.search('revert')).toHaveLength(1);
    expect(r.items.search('reset')).toHaveLength(0);
    expect(r.items.search('safe')).toHaveLength(1);
  });

  it('removing a pack deletes its pack items but keeps user items', () => {
    const r = setup();
    const { packId } = r.packs.apply(basePack(), { source: 'builtin' });
    const stash = r.items.list().find((i) => i.title === 'Stash')!;
    r.items.update(stash.id, { title: 'Stash', body: 'edited' });
    r.packs.remove(packId);
    expect(r.packs.list()).toEqual([]);
    expect(r.items.list().map((i) => i.title)).toEqual(['Stash']);
    expect(r.items.get(stash.id)?.packId).toBeNull();
  });

  it('rolls back the whole refresh if an entry is invalid', () => {
    const r = setup();
    r.packs.apply(basePack(), { source: 'builtin' });
    expect(() =>
      r.packs.apply(
        basePack({ version: '2', items: [{ title: 'Undo commit', body: 'changed', description: '' }, { title: '', body: 'x', description: '' }] }),
        { source: 'builtin' },
      ),
    ).toThrow();
    expect(r.items.list().find((i) => i.title === 'Undo commit')?.body).toBe('git reset --soft HEAD~1');
    expect(r.packs.list()[0].version).toBe('1');
  });
});
