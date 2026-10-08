import { createRepos, type Repos } from '@/data';
import { getDb } from '@/db/client';

let repos: Repos | null = null;

/** The app-wide repositories, bound to the on-device database (opened and migrated on first use). */
export function getRepos(): Repos {
  if (!repos) repos = createRepos(getDb());
  return repos;
}

/** Test seam: inject repositories bound to an in-memory database. */
export function setReposForTesting(r: Repos | null) {
  repos = r;
}
