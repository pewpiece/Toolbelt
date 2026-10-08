import * as Clipboard from 'expo-clipboard';

import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { useCopy } from '../copy';
import { setReposForTesting } from '../repos';
import { useToast } from '../toast';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const setString = Clipboard.setStringAsync as jest.Mock;

function setup() {
  const repos = createRepos(createTestDb());
  setReposForTesting(repos);
  setString.mockClear();
  setString.mockResolvedValue(true);
  useCopy.getState().cancel();
  useToast.getState().hide();
  return repos;
}

afterAll(() => setReposForTesting(null));

describe('copy flow', () => {
  it('copies a plain item immediately and records usage', async () => {
    const repos = setup();
    const item = repos.items.create({ title: 'T', body: 'echo hi' });
    await useCopy.getState().requestCopy(item);
    expect(setString).toHaveBeenCalledWith('echo hi');
    const after = repos.items.get(item.id)!;
    expect(after.useCount).toBe(1);
    expect(after.lastUsedAt).not.toBeNull();
    expect(useToast.getState().message).toBe('Copied');
    expect(useCopy.getState().pending).toBeNull();
  });

  it('asks for variables first, then copies the filled text', async () => {
    const repos = setup();
    const item = repos.items.create({ title: 'SSH', body: 'ssh {{user}}@{{host}}' });
    await useCopy.getState().requestCopy(item);
    expect(setString).not.toHaveBeenCalled();
    expect(useCopy.getState().variables).toEqual(['user', 'host']);
    expect(repos.items.get(item.id)!.useCount).toBe(0);

    await useCopy.getState().confirm({ user: 'me', host: 'box' });
    expect(setString).toHaveBeenCalledWith('ssh me@box');
    expect(repos.items.get(item.id)!.useCount).toBe(1);
    expect(useCopy.getState().pending).toBeNull();
  });

  it('cancelling copies nothing and does not count a use', async () => {
    const repos = setup();
    const item = repos.items.create({ title: 'SSH', body: 'ssh {{user}}' });
    await useCopy.getState().requestCopy(item);
    useCopy.getState().cancel();
    expect(setString).not.toHaveBeenCalled();
    expect(repos.items.get(item.id)!.useCount).toBe(0);
  });

  it('does not count a use when the clipboard fails, and shows an error', async () => {
    const repos = setup();
    setString.mockRejectedValueOnce(new Error('denied'));
    const item = repos.items.create({ title: 'T', body: 'x' });
    await useCopy.getState().requestCopy(item);
    expect(repos.items.get(item.id)!.useCount).toBe(0);
    expect(useToast.getState()).toMatchObject({ tone: 'error' });
  });
});
