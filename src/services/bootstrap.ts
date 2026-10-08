import { BUILTIN_PACKS } from '../../assets/packs';

import { useSettings } from '@/store/settings';
import { getRepos } from '@/store/repos';

import { seedBuiltinPacks, type BuiltinSeedResult } from './packs/builtin';

/**
 * Runs once at app start: opens and migrates the database, loads persisted settings and
 * installs (or upgrades) the bundled starter packs. Idempotent and cheap after the first launch.
 */
export function bootstrap(): BuiltinSeedResult {
  useSettings.getState().hydrate();
  return seedBuiltinPacks(getRepos(), BUILTIN_PACKS);
}
