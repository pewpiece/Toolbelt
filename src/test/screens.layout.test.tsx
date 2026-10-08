import { render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import RootLayout from '../../app/_layout';
import { setReposForTesting } from '@/store/repos';
import { freshApp } from './harness';

jest.mock('expo-router', () => {
  const Stack = Object.assign(({ children }: { children?: ReactNode }) => children ?? null, { Screen: () => null });
  return { Stack };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

describe('Root layout bootstrap', () => {
  it('first launch: shows setup progress, installs all starter packs, then renders the app', async () => {
    const repos = freshApp();
    await render(<RootLayout />);
    expect(await screen.findByText(/Setting up your starter library\.\.\. \d+ \/ 34/, {}, { timeout: 15000 })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Setting up your starter library/)).toBeNull(), { timeout: 15000 });
    expect(repos.packs.list()).toHaveLength(34);
    expect(repos.items.pinned().length).toBeGreaterThan(10);
  });

  it('later launches: no setup screen, nothing reinstalled', async () => {
    const repos = freshApp({ seed: true });
    const before = repos.items.list({}, 100000).length;
    await render(<RootLayout />);
    await waitFor(() => expect(screen.queryByText('DevCheat')).toBeNull());
    expect(screen.queryByText(/Setting up/)).toBeNull();
    expect(repos.items.list({}, 100000).length).toBe(before);
  });

  it('shows a clear error screen if the database cannot be opened', async () => {
    setReposForTesting({
      settings: {
        get: () => {
          throw new Error('unable to open database file');
        },
      },
    } as never);
    await render(<RootLayout />);
    expect(await screen.findByText('DevCheat could not start: unable to open database file')).toBeTruthy();
    setReposForTesting(null);
  });
});
