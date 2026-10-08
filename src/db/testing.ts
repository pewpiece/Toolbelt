import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { runMigrations } from './migrations';
import { schema } from './schema';
import type { AppDb } from './types';

/** In-memory database with all migrations applied. Test-only (better-sqlite3 is a devDependency). */
export function createTestDb(): AppDb {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema }) as unknown as AppDb;
  runMigrations(db);
  return db;
}
