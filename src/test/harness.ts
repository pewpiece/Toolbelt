import { createRepos, type Repos } from '@/data';
import { createTestDb } from '@/db/testing';
import { seedBuiltinPacks } from '@/services/packs/builtin';
import { useCopy } from '@/store/copy';
import { useLibrary } from '@/store/library';
import { setReposForTesting } from '@/store/repos';
import { useToast } from '@/store/toast';

import { BUILTIN_PACKS } from '../../assets/packs';

/** Fresh in-memory app state for a screen test; optionally with all bundled starter packs installed. */
export function freshApp(opts: { seed?: boolean } = {}): Repos {
  const repos = createRepos(createTestDb());
  setReposForTesting(repos);
  if (opts.seed) seedBuiltinPacks(repos, BUILTIN_PACKS);
  useCopy.getState().cancel();
  useToast.getState().hide();
  useLibrary.setState({ revision: 0 });
  return repos;
}
