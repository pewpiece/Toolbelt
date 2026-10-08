import { eq } from 'drizzle-orm';

import { settings } from '@/db/schema';
import type { AppDb } from '@/db/types';

export function createSettingsRepo(db: AppDb) {
  return {
    get(key: string): string | null {
      return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
    },
    set(key: string, value: string) {
      db.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .run();
    },
    all(): Record<string, string> {
      return Object.fromEntries(
        db
          .select()
          .from(settings)
          .all()
          .map((r) => [r.key, r.value]),
      );
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
