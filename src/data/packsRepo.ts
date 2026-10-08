import { and, eq, ne, sql } from 'drizzle-orm';

import { items, packs } from '@/db/schema';
import type { AppDb } from '@/db/types';

import { createItemsRepo, type Clock } from './itemsRepo';
import type { ApplyPackResult, ItemSource, Pack, PackDef } from './types';
import { cleanItemInput } from './validation';

export interface ApplyPackOptions {
  /** Where the content came from; stored on every item the pack inserts. */
  source: Exclude<ItemSource, 'user'>;
  sourceUrl?: string | null;
}

export function createPacksRepo(db: AppDb, now: Clock = Date.now) {
  const itemsRepo = createItemsRepo(db, now);

  function toPack(row: typeof packs.$inferSelect): Pack {
    const n =
      db.select({ n: sql<number>`count(*)` }).from(items).where(eq(items.packId, row.id)).get()?.n ?? 0;
    return { ...row, itemCount: n };
  }

  return {
    list(): Pack[] {
      return db.select().from(packs).orderBy(packs.category, packs.name).all().map(toPack);
    },

    get(id: number): Pack | null {
      const row = db.select().from(packs).where(eq(packs.id, id)).get();
      return row ? toPack(row) : null;
    },

    findByName(name: string): Pack | null {
      const row = db.select().from(packs).where(eq(packs.name, name)).get();
      return row ? toPack(row) : null;
    },

    categories(): string[] {
      return db
        .selectDistinct({ category: packs.category })
        .from(packs)
        .orderBy(packs.category)
        .all()
        .map((r) => r.category);
    },

    /**
     * Installs a pack, or refreshes it if a pack with the same name exists.
     *
     * Merge rules (this is the contract the tests pin down):
     *  - Items with source = 'user' are never modified or deleted. If a user-owned item in
     *    this pack has the same title as a pack entry, the pack entry is skipped.
     *  - Existing pack items (matched by title) get new body/description/type/language/tags,
     *    but pinned, use_count and last_used_at are left alone, so an item the user unpinned
     *    stays unpinned.
     *  - New entries are inserted with pinned = pack.pinned (the pack's default).
     *  - Pack items that vanished from the new version are deleted.
     */
    apply(def: PackDef, opts: ApplyPackOptions): ApplyPackResult {
      const t = now();
      return db.transaction(() => {
        const existing = db.select().from(packs).where(eq(packs.name, def.name)).get();
        const pinnedDefault = def.pinned === true;
        let packId: number;
        let created = false;
        if (existing) {
          packId = existing.id;
          db.update(packs)
            .set({
              category: def.category,
              version: def.version,
              pinnedDefault,
              sourceUrl: opts.sourceUrl ?? existing.sourceUrl,
            })
            .where(eq(packs.id, packId))
            .run();
        } else {
          created = true;
          packId = db
            .insert(packs)
            .values({
              name: def.name,
              category: def.category,
              version: def.version,
              pinnedDefault,
              sourceUrl: opts.sourceUrl ?? null,
              installedAt: t,
            })
            .returning({ id: packs.id })
            .get().id;
        }

        const current = db.select().from(items).where(eq(items.packId, packId)).all();
        const byTitle = new Map(current.map((r) => [r.title, r]));
        const seen = new Set<string>();
        const result: ApplyPackResult = { packId, created, added: 0, updated: 0, removed: 0, skippedUser: 0 };

        for (const entry of def.items) {
          const c = cleanItemInput({ ...entry, description: entry.description });
          seen.add(c.title);
          const row = byTitle.get(c.title);
          if (row && row.source === 'user') {
            result.skippedUser++;
            continue;
          }
          if (row) {
            db.update(items)
              .set({
                body: c.body,
                description: c.description,
                type: c.type,
                language: c.language,
                source: opts.source,
                updatedAt: t,
              })
              .where(eq(items.id, row.id))
              .run();
            itemsRepo.setTags(row.id, c.tags);
            result.updated++;
          } else {
            const id = db
              .insert(items)
              .values({
                title: c.title,
                body: c.body,
                description: c.description,
                type: c.type,
                language: c.language,
                source: opts.source,
                packId,
                pinned: pinnedDefault,
                createdAt: t,
                updatedAt: t,
              })
              .returning({ id: items.id })
              .get().id;
            itemsRepo.setTags(id, c.tags);
            result.added++;
          }
        }

        for (const row of current) {
          if (row.source !== 'user' && !seen.has(row.title)) {
            db.delete(items).where(eq(items.id, row.id)).run();
            result.removed++;
          }
        }
        return result;
      });
    },

    /** Removes a pack and its non-user items. User-owned items are kept (their pack_id becomes null). */
    remove(id: number) {
      db.transaction(() => {
        db.delete(items)
          .where(and(eq(items.packId, id), ne(items.source, 'user')))
          .run();
        db.delete(packs).where(eq(packs.id, id)).run();
      });
    },
  };
}

export type PacksRepo = ReturnType<typeof createPacksRepo>;
