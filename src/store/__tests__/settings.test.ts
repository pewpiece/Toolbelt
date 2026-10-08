import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { setReposForTesting } from '../repos';
import { DEFAULT_FONT_SIZE, parseFontSize, parseThemeMode, useSettings } from '../settings';

afterAll(() => setReposForTesting(null));

describe('settings store', () => {
  it('parses stored values defensively', () => {
    expect(parseThemeMode('dark')).toBe('dark');
    expect(parseThemeMode('purple')).toBe('system');
    expect(parseThemeMode(null)).toBe('system');
    expect(parseFontSize('18')).toBe(18);
    expect(parseFontSize('abc')).toBe(DEFAULT_FONT_SIZE);
    expect(parseFontSize('999')).toBe(DEFAULT_FONT_SIZE);
    expect(parseFontSize(null)).toBe(DEFAULT_FONT_SIZE);
  });

  it('persists changes and restores them on hydrate', () => {
    const repos = createRepos(createTestDb());
    setReposForTesting(repos);
    useSettings.getState().setThemeMode('dark');
    useSettings.getState().setFontSize(18);
    expect(repos.settings.get('themeMode')).toBe('dark');
    expect(repos.settings.get('fontSize')).toBe('18');

    useSettings.setState({ themeMode: 'system', fontSize: DEFAULT_FONT_SIZE });
    useSettings.getState().hydrate();
    expect(useSettings.getState()).toMatchObject({ themeMode: 'dark', fontSize: 18 });
  });

  it('keeps working in memory if saving fails', () => {
    setReposForTesting({
      settings: {
        set: () => {
          throw new Error('disk full');
        },
      },
    } as never);
    expect(() => useSettings.getState().setThemeMode('light')).not.toThrow();
    expect(useSettings.getState().themeMode).toBe('light');
  });
});
