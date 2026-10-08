import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type { schema } from './schema';

/**
 * Both drivers we use (expo-sqlite in the app, better-sqlite3 in tests) are synchronous
 * drizzle drivers, so repositories are written against this one type.
 */
export type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>;
