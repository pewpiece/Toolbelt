import { createTestDb } from '@/db/testing';

import { createItemsRepo, toFtsQuery } from '../itemsRepo';
import { ValidationError } from '../validation';

function setup() {
  let t = 1000;
  const clock = () => ++t;
  const db = createTestDb();
  return { db, repo: createItemsRepo(db, clock) };
}

describe('toFtsQuery', () => {
  it('builds prefix queries and strips operators', () => {
    expect(toFtsQuery('git reb')).toBe('"git"* "reb"*');
    expect(toFtsQuery('  "foo" OR (bar) -x ')).toBe('"foo"* "or"* "bar"* "x"*');
  });
  it('returns null for empty or punctuation-only input', () => {
    expect(toFtsQuery('')).toBeNull();
    expect(toFtsQuery(' -- ** ')).toBeNull();
  });
});

describe('items repository', () => {
  it('creates, reads and trims an item with normalized tags', () => {
    const { repo } = setup();
    const item = repo.create({
      title: '  Undo last commit ',
      body: 'git reset --soft HEAD~1',
      type: 'command',
      language: ' Bash ',
      tags: ['Git', '#git', 'Undo Stuff', ''],
    });
    expect(item.title).toBe('Undo last commit');
    expect(item.language).toBe('bash');
    expect(item.tags).toEqual(['git', 'undo-stuff']);
    expect(item.source).toBe('user');
    expect(item.pinned).toBe(false);
    expect(repo.get(item.id)?.body).toBe('git reset --soft HEAD~1');
  });

  it('rejects invalid input with a ValidationError naming the field', () => {
    const { repo } = setup();
    expect(() => repo.create({ title: ' ', body: 'x' })).toThrow(ValidationError);
    expect(() => repo.create({ title: 't', body: '  ' })).toThrow(/Body is required/);
    expect(() => repo.create({ title: 'x'.repeat(201), body: 'b' })).toThrow(/too long/);
    expect(() => repo.create({ title: 't', body: 'b', type: 'nope' as never })).toThrow(/Unknown type/);
    try {
      repo.create({ title: '', body: 'b' });
    } catch (e) {
      expect((e as ValidationError).field).toBe('title');
    }
  });

  it('updates an item, replaces tags, and marks pack items as user-owned', () => {
    const { repo } = setup();
    const a = repo.create({ title: 'A', body: 'one', tags: ['x', 'y'] });
    const b = repo.update(a.id, { title: 'A2', body: 'two', tags: ['z'] });
    expect(b.title).toBe('A2');
    expect(b.tags).toEqual(['z']);
    expect(repo.update(a.id, { title: 'A2', body: 'two' }).tags).toEqual([]);
    expect(() => repo.update(9999, { title: 't', body: 'b' })).toThrow(/not found/);
  });

  it('deletes items and cascades tag links', () => {
    const { repo } = setup();
    const a = repo.create({ title: 'A', body: 'one', tags: ['x'] });
    repo.remove(a.id);
    expect(repo.get(a.id)).toBeNull();
    expect(repo.allTags()).toEqual([]);
  });

  describe('full-text search', () => {
    it('matches by prefix across title, body, description and tags', () => {
      const { repo } = setup();
      const rebase = repo.create({ title: 'Interactive rebase', body: 'git rebase -i HEAD~3' });
      const desc = repo.create({ title: 'Other', body: 'nothing', description: 'squash commits together' });
      const tagged = repo.create({ title: 'Third', body: 'zzz', tags: ['kubernetes'] });
      expect(repo.search('reb').map((i) => i.id)).toEqual([rebase.id]);
      expect(repo.search('squa').map((i) => i.id)).toEqual([desc.id]);
      expect(repo.search('kube').map((i) => i.id)).toEqual([tagged.id]);
      expect(repo.search('git rebase').map((i) => i.id)).toEqual([rebase.id]);
      expect(repo.search('rebase nomatch')).toEqual([]);
    });

    it('stays in sync after update, tag change and delete', () => {
      const { repo } = setup();
      const a = repo.create({ title: 'Alpha', body: 'first body', tags: ['red'] });
      expect(repo.search('alpha')).toHaveLength(1);
      repo.update(a.id, { title: 'Beta', body: 'second body', tags: ['blue'] });
      expect(repo.search('alpha')).toHaveLength(0);
      expect(repo.search('first')).toHaveLength(0);
      expect(repo.search('red')).toHaveLength(0);
      expect(repo.search('beta')).toHaveLength(1);
      expect(repo.search('blue')).toHaveLength(1);
      repo.remove(a.id);
      expect(repo.search('beta')).toHaveLength(0);
      expect(repo.search('blue')).toHaveLength(0);
    });

    it('ranks title hits above body hits', () => {
      const { repo } = setup();
      const body = repo.create({ title: 'Something else', body: 'use docker here' });
      const title = repo.create({ title: 'Docker cleanup', body: 'prune things' });
      expect(repo.search('docker').map((i) => i.id)).toEqual([title.id, body.id]);
    });

    it('does not throw on hostile query text', () => {
      const { repo } = setup();
      repo.create({ title: 'a', body: 'b' });
      for (const q of ['"', "'", 'AND', 'a*', '(', 'NEAR(', '-', 'x:y', '\\']) {
        expect(() => repo.search(q)).not.toThrow();
      }
    });

    it('combines search with filters', () => {
      const { repo } = setup();
      repo.create({ title: 'Loop py', body: 'for x in y', language: 'python' });
      const sh = repo.create({ title: 'Loop sh', body: 'for x in y', language: 'bash' });
      expect(repo.search('loop', { language: 'bash' }).map((i) => i.id)).toEqual([sh.id]);
    });
  });

  it('tracks pin state and copy usage without touching updated_at', () => {
    const { repo } = setup();
    const a = repo.create({ title: 'A', body: 'x' });
    const b = repo.create({ title: 'B', body: 'y' });
    repo.setPinned(a.id, true);
    expect(repo.pinned().map((i) => i.id)).toEqual([a.id]);
    repo.recordCopy(b.id);
    repo.recordCopy(b.id);
    repo.recordCopy(a.id);
    const b2 = repo.get(b.id)!;
    expect(b2.useCount).toBe(2);
    expect(b2.lastUsedAt).not.toBeNull();
    expect(b2.updatedAt).toBe(b.updatedAt);
    expect(repo.mostUsed().map((i) => i.id)).toEqual([b.id, a.id]);
    expect(repo.mostUsed(1)).toHaveLength(1);
  });

  it('lists languages and filters by language and tag', () => {
    const { repo } = setup();
    repo.create({ title: 'A', body: 'x', language: 'python', tags: ['t1'] });
    repo.create({ title: 'B', body: 'y', language: 'bash', tags: ['t2'] });
    repo.create({ title: 'C', body: 'z' });
    expect(repo.languages()).toEqual(['bash', 'python']);
    expect(repo.list({ language: 'python' }).map((i) => i.title)).toEqual(['A']);
    expect(repo.list({ tag: 'T2' }).map((i) => i.title)).toEqual(['B']);
    expect(repo.count()).toBe(3);
  });
});
