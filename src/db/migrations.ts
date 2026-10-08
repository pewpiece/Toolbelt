import { sql } from 'drizzle-orm';

import type { AppDb } from './types';

/**
 * Ordered migrations. Each entry is a list of single statements (not one big string) so
 * trigger bodies containing semicolons never need to be split. The applied version is
 * tracked in `PRAGMA user_version`. Never edit a shipped migration: append a new one.
 */
export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema, FTS5 and sync triggers',
    statements: [
      `CREATE TABLE packs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        source_url TEXT,
        version TEXT NOT NULL DEFAULT '1',
        pinned_default INTEGER NOT NULL DEFAULT 0,
        installed_at INTEGER NOT NULL
      )`,
      `CREATE UNIQUE INDEX packs_name_unique ON packs (name)`,
      `CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'snippet',
        language TEXT,
        source TEXT NOT NULL DEFAULT 'user',
        pack_id INTEGER REFERENCES packs(id) ON DELETE SET NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        use_count INTEGER NOT NULL DEFAULT 0,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CONSTRAINT items_type_check CHECK (type in ('snippet','command','checklist')),
        CONSTRAINT items_source_check CHECK (source in ('user','builtin','tldr','url'))
      )`,
      `CREATE INDEX items_pack_idx ON items (pack_id)`,
      `CREATE INDEX items_pinned_idx ON items (pinned)`,
      `CREATE INDEX items_use_count_idx ON items (use_count)`,
      `CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX tags_name_unique ON tags (name)`,
      `CREATE TABLE item_tags (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (item_id, tag_id)
      )`,
      `CREATE INDEX item_tags_tag_idx ON item_tags (tag_id)`,
      `CREATE TABLE collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE collection_items (
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (collection_id, item_id)
      )`,
      `CREATE INDEX collection_items_item_idx ON collection_items (item_id)`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,

      // Full-text index. rowid is items.id. Standalone (not external-content) because
      // the "tags" column is derived from another table.
      `CREATE VIRTUAL TABLE items_fts USING fts5(title, body, description, tags)`,
      `CREATE TRIGGER items_fts_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts (rowid, title, body, description, tags)
        VALUES (new.id, new.title, new.body, new.description, '');
      END`,
      `CREATE TRIGGER items_fts_au AFTER UPDATE OF title, body, description ON items BEGIN
        UPDATE items_fts
        SET title = new.title, body = new.body, description = new.description
        WHERE rowid = new.id;
      END`,
      `CREATE TRIGGER items_fts_ad AFTER DELETE ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.id;
      END`,
      `CREATE TRIGGER item_tags_fts_ai AFTER INSERT ON item_tags BEGIN
        UPDATE items_fts SET tags = (
          SELECT coalesce(group_concat(t.name, ' '), '')
          FROM item_tags it JOIN tags t ON t.id = it.tag_id
          WHERE it.item_id = new.item_id
        ) WHERE rowid = new.item_id;
      END`,
      `CREATE TRIGGER item_tags_fts_ad AFTER DELETE ON item_tags BEGIN
        UPDATE items_fts SET tags = (
          SELECT coalesce(group_concat(t.name, ' '), '')
          FROM item_tags it JOIN tags t ON t.id = it.tag_id
          WHERE it.item_id = old.item_id
        ) WHERE rowid = old.item_id;
      END`,
      `CREATE TRIGGER tags_fts_au AFTER UPDATE OF name ON tags BEGIN
        UPDATE items_fts SET tags = (
          SELECT coalesce(group_concat(t.name, ' '), '')
          FROM item_tags it JOIN tags t ON t.id = it.tag_id
          WHERE it.item_id = items_fts.rowid
        ) WHERE rowid IN (SELECT item_id FROM item_tags WHERE tag_id = new.id);
      END`,
    ],
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;

/** Applies pending migrations inside a transaction each. Safe to call on every launch. */
export function runMigrations(db: AppDb): number {
  db.run(sql`PRAGMA foreign_keys = ON`);
  const row = db.get<{ user_version: number }>(sql`PRAGMA user_version`);
  const current = row?.user_version ?? 0;
  for (const m of migrations) {
    if (m.version <= current) continue;
    db.transaction((tx) => {
      for (const stmt of m.statements) tx.run(sql.raw(stmt));
      tx.run(sql.raw(`PRAGMA user_version = ${m.version}`));
    });
  }
  return LATEST_VERSION;
}
