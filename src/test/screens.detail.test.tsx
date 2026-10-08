import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import ItemDetail, { formatLastUsed } from '../../app/item/[id]';
import { VariableFormHost } from '@/features/items/VariableForm';
import { routerState, resetRouter } from './expoRouterMock';
import { freshApp } from './harness';

jest.mock('expo-router', () => require('./expoRouterMock').expoRouterMock);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

beforeEach(() => {
  resetRouter();
  (Clipboard.setStringAsync as jest.Mock).mockClear();
});

describe('formatLastUsed', () => {
  it('describes recency', () => {
    const now = Date.UTC(2026, 9, 8, 12, 0, 0);
    expect(formatLastUsed(null, now)).toBe('Never copied');
    expect(formatLastUsed(now - 10_000, now)).toBe('Last used just now');
    expect(formatLastUsed(now - 5 * 60_000, now)).toBe('Last used 5 min ago');
    expect(formatLastUsed(now - 3 * 3_600_000, now)).toBe('Last used 3 h ago');
    expect(formatLastUsed(now - 2 * 86_400_000, now)).toBe('Last used 2 d ago');
    expect(formatLastUsed(now - 90 * 86_400_000, now)).toBe('Last used 2026-07-10');
  });
});

describe('Item detail screen', () => {
  it('shows the item, copies it, and updates the usage line', async () => {
    const repos = freshApp();
    const item = repos.items.create({ title: 'Undo commit', body: 'git reset --soft HEAD~1', description: 'Keeps changes staged', type: 'command', tags: ['git'], language: 'bash' });
    routerState.params = { id: String(item.id) };
    await render(<ItemDetail />);
    expect(await screen.findByText('Undo commit')).toBeTruthy();
    expect(screen.getByText('Keeps changes staged')).toBeTruthy();
    expect(screen.getByText('#git')).toBeTruthy();
    expect(screen.getByText(/Never copied/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('copy-button'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('git reset --soft HEAD~1'));
    expect(await screen.findByText(/Last used just now/)).toBeTruthy();
    expect(screen.getByText(/copied 1 time$/)).toBeTruthy();
  });

  it('asks for {{variables}} on Copy and copies the filled text', async () => {
    const repos = freshApp();
    const item = repos.items.create({ title: 'Checkout', body: 'git checkout -b {{branch}} {{base}}' });
    routerState.params = { id: String(item.id) };
    await render(
      <>
        <ItemDetail />
        <VariableFormHost />
      </>,
    );
    await fireEvent.press(await screen.findByTestId('copy-button'));
    await fireEvent.changeText(await screen.findByTestId('var-branch'), 'feat/x');
    await fireEvent.changeText(screen.getByTestId('var-base'), 'main');
    await fireEvent.press(screen.getByTestId('var-submit'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('git checkout -b feat/x main'));
    expect(repos.items.get(item.id)!.useCount).toBe(1);
  });

  it('toggles the pin', async () => {
    const repos = freshApp();
    const item = repos.items.create({ title: 'T', body: 'b' });
    routerState.params = { id: String(item.id) };
    await render(<ItemDetail />);
    await fireEvent.press(await screen.findByTestId('pin-button'));
    expect(repos.items.get(item.id)!.pinned).toBe(true);
    expect(await screen.findByText('Unpin')).toBeTruthy();
  });

  it('shows a friendly message for a missing item', async () => {
    freshApp();
    routerState.params = { id: '999' };
    await render(<ItemDetail />);
    expect(await screen.findByText('Item not found')).toBeTruthy();
  });
});
