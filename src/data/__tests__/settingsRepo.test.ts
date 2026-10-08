import { createRepos } from '..';
import { createTestDb } from '@/db/testing';

it('stores and overwrites settings', () => {
  const { settings } = createRepos(createTestDb());
  expect(settings.get('theme')).toBeNull();
  settings.set('theme', 'dark');
  settings.set('theme', 'light');
  settings.set('fontSize', '18');
  expect(settings.get('theme')).toBe('light');
  expect(settings.all()).toEqual({ theme: 'light', fontSize: '18' });
});
