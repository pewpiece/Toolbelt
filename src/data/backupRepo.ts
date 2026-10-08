import { eq, sql } from 'drizzle-orm';

import { collectionItems, collections, itemTags, items, packs, tags } from '@/db/schema';
import type { AppDb } from '@/db/types';

import type { Clock } from './itemsRepo';
import type { ItemSource, ItemType } from './types';

export interface BackupPack {
  name: string;
  category: string;
  sourceUrl: string | null;
  version: string;
  pinnedDefault: boolean;
  installedAt: number;
}

export interface BackupItem {
  id: number;
  title: string;
  body: string;
  description: string;
  type: ItemType;
  language: string | null;
  source: ItemSource;
  packName: string | null;
  pinned: boolean;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface BackupCollection {
  name: string;
  createdAt: number;
  itemIds: number[];
}

export interface BackupFile {
  app: 'devcheat';
  formatVersion: 1;
  exportedAt: string;
  packs: BackupPack[];
  items: BackupItem[];
  collections: BackupCollection[];
}

export type ImportMode = 'merge' | 'replace';

export interface BackupImportSummary {
  mode: ImportMode;
  packsAdded: number;
  itemsAdded: number;
  itemsSkipped: number;
  collectionsAdded: number;
}

export function createBackupRepo(db: AppDb, now: Clock = Date.now) {
  function tagsByItem(): Map<number, string[]> {
    const rows = db
      .select({ itemId: itemTags.itemId, name: tags.name })
      .from(itemTags)
      .innerJoin(tags, eq(tags.id, itemTags.tagId))
      .orderBy(tags.name)
      .all();
    const map = new Map<number, string[]>();
    for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r.name]);
    return map;
  }

  return {
    exportAll(): BackupFile {
      const packRows = db.select().from(packs).orderBy(packs.id).all();
      const packName = new Map(packRows.map((p) => [p.id, p.name]));
      const tagMap = tagsByItem();
      const itemRows = db.select().from(items).orderBy(items.id).all();
      const members = db.select().from(collectionItems).all();
      return {
        app: 'devcheat',
        formatVersion: 1,
        exportedAt: new Date(now()).toISOString(),
        packs: packRows.map((p) => ({
          name: p.name,
          category: p.category,
          sourceUrl: p.sourceUrl,
          version: p.version,
          pinnedDefault: p.pinnedDefault,
          installedAt: p.installedAt,
        })),
        items: itemRows.map((i) => ({
          id: i.id,
          title: i.title,
          body: i.body,
          description: i.description,
          type: i.type,
          language: i.language,
          source: i.source,
          packName: i.packId === null ? null : (packName.get(i.packId) ?? null),
          pinned: i.pinned,
          useCount: i.useCount,
          lastUsedAt: i.lastUsedAt,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          tags: tagMap.get(i.id) ?? [],
        })),
        collections: db
          .select()
          .from(collections)
          .orderBy(collections.id)
          .all()
          .map((c) => ({
            name: c.name,
            createdAt: c.createdAt,
            itemIds: members.filter((m) => m.collectionId === c.id).map((m) => m.itemId),
          })),
      };
    },

    /**
     * Imports a validated backup in one transaction (any error rolls everything back).
     *  - replace: wipes packs, items, tags and collections first, then loads the file.
     *  - merge:   keeps everything on the device; adds what is missing. A pack item matches by
     *             (pack, title), a standalone item by (title, body); matches are skipped.
     */
    importAll(file: BackupFile, mode: ImportMode): BackupImportSummary {
      return db.transaction(() => {
        const summary: BackupImportSummary = {
          mode,
          packsAdded: 0,
          itemsAdded: 0,
          itemsSkipped: 0,
          collectionsAdded: 0,
        };

        if (mode === 'replace') {
          db.delete(collectionItems).run();
          db.delete(collections).run();
          db.delete(itemTags).run();
          db.delete(items).run();
          db.delete(tags).run();
          db.delete(packs).run();
        }

        const packIds = new Map<string, number>();
        for (const p of file.packs) {
          const existing = db.select({ id: packs.id }).from(packs).where(eq(packs.name, p.name)).get();
          if (existing) {
            packIds.set(p.name, existing.id);
            continue;
          }
          const id = db.insert(packs).values(p).returning({ id: packs.id }).get().id;
          packIds.set(p.name, id);
          summary.packsAdded++;
        }

        const idMap = new Map<number, number>(); // backup item id -> device item id
        for (const it of file.items) {
          const packId = it.packName !== null ? (packIds.get(it.packName) ?? null) : null;
          const source: ItemSource = packId === null && it.source !== 'user' ? 'user' : it.source;

          const dupe =
            packId !== null
              ? db
                  .select({ id: items.id })
                  .from(items)
                  .where(sql`${items.packId} = ${packId} AND ${items.title} = ${it.title}`)
                  .get()
              : db
                  .select({ id: items.id })
                  .from(items)
                  .where(sql`${items.packId} IS NULL AND ${items.title} = ${it.title} AND ${items.body} = ${it.body}`)
                  .get();
          if (dupe) {
            idMap.set(it.id, dupe.id);
            summary.itemsSkipped++;
            continue;
          }

          const newId = db
            .insert(items)
            .values({
              title: it.title,
              body: it.body,
              description: it.description,
              type: it.type,
              language: it.language,
              source,
              packId,
              pinned: it.pinned,
              useCount: it.useCount,
              lastUsedAt: it.lastUsedAt,
              createdAt: it.createdAt,
              updatedAt: it.updatedAt,
            })
            .returning({ id: items.id })
            .get().id;
          idMap.set(it.id, newId);
          summary.itemsAdded++;

          for (const name of it.tags) {
            db.insert(tags).values({ name }).onConflictDoNothing().run();
            const tag = db.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).get();
            if (tag) db.insert(itemTags).values({ itemId: newId, tagId: tag.id }).onConflictDoNothing().run();
          }
        }

        for (const c of file.collections) {
          let collectionId = db
            .select({ id: collections.id })
            .from(collections)
            .where(sql`${collections.name} = ${c.name} COLLATE NOCASE`)
            .get()?.id;
          if (collectionId === undefined) {
            collectionId = db
              .insert(collections)
              .values({ name: c.name, createdAt: c.createdAt })
              .returning({ id: collections.id })
              .get().id;
            summary.collectionsAdded++;
          }
          for (const oldId of c.itemIds) {
            const itemId = idMap.get(oldId);
            if (itemId === undefined) continue;
            db.insert(collectionItems)
              .values({ collectionId, itemId, addedAt: now() })
              .onConflictDoNothing()
              .run();
          }
        }
        return summary;
      });
    },
  };
}
