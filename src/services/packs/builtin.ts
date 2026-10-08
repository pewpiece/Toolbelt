import type { Repos } from '@/data';
import type { PackDef } from '@/data/types';

import { validatePack } from './validate';

export interface BuiltinSeedResult {
  installed: string[];
  updated: string[];
  /** Bundled packs that failed validation (should be empty; surfaced instead of crashing startup). */
  invalid: string[];
}

const SEEDED_KEY = 'seededPacks';

/**
 * Installs the bundled starter packs on first launch and applies newer bundled versions on
 * app upgrades. A pack the user removed is remembered (SEEDED_KEY) and not reinstalled.
 * All merge rules from PacksRepo.apply apply: user items and pin state survive.
 */
export function seedBuiltinPacks(repos: Repos, bundled: unknown[]): BuiltinSeedResult {
  const result: BuiltinSeedResult = { installed: [], updated: [], invalid: [] };
  let seeded: string[] = [];
  try {
    const parsed: unknown = JSON.parse(repos.settings.get(SEEDED_KEY) ?? '[]');
    if (Array.isArray(parsed)) seeded = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    seeded = [];
  }

  for (const raw of bundled) {
    const v = validatePack(raw, { requireDescriptions: true });
    if (!v.ok) {
      result.invalid.push((raw as { name?: string })?.name ?? '(unnamed)');
      continue;
    }
    const pack: PackDef = v.pack;
    const existing = repos.packs.findByName(pack.name);
    if (!existing) {
      if (seeded.includes(pack.name)) continue; // user removed it earlier
      repos.packs.apply(pack, { source: 'builtin' });
      seeded.push(pack.name);
      result.installed.push(pack.name);
    } else if (existing.sourceUrl === null && existing.version !== pack.version) {
      repos.packs.apply(pack, { source: 'builtin' });
      result.updated.push(pack.name);
    }
  }
  repos.settings.set(SEEDED_KEY, JSON.stringify(seeded));
  return result;
}
