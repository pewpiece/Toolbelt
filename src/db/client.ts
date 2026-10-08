import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import { runMigrations } from './migrations';
import { schema } from './schema';
import type { AppDb } from './types';

let instance: AppDb | null = null;

/** Opens (once) the on-device database and brings it up to the latest schema. */
export function getDb(): AppDb {
  if (!instance) {
    const sqlite = openDatabaseSync('devcheat.db');
    const db = drizzle(sqlite, { schema });
    runMigrations(db);
    instance = db;
  }
  return instance;
}
