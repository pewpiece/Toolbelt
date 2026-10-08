import { eq, sql } from 'drizzle-orm';

import { collectionItems, collections } from '@/db/schema';
import type { AppDb } from '@/db/types';

import { createItemsRepo, type Clock } from './itemsRepo';
import type { Collection, Item } from './types';
import { cleanCollectionName } from './validation';

export function createCollectionsRepo(db: AppDb, now: Clock = Date.now) {
  const itemsRepo = createItemsRepo(db, now);

  function withCount(row: typeof collections.$inferSelect): Collection {
    const n =
      db
        .select({ n: sql<number>`count(*)` })
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, row.id))
        .get()?.n ?? 0;
    return { ...row, itemCount: n };
  }

  function list(): Collection[] {
    return db
      .select()
      .from(collections)
      .orderBy(sql`${collections.name} COLLATE NOCASE`)
      .all()
      .map(withCount);
  }

  return {
    create(name: string): Collection {
      const clean = cleanCollectionName(name);
      const row = db.insert(collections).values({ name: clean, createdAt: now() }).returning().get();
      return withCount(row);
    },

    rename(id: number, name: string) {
      db.update(collections).set({ name: cleanCollectionName(name) }).where(eq(collections.id, id)).run();
    },

    remove(id: number) {
      db.delete(collections).where(eq(collections.id, id)).run();
    },

    list,

    get(id: number): Collection | null {
      const row = db.select().from(collections).where(eq(collections.id, id)).get();
      return row ? withCount(row) : null;
    },

    items(id: number): Item[] {
      return itemsRepo.list({ collectionId: id });
    },

    addItem(collectionId: number, itemId: number) {
      db.insert(collectionItems)
        .values({ collectionId, itemId, addedAt: now() })
        .onConflictDoNothing()
        .run();
    },

    removeItem(collectionId: number, itemId: number) {
      db.delete(collectionItems)
        .where(sql`${collectionItems.collectionId} = ${collectionId} AND ${collectionItems.itemId} = ${itemId}`)
        .run();
    },

    /** Collections that contain the given item. */
    forItem(itemId: number): Collection[] {
      const ids = db
        .select({ id: collectionItems.collectionId })
        .from(collectionItems)
        .where(eq(collectionItems.itemId, itemId))
        .all()
        .map((r) => r.id);
      return list().filter((c) => ids.includes(c.id));
    },
  };
}

export type CollectionsRepo = ReturnType<typeof createCollectionsRepo>;
