import { useSettings } from '@/store/settings';

/** Runs once at app start: loads persisted settings (this also opens and migrates the database). */
export function bootstrap() {
  useSettings.getState().hydrate();
}
