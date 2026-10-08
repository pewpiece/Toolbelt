import { BUILTIN_PACKS } from '../../assets/packs';

import { getRepos } from '@/store/repos';
import { useSettings } from '@/store/settings';

import { seedBuiltinPacksAsync, type BuiltinSeedResult, type SeedProgress } from './packs/builtin';

/**
 * Step 1 (synchronous, fast): opens and migrates the database and loads saved settings.
 * Throws if the database cannot be opened; the root layout shows that as an error screen.
 */
export function bootstrapDatabase() {
  useSettings.getState().hydrate();
}

/**
 * Step 2 (async): installs the bundled starter packs on first launch, or upgrades them after an
 * app update. Does nothing (and returns quickly) on every later launch.
 */
export function seedStarterPacks(onProgress?: (p: SeedProgress) => void): Promise<BuiltinSeedResult> {
  return seedBuiltinPacksAsync(getRepos(), BUILTIN_PACKS, onProgress);
}
