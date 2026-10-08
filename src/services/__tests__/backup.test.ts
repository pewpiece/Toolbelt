import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { BackupError, backupFileName, createBackupJson, describeRestore, parseBackup, restoreBackup } from '../backup';

function populated() {
  const repos = createRepos(createTestDb());
  repos.packs.apply(
    {
      name: 'Git',
      category: 'Daily dev work',
      version: '3',
      pinned: true,
      items: [
        { title: 'Stash', body: 'git stash', description: 'Save work', type: 'command', language: 'bash', tags: ['git'] },
        { title: 'Reset', body: 'git reset --soft HEAD~1', description: 'Undo', type: 'command' },
      ],
    },
    { source: 'builtin' },
  );
  const mine = repos.items.create({ title: 'Mine', body: 'echo {{x}}', description: 'd', tags: ['personal', 'x'], language: 'bash' });
  repos.items.setPinned(mine.id, true);
  repos.items.recordCopy(mine.id);
  repos.items.recordCopy(mine.id);
  const c = repos.collections.create('Exam');
  repos.collections.addItem(c.id, mine.id);
  repos.collections.addItem(c.id, repos.items.list({ category: 'Daily dev work' })[0].id);
  return repos;
}

describe('backup export', () => {
  it('produces versioned JSON with packs, items, tags and collections', () => {
    const json = createBackupJson(populated());
    const data = JSON.parse(json);
    expect(data).toMatchObject({ app: 'devcheat', formatVersion: 1 });
    expect(data.packs).toHaveLength(1);
    expect(data.items).toHaveLength(3);
    expect(data.collections).toEqual([expect.objectContaining({ name: 'Exam', itemIds: expect.any(Array) })]);
    const mine = data.items.find((i: { title: string }) => i.title === 'Mine');
    expect(mine).toMatchObject({ pinned: true, useCount: 2, source: 'user', packName: null, tags: ['personal', 'x'] });
    expect(backupFileName(new Date('2026-10-08T10:00:00Z'))).toBe('devcheat-backup-2026-10-08.json');
  });
});

describe('backup restore', () => {
  it('round-trips into an empty database (replace) preserving pins, usage, tags and collections', () => {
    const src = populated();
    const json = createBackupJson(src);
    const dest = createRepos(createTestDb());
    const summary = restoreBackup(dest, json, 'replace');
    expect(summary).toMatchObject({ itemsAdded: 3, itemsSkipped: 0, packsAdded: 1, collectionsAdded: 1 });

    const mine = dest.items.search('mine')[0];
    expect(mine).toMatchObject({ pinned: true, useCount: 2, tags: ['personal', 'x'], source: 'user' });
    expect(dest.items.list({ category: 'Daily dev work' }).map((i) => [i.title, i.source, i.pinned])).toEqual([
      ['Reset', 'builtin', true],
      ['Stash', 'builtin', true],
    ]);
    const [c] = dest.collections.list();
    expect(dest.collections.items(c.id).map((i) => i.title).sort()).toEqual(['Mine', 'Reset']);
    // search index was rebuilt by the triggers
    expect(dest.items.search('stash')).toHaveLength(1);
    expect(dest.items.search('personal')).toHaveLength(1);
    expect(dest.packs.findByName('Git')).toMatchObject({ version: '3', pinnedDefault: true });
  });

  it('replace wipes existing data', () => {
    const src = populated();
    const dest = createRepos(createTestDb());
    dest.items.create({ title: 'Old', body: 'old' });
    dest.collections.create('Gone');
    restoreBackup(dest, createBackupJson(src), 'replace');
    expect(dest.items.search('old')).toEqual([]);
    expect(dest.collections.list().map((c) => c.name)).toEqual(['Exam']);
  });

  it('merge keeps device data and skips duplicates; importing twice adds nothing', () => {
    const src = populated();
    const json = createBackupJson(src);
    const dest = createRepos(createTestDb());
    const keep = dest.items.create({ title: 'Device only', body: 'keep me' });
    const first = restoreBackup(dest, json, 'merge');
    expect(first.itemsAdded).toBe(3);
    const second = restoreBackup(dest, json, 'merge');
    expect(second).toMatchObject({ itemsAdded: 0, itemsSkipped: 3, packsAdded: 0, collectionsAdded: 0 });
    expect(dest.items.get(keep.id)?.body).toBe('keep me');
    expect(dest.items.list({}, 100000).length).toBe(4);
    expect(dest.collections.list()).toHaveLength(1);
    expect(dest.collections.list()[0].itemCount).toBe(2);
    expect(describeRestore(second)).toContain('3 already present');
  });

  it('merge never changes the pin state or usage of items already on the device', () => {
    const src = populated();
    const json = createBackupJson(src);
    const dest = createRepos(createTestDb());
    restoreBackup(dest, json, 'merge');
    const stash = dest.items.search('stash')[0];
    dest.items.setPinned(stash.id, false);
    restoreBackup(dest, json, 'merge');
    expect(dest.items.get(stash.id)!.pinned).toBe(false);
  });

  it('is atomic: a failure part-way leaves the database unchanged', () => {
    const dest = createRepos(createTestDb());
    dest.items.create({ title: 'Existing', body: 'x' });
    const data = JSON.parse(createBackupJson(populated()));
    // Passing an invalid FK-bearing structure through the repo directly: collection references are tolerated,
    // so force a failure with a constraint violation instead (type check constraint).
    data.items[0].type = 'bogus';
    expect(() => dest.backup.importAll(data, 'replace')).toThrow();
    expect(dest.items.list().map((i) => i.title)).toEqual(['Existing']);
  });
});

describe('parseBackup validation', () => {
  const good = () => JSON.parse(createBackupJson(populated()));

  it.each([
    ['empty file', '', /empty/],
    ['not JSON', 'hello', /not a valid JSON/],
    ['wrong app', JSON.stringify({ app: 'other', formatVersion: 1 }), /not a DevCheat backup/],
    ['future version', JSON.stringify({ app: 'devcheat', formatVersion: 2 }), /Unsupported backup version/],
    ['missing arrays', JSON.stringify({ app: 'devcheat', formatVersion: 1 }), /missing packs, items or collections/],
    ['array root', '[]', /not a DevCheat backup/],
  ])('rejects %s', (_label, text, message) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(message);
  });

  it('rejects malformed items with a pointed message', () => {
    const d = good();
    d.items[1].title = '';
    expect(() => parseBackup(JSON.stringify(d))).toThrow(/items\[1\] needs a title/);
    const e = good();
    e.items[0].type = 'note';
    expect(() => parseBackup(JSON.stringify(e))).toThrow(/unknown type "note"/);
    const f = good();
    f.items[0].createdAt = 'yesterday';
    expect(() => parseBackup(JSON.stringify(f))).toThrow(/Invalid "createdAt"/);
  });

  it('cleans tags and tolerates missing optional fields', () => {
    const d = good();
    d.items[0].tags = ['OK', 5, '#ok', 'x'.repeat(100)];
    delete d.items[0].description;
    delete d.items[0].lastUsedAt;
    const parsed = parseBackup(JSON.stringify(d));
    expect(parsed.items[0].tags).toEqual(['ok']);
    expect(parsed.items[0].description).toBe('');
    expect(parsed.items[0].lastUsedAt).toBeNull();
  });

  it('turns pack items whose pack is missing from the file into user items', () => {
    const d = good();
    d.packs = [];
    const dest = createRepos(createTestDb());
    restoreBackup(dest, JSON.stringify(d), 'replace');
    expect(dest.items.list().every((i) => i.source === 'user' && i.packId === null)).toBe(true);
  });
});
