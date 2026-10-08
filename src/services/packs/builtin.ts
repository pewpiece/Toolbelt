import type { Repos } from '@/data';
import type { PackDef } from '@/data/types';

import { validatePack } from './validate';

export interface BuiltinSeedResult {
  installed: string[];
  updated: string[];
  /** Bundled packs that failed validation (should be empty; surfaced instead of crashing startup). */
  invalid: string[];
}

export interface SeedProgress {
  done: number;
  total: number;
}

const SEEDED_KEY = 'seededPacks';

function readSeeded(repos: Repos): string[] {
  try {
    const parsed: unknown = JSON.parse(repos.settings.get(SEEDED_KEY) ?? '[]');
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // fall through: treat a corrupt value as "nothing seeded yet"
  }
  return [];
}

/**
 * Walks the bundled packs one at a time. Each `yield` follows one pack, with `worked` telling
 * whether it wrote anything, so a caller can give the UI a chance to paint between packs.
 * The generator's return value is the final result.
 */
function* seedSteps(repos: Repos, bundled: unknown[]): Generator<SeedProgress & { worked: boolean }, BuiltinSeedResult> {
  const result: BuiltinSeedResult = { installed: [], updated: [], invalid: [] };
  const seeded = readSeeded(repos);

  for (let i = 0; i < bundled.length; i++) {
    const raw = bundled[i];
    let worked = false;
    const v = validatePack(raw, { requireDescriptions: true });
    if (!v.ok) {
      result.invalid.push((raw as { name?: string })?.name ?? '(unnamed)');
    } else {
      const pack: PackDef = v.pack;
      const existing = repos.packs.findByName(pack.name);
      if (!existing) {
        if (!seeded.includes(pack.name)) {
          // not previously installed; a pack the user removed earlier is in `seeded` and stays removed
          repos.packs.apply(pack, { source: 'builtin' });
          seeded.push(pack.name);
          repos.settings.set(SEEDED_KEY, JSON.stringify(seeded));
          result.installed.push(pack.name);
          worked = true;
        }
      } else if (existing.sourceUrl === null && existing.version !== pack.version) {
        repos.packs.apply(pack, { source: 'builtin' });
        result.updated.push(pack.name);
        worked = true;
      }
    }
    yield { done: i + 1, total: bundled.length, worked };
  }
  return result;
}

/**
 * Installs the bundled starter packs on first launch and applies newer bundled versions on
 * app upgrades. A pack the user removed is remembered (SEEDED_KEY) and not reinstalled.
 * All merge rules from PacksRepo.apply apply: user items and pin state survive.
 */
export function seedBuiltinPacks(repos: Repos, bundled: unknown[]): BuiltinSeedResult {
  const steps = seedSteps(repos, bundled);
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Same as seedBuiltinPacks, but yields to the event loop after each pack that did work and reports progress. */
export async function seedBuiltinPacksAsync(
  repos: Repos,
  bundled: unknown[],
  onProgress?: (p: SeedProgress) => void,
): Promise<BuiltinSeedResult> {
  const steps = seedSteps(repos, bundled);
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
    if (next.value.worked) {
      onProgress?.({ done: next.value.done, total: next.value.total });
      await nextTick();
    }
  }
}
