import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

import { schema } from '../schema';
import { createTestDb } from '../testing';

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

/** The drizzle schema (used for typed queries) and the hand-written SQL migrations must describe the same tables. */
describe('drizzle schema matches the migrated database', () => {
  const db = createTestDb();

  it.each(Object.values(schema).map((t) => [getTableConfig(t).name, t] as const))('table %s', (name, table) => {
    const actual = db.all<ColumnInfo>(sql.raw(`PRAGMA table_info(${name})`));
    const expected = getTableConfig(table).columns;

    expect(actual.map((c) => c.name).sort()).toEqual(expected.map((c) => c.name).sort());
    for (const col of expected) {
      const real = actual.find((c) => c.name === col.name)!;
      // NOT NULL must agree both ways (primary keys are exempt: SQLite reports them via `pk`).
      if (!(real.pk > 0)) expect({ column: col.name, notNull: real.notnull === 1 }).toEqual({ column: col.name, notNull: col.notNull });
      if (col.primary) expect(real.pk).toBeGreaterThan(0);
    }
  });

  it('declares the foreign keys and indexes the repositories rely on', () => {
    const fks = db.all<{ table: string; from: string; on_delete: string }>(sql`PRAGMA foreign_key_list(items)`);
    expect(fks).toEqual([expect.objectContaining({ table: 'packs', from: 'pack_id', on_delete: 'SET NULL' })]);
    const idx = db.all<{ name: string }>(sql`PRAGMA index_list(items)`).map((i) => i.name);
    expect(idx).toEqual(expect.arrayContaining(['items_pack_idx', 'items_pinned_idx', 'items_use_count_idx']));
  });
});
