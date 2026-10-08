import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import Home from '../../app/(tabs)/index';
import { routerState, resetRouter } from './expoRouterMock';
import { freshApp } from './harness';
import { useCopy } from '@/store/copy';

jest.mock('expo-router', () => require('./expoRouterMock').expoRouterMock);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

beforeEach(() => {
  resetRouter();
  (Clipboard.setStringAsync as jest.Mock).mockClear();
});

describe('Home screen', () => {
  it('shows the empty state on a fresh database', async () => {
    freshApp();
    await render(<Home />);
    expect(await screen.findByText('Nothing pinned or used yet')).toBeTruthy();
  });

  it('lists the pinned Study & Career items by default', async () => {
    const repos = freshApp({ seed: true });
    await render(<Home />);
    expect(await screen.findByText('★ Pinned')).toBeTruthy();
    const pinned = repos.items.pinned();
    expect(pinned.length).toBeGreaterThan(5);
    expect(screen.getByText(`★ ${pinned[0].title}`)).toBeTruthy();
  });

  it('prefix-searches as you type and shows no-match feedback', async () => {
    freshApp({ seed: true });
    await render(<Home />);
    await fireEvent.changeText(screen.getByTestId('search'), 'rebas');
    expect(await screen.findByText(/results?$/)).toBeTruthy();
    expect(screen.getByText('Interactive rebase last N commits')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('search'), 'zzzzqq');
    expect(await screen.findByText('No matches')).toBeTruthy();
  });

  it('filters by category chip', async () => {
    freshApp({ seed: true });
    await render(<Home />);
    await fireEvent.press(await screen.findByTestId('cat-Reference'));
    await waitFor(() => expect(screen.getByText('Android: buttons and gestures')).toBeTruthy());
    expect(screen.queryByText('Interactive rebase last N commits')).toBeNull();
  });

  it('copies straight from a row and counts the use', async () => {
    const repos = freshApp({ seed: true });
    await render(<Home />);
    await fireEvent.changeText(screen.getByTestId('search'), 'rebase onto');
    const item = repos.items.search('rebase onto')[0];
    await fireEvent.press(await screen.findByTestId(`copy-${item.id}`));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(item.body));
    expect(repos.items.get(item.id)!.useCount).toBe(1);
  });

  it('opens the detail screen when a row is pressed', async () => {
    const repos = freshApp({ seed: true });
    await render(<Home />);
    const first = repos.items.pinned()[0];
    await fireEvent.press(await screen.findByTestId(`item-${first.id}`));
    expect(routerState.push).toHaveBeenCalledWith({ pathname: '/item/[id]', params: { id: String(first.id) } });
  });

  it('a row with {{variables}} opens the fill-in flow instead of copying immediately', async () => {
    const repos = freshApp();
    const item = repos.items.create({ title: 'SSH in', body: 'ssh {{user}}@{{host}}' });
    repos.items.setPinned(item.id, true);
    await render(<Home />);
    await fireEvent.press(await screen.findByTestId(`copy-${item.id}`));
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(useCopy.getState().variables).toEqual(['user', 'host']);
    await act(async () => {
      await useCopy.getState().confirm({ user: 'me', host: 'box' });
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ssh me@box');
  });
});
