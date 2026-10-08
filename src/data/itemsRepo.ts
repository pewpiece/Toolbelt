import { and, desc, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';

import { collectionItems, itemTags, items, packs, tags, type ItemRow } from '@/db/schema';
import type { AppDb } from '@/db/types';

import type { Item, ItemFilter, ItemInput } from './types';
import { cleanItemInput, normalizeTag } from './validation';

export type Clock = () => number;

/** Turns free text into a safe FTS5 prefix query: `git rebase` -> `"git"* "rebase"*`. */
export function toFtsQuery(text: string): string | null {
  const terms = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t}"*`).join(' ');
}

export function createItemsRepo(db: AppDb, now: Clock = Date.now) {
  function attachTags(rows: ItemRow[]): Item[] {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const tagRows = db
      .select({ itemId: itemTags.itemId, name: tags.name })
      .from(itemTags)
      .innerJoin(tags, eq(tags.id, itemTags.tagId))
      .where(inArray(itemTags.itemId, ids))
      .orderBy(tags.name)
      .all();
    const byItem = new Map<number, string[]>();
    for (const t of tagRows) {
      const list = byItem.get(t.itemId) ?? [];
      list.push(t.name);
      byItem.set(t.itemId, list);
    }
    return rows.map((r) => ({ ...r, tags: byItem.get(r.id) ?? [] }));
  }

  function filterConditions(filter: ItemFilter): SQL[] {
    const conds: SQL[] = [];
    if (filter.pinned !== undefined) conds.push(eq(items.pinned, filter.pinned));
    if (filter.language) conds.push(eq(items.language, filter.language.toLowerCase()));
    if (filter.category) {
      conds.push(
        sql`${items.packId} IN (SELECT ${packs.id} FROM ${packs} WHERE ${packs.category} = ${filter.category})`,
      );
    }
    if (filter.tag) {
      conds.push(
        sql`${items.id} IN (SELECT ${itemTags.itemId} FROM ${itemTags} INNER JOIN ${tags} ON ${tags.id} = ${itemTags.tagId} WHERE ${tags.name} = ${normalizeTag(filter.tag)})`,
      );
    }
    if (filter.collectionId !== undefined) {
      conds.push(
        sql`${items.id} IN (SELECT ${collectionItems.itemId} FROM ${collectionItems} WHERE ${collectionItems.collectionId} = ${filter.collectionId})`,
      );
    }
    return conds;
  }

  function setTagsInternal(itemId: number, names: string[]) {
    db.delete(itemTags).where(eq(itemTags.itemId, itemId)).run();
    for (const name of names) {
      db.insert(tags).values({ name }).onConflictDoNothing().run();
      const tag = db.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).get();
      if (tag) db.insert(itemTags).values({ itemId, tagId: tag.id }).onConflictDoNothing().run();
    }
  }

  function list(filter: ItemFilter = {}, limit = 500): Item[] {
    const rows = db
      .select()
      .from(items)
      .where(and(...filterConditions(filter)))
      .orderBy(sql`${items.title} COLLATE NOCASE`)
      .limit(limit)
      .all();
    return attachTags(rows);
  }

  return {
    create(input: ItemInput): Item {
      const c = cleanItemInput(input);
      const t = now();
      return db.transaction((tx) => {
        const row = tx
          .insert(items)
          .values({
            title: c.title,
            body: c.body,
            description: c.description,
            type: c.type,
            language: c.language,
            source: 'user',
            createdAt: t,
            updatedAt: t,
          })
          .returning()
          .get();
        setTagsInternal(row.id, c.tags);
        return attachTags([row])[0];
      });
    },

    /** Editing a pack item makes it the user's own (source becomes 'user'), so pack refreshes leave it alone. */
    update(id: number, input: ItemInput): Item {
      const c = cleanItemInput(input);
      return db.transaction((tx) => {
        const row = tx
          .update(items)
          .set({
            title: c.title,
            body: c.body,
            description: c.description,
            type: c.type,
            language: c.language,
            source: 'user',
            updatedAt: now(),
          })
          .where(eq(items.id, id))
          .returning()
          .get();
        if (!row) throw new Error(`Item ${id} not found`);
        setTagsInternal(id, c.tags);
        return attachTags([row])[0];
      });
    },

    /** Replace an item's tags without touching its source (used by the pack merge code). */
    setTags(id: number, names: string[]) {
      setTagsInternal(id, names.map(normalizeTag).filter(Boolean));
    },

    remove(id: number) {
      db.delete(items).where(eq(items.id, id)).run();
    },

    get(id: number): Item | null {
      const row = db.select().from(items).where(eq(items.id, id)).get();
      return row ? attachTags([row])[0] : null;
    },

    list,

    /** Prefix full-text search over title, body, description and tags, best match first. */
    search(text: string, filter: ItemFilter = {}, limit = 100): Item[] {
      const q = toFtsQuery(text);
      if (!q) return [];
      const ranked = db.all<{ rowid: number }>(
        sql`SELECT rowid FROM items_fts WHERE items_fts MATCH ${q} ORDER BY bm25(items_fts, 10.0, 1.0, 3.0, 5.0) LIMIT 500`,
      );
      if (ranked.length === 0) return [];
      const order = new Map(ranked.map((r, i) => [r.rowid, i]));
      const rows = db
        .select()
        .from(items)
        .where(and(inArray(items.id, [...order.keys()]), ...filterConditions(filter)))
        .all();
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return attachTags(rows.slice(0, limit));
    },

    pinned(): Item[] {
      return list({ pinned: true });
    },

    mostUsed(limit = 10): Item[] {
      const rows = db
        .select()
        .from(items)
        .where(sql`${items.useCount} > 0`)
        .orderBy(desc(items.useCount), desc(items.lastUsedAt))
        .limit(limit)
        .all();
      return attachTags(rows);
    },

    setPinned(id: number, pinned: boolean) {
      db.update(items).set({ pinned }).where(eq(items.id, id)).run();
    },

    /** Called on every Copy. Does not change updated_at or the FTS index. */
    recordCopy(id: number) {
      db.update(items)
        .set({ useCount: sql`${items.useCount} + 1`, lastUsedAt: now() })
        .where(eq(items.id, id))
        .run();
    },

    languages(): string[] {
      return db
        .selectDistinct({ language: items.language })
        .from(items)
        .where(isNotNull(items.language))
        .orderBy(items.language)
        .all()
        .map((r) => r.language as string);
    },

    /** Tags that are attached to at least one item. */
    allTags(): string[] {
      return db
        .selectDistinct({ name: tags.name })
        .from(tags)
        .innerJoin(itemTags, eq(itemTags.tagId, tags.id))
        .orderBy(tags.name)
        .all()
        .map((r) => r.name);
    },

    count(): number {
      return db.select({ n: sql<number>`count(*)` }).from(items).get()?.n ?? 0;
    },
  };
}

export type ItemsRepo = ReturnType<typeof createItemsRepo>;
