import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Packs from '../../app/(tabs)/packs';
import { resetRouter } from './expoRouterMock';
import { freshApp } from './harness';
import { seedBuiltinPacks } from '@/services/packs/builtin';

import { BUILTIN_PACKS } from '../../assets/packs';

jest.mock('expo-router', () => require('./expoRouterMock').expoRouterMock);

const packJson = JSON.stringify({
  name: 'Imported',
  category: 'Custom',
  version: '1',
  items: [{ title: 'Hello', body: 'echo hi', description: 'greets' }],
});

function mockFetch(impl: () => Promise<unknown>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
}
const okResponse = (body: string) => ({ ok: true, status: 200, statusText: '', headers: { get: () => null }, text: async () => body });

beforeEach(resetRouter);

describe('Packs screen', () => {
  it('lists installed built-in packs', async () => {
    const repos = freshApp();
    // a handful of packs: fewer than the list's initial render batch, so no deferred (un-act-ed) list updates
    seedBuiltinPacks(repos, BUILTIN_PACKS.slice(0, 5));
    await render(<Packs />);
    expect(await screen.findByText('API testing')).toBeTruthy();
    expect(screen.getAllByText('Built-in packs are updated with the app.')).toHaveLength(5);
    expect(screen.queryByText('Update')).toBeNull();
  });

  it('imports a pack from a URL and shows a summary', async () => {
    const repos = freshApp();
    mockFetch(async () => okResponse(packJson));
    await render(<Packs />);
    await fireEvent.changeText(screen.getByTestId('pack-url'), 'https://example.com/pack.json');
    await fireEvent.press(screen.getByTestId('pack-import'));
    expect(await screen.findByText('Imported: 1 added, 0 updated.')).toBeTruthy();
    expect(repos.items.list().map((i) => i.title)).toEqual(['Hello']);
    expect(await screen.findByText('Imported')).toBeTruthy();
  });

  it('shows a readable error when the network is down and installs nothing', async () => {
    const repos = freshApp();
    mockFetch(async () => {
      throw new TypeError('Network request failed');
    });
    await render(<Packs />);
    await fireEvent.changeText(screen.getByTestId('pack-url'), 'https://example.com/pack.json');
    await fireEvent.press(screen.getByTestId('pack-import'));
    expect(await screen.findByText(/Could not reach the server/)).toBeTruthy();
    expect(repos.packs.list()).toEqual([]);
    // the button is usable again
    await waitFor(() => expect(screen.getByTestId('pack-import').props.accessibilityState.disabled).toBe(false));
  });

  it('rejects empty input, http URLs and invalid pack content without crashing', async () => {
    freshApp();
    await render(<Packs />);
    await fireEvent.press(screen.getByTestId('pack-import'));
    expect(await screen.findByText(/Paste a URL/)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('pack-url'), 'http://example.com/pack.json');
    await fireEvent.press(screen.getByTestId('pack-import'));
    expect(await screen.findByText('Only https:// URLs are supported.')).toBeTruthy();

    mockFetch(async () => okResponse('{"name":"x"}'));
    await fireEvent.changeText(screen.getByTestId('pack-url'), 'https://example.com/bad.json');
    await fireEvent.press(screen.getByTestId('pack-import'));
    expect(await screen.findByText(/Not a valid pack/)).toBeTruthy();
  });

  it('updates an imported pack and reports "already up to date"', async () => {
    freshApp();
    mockFetch(async () => okResponse(packJson));
    await render(<Packs />);
    await fireEvent.changeText(screen.getByTestId('pack-url'), 'https://example.com/pack.json');
    await fireEvent.press(screen.getByTestId('pack-import'));
    const update = await screen.findByText('Update');
    await fireEvent.press(update);
    expect(await screen.findByText('Imported is already up to date.')).toBeTruthy();
  });
});
