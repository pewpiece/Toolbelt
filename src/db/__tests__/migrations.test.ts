import { sql } from 'drizzle-orm';

import { LATEST_VERSION, runMigrations } from '../migrations';
import { createTestDb } from '../testing';

describe('migrations', () => {
  it('creates all tables, FTS table and triggers', () => {
    const db = createTestDb();
    const names = db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type IN ('table','trigger')`)
      .map((r) => r.name);
    for (const n of [
      'items',
      'tags',
      'item_tags',
      'collections',
      'collection_items',
      'packs',
      'settings',
      'items_fts',
      'items_fts_ai',
      'items_fts_au',
      'items_fts_ad',
      'item_tags_fts_ai',
      'item_tags_fts_ad',
      'tags_fts_au',
    ]) {
      expect(names).toContain(n);
    }
  });

  it('sets user_version and is idempotent', () => {
    const db = createTestDb();
    expect(db.get<{ user_version: number }>(sql`PRAGMA user_version`)?.user_version).toBe(LATEST_VERSION);
    expect(() => runMigrations(db)).not.toThrow();
    expect(db.get<{ user_version: number }>(sql`PRAGMA user_version`)?.user_version).toBe(LATEST_VERSION);
  });

  it('enforces the type and source check constraints', () => {
    const db = createTestDb();
    expect(() =>
      db.run(
        sql`INSERT INTO items (title, body, type, created_at, updated_at) VALUES ('a','b','bogus',1,1)`,
      ),
    ).toThrow();
    expect(() =>
      db.run(
        sql`INSERT INTO items (title, body, source, created_at, updated_at) VALUES ('a','b','bogus',1,1)`,
      ),
    ).toThrow();
  });
});
