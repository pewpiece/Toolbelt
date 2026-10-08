import { createRepos } from '..';
import { createTestDb } from '@/db/testing';

describe('collections repository', () => {
  it('creates, lists, renames and deletes collections', () => {
    const r = createRepos(createTestDb());
    const c = r.collections.create('  Interview prep ');
    expect(c.name).toBe('Interview prep');
    r.collections.create('alpha');
    expect(r.collections.list().map((x) => x.name)).toEqual(['alpha', 'Interview prep']);
    r.collections.rename(c.id, 'Prep');
    expect(r.collections.get(c.id)?.name).toBe('Prep');
    r.collections.remove(c.id);
    expect(r.collections.get(c.id)).toBeNull();
    expect(() => r.collections.create(' ')).toThrow(/required/);
  });

  it('adds and removes items, idempotently, and cascades on item delete', () => {
    const r = createRepos(createTestDb());
    const c = r.collections.create('Work');
    const a = r.items.create({ title: 'A', body: 'a' });
    const b = r.items.create({ title: 'B', body: 'b' });
    r.collections.addItem(c.id, a.id);
    r.collections.addItem(c.id, a.id);
    r.collections.addItem(c.id, b.id);
    expect(r.collections.get(c.id)?.itemCount).toBe(2);
    expect(r.collections.items(c.id).map((i) => i.title)).toEqual(['A', 'B']);
    expect(r.collections.forItem(a.id).map((x) => x.id)).toEqual([c.id]);
    r.collections.removeItem(c.id, a.id);
    expect(r.collections.items(c.id).map((i) => i.title)).toEqual(['B']);
    r.items.remove(b.id);
    expect(r.collections.get(c.id)?.itemCount).toBe(0);
    expect(r.items.list({ collectionId: c.id })).toEqual([]);
  });
});
