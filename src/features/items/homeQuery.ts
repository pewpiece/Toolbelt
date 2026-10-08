import type { Repos } from '@/data';
import type { Item, ItemFilter } from '@/data/types';

export interface HomeFilters {
  text: string;
  category?: string | null;
  language?: string | null;
  tag?: string | null;
}

export type HomeData =
  | { mode: 'results'; items: Item[]; categories: string[]; languages: string[] }
  | { mode: 'browse'; pinned: Item[]; mostUsed: Item[]; categories: string[]; languages: string[] };

/**
 * Home shows pinned + most-used items until the user searches or picks a filter, after
 * which it shows a single ranked/sorted result list.
 */
export function loadHome(repos: Repos, f: HomeFilters): HomeData {
  const categories = repos.packs.categories();
  const languages = repos.items.languages();
  const filter: ItemFilter = {};
  if (f.category) filter.category = f.category;
  if (f.language) filter.language = f.language;
  if (f.tag) filter.tag = f.tag;

  const text = f.text.trim();
  if (text) {
    return { mode: 'results', items: repos.items.search(text, filter), categories, languages };
  }
  if (Object.keys(filter).length > 0) {
    const items = repos.items.list(filter);
    // Pinned first within a filtered list, then alphabetical (list() is already alphabetical).
    items.sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return { mode: 'results', items, categories, languages };
  }
  const pinned = repos.items.pinned();
  const pinnedIds = new Set(pinned.map((i) => i.id));
  const mostUsed = repos.items.mostUsed(8).filter((i) => !pinnedIds.has(i.id));
  return { mode: 'browse', pinned, mostUsed, categories, languages };
}
