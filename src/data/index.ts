import type { AppDb } from '@/db/types';

import { createBackupRepo } from './backupRepo';
import { createCollectionsRepo } from './collectionsRepo';
import { createItemsRepo } from './itemsRepo';
import { createPacksRepo } from './packsRepo';
import { createSettingsRepo } from './settingsRepo';

export function createRepos(db: AppDb, now: () => number = Date.now) {
  return {
    items: createItemsRepo(db, now),
    packs: createPacksRepo(db, now),
    collections: createCollectionsRepo(db, now),
    settings: createSettingsRepo(db),
    backup: createBackupRepo(db, now),
  };
}

export type Repos = ReturnType<typeof createRepos>;
