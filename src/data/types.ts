export type ItemType = 'snippet' | 'command' | 'checklist';
export type ItemSource = 'user' | 'builtin' | 'tldr' | 'url';

export const ITEM_TYPES: readonly ItemType[] = ['snippet', 'command', 'checklist'];

export interface Item {
  id: number;
  title: string;
  body: string;
  description: string;
  type: ItemType;
  language: string | null;
  source: ItemSource;
  packId: number | null;
  pinned: boolean;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

/** What the user (or an importer) supplies when creating or editing an item. */
export interface ItemInput {
  title: string;
  body: string;
  description?: string;
  type?: ItemType;
  language?: string | null;
  tags?: string[];
}

export interface Pack {
  id: number;
  name: string;
  category: string;
  sourceUrl: string | null;
  version: string;
  pinnedDefault: boolean;
  installedAt: number;
  itemCount: number;
}

export interface PackItemDef {
  title: string;
  body: string;
  description: string;
  type?: ItemType;
  language?: string | null;
  tags?: string[];
}

/** The on-disk / over-the-wire pack format (see README "How to add a pack"). */
export interface PackDef {
  name: string;
  category: string;
  version: string;
  pinned?: boolean;
  items: PackItemDef[];
}

export interface ApplyPackResult {
  packId: number;
  created: boolean;
  added: number;
  updated: number;
  removed: number;
  /** Pack entries skipped because the user owns an item with the same title. */
  skippedUser: number;
}

export interface Collection {
  id: number;
  name: string;
  createdAt: number;
  itemCount: number;
}

export interface ItemFilter {
  pinned?: boolean;
  language?: string;
  category?: string;
  tag?: string;
  collectionId?: number;
}
