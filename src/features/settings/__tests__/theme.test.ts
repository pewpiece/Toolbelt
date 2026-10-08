import { buildTheme, darkPalette, lightPalette } from '../theme';

describe('buildTheme', () => {
  it('follows the system scheme only in system mode', () => {
    expect(buildTheme('system', 'dark', 15).dark).toBe(true);
    expect(buildTheme('system', 'light', 15).dark).toBe(false);
    expect(buildTheme('system', null, 15).dark).toBe(false);
    expect(buildTheme('light', 'dark', 15).colors).toBe(lightPalette);
    expect(buildTheme('dark', 'light', 15).colors).toBe(darkPalette);
  });

  it('scales fonts from the base size with sane minimums', () => {
    expect(buildTheme('light', 'light', 20).font).toEqual({ body: 20, small: 17, title: 25, code: 19 });
    expect(buildTheme('light', 'light', 13).font).toEqual({ body: 13, small: 11, title: 18, code: 12 });
  });

  it('both palettes define every token colour', () => {
    expect(Object.keys(lightPalette.token).sort()).toEqual(Object.keys(darkPalette.token).sort());
  });
});
