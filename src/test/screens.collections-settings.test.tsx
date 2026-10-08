import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Collections from '../../app/(tabs)/collections';
import Settings from '../../app/(tabs)/settings';
import { createBackupJson } from '@/services/backup';
import { pickBackupText, shareBackup } from '@/services/backupIO';
import { useSettings } from '@/store/settings';
import { resetRouter } from './expoRouterMock';
import { freshApp } from './harness';

jest.mock('expo-router', () => require('./expoRouterMock').expoRouterMock);
jest.mock('@/services/backupIO', () => ({ shareBackup: jest.fn(), pickBackupText: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));

beforeEach(() => {
  resetRouter();
  jest.clearAllMocks();
});

describe('Collections screen', () => {
  it('shows an empty state, creates collections and validates the name', async () => {
    const repos = freshApp();
    await render(<Collections />);
    expect(await screen.findByText('No collections yet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('add-collection'));
    expect(await screen.findByText('Name is required.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('new-collection-name'), 'Exam prep');
    await fireEvent.press(screen.getByTestId('add-collection'));
    expect(await screen.findByText('Exam prep')).toBeTruthy();
    expect(screen.queryByText('Name is required.')).toBeNull();
    expect(repos.collections.list().map((c) => c.name)).toEqual(['Exam prep']);
    expect(screen.getByText('0 items')).toBeTruthy();
  });
});

describe('Settings screen', () => {
  it('changes and persists theme and font size', async () => {
    const repos = freshApp();
    useSettings.setState({ themeMode: 'system', fontSize: 15 });
    await render(<Settings />);
    await fireEvent.press(screen.getByTestId('theme-dark'));
    await fireEvent.press(screen.getByTestId('font-20'));
    expect(useSettings.getState()).toMatchObject({ themeMode: 'dark', fontSize: 20 });
    expect(repos.settings.get('themeMode')).toBe('dark');
    expect(repos.settings.get('fontSize')).toBe('20');
  });

  it('exports the library through the share sheet', async () => {
    const repos = freshApp({ seed: true });
    (shareBackup as jest.Mock).mockResolvedValue('shared');
    await render(<Settings />);
    await fireEvent.press(screen.getByTestId('export'));
    await waitFor(() => expect(shareBackup).toHaveBeenCalled());
    const [json, name] = (shareBackup as jest.Mock).mock.calls[0];
    expect(JSON.parse(json).items.length).toBe(repos.items.list({}, 100000).length);
    expect(name).toMatch(/^devcheat-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(await screen.findByText(/Backup ready/)).toBeTruthy();
  });

  it('reports an export failure instead of crashing', async () => {
    freshApp();
    (shareBackup as jest.Mock).mockRejectedValue(new Error('No space left on device'));
    await render(<Settings />);
    await fireEvent.press(screen.getByTestId('export'));
    expect(await screen.findByText('No space left on device')).toBeTruthy();
  });

  it('import: cancelling the picker changes nothing; a bad file shows a clear error', async () => {
    const repos = freshApp();
    repos.items.create({ title: 'Keep', body: 'me' });
    await render(<Settings />);

    (pickBackupText as jest.Mock).mockResolvedValue(null);
    await fireEvent.press(screen.getByTestId('import'));
    await waitFor(() => expect(pickBackupText).toHaveBeenCalledTimes(1));

    (pickBackupText as jest.Mock).mockResolvedValue('this is not json');
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Merge')?.onPress?.());
    await fireEvent.press(screen.getByTestId('import'));
    expect(await screen.findByText('This is not a valid JSON file.')).toBeTruthy();
    expect(repos.items.list().map((i) => i.title)).toEqual(['Keep']);
  });

  it('import: merges a valid backup after the user picks Merge', async () => {
    const source = freshApp({ seed: true });
    const json = createBackupJson(source);
    const repos = freshApp();
    (pickBackupText as jest.Mock).mockResolvedValue(json);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Merge')?.onPress?.());
    await render(<Settings />);
    await fireEvent.press(screen.getByTestId('import'));
    expect(await screen.findByText(/Backup merged: \d+ items added/)).toBeTruthy();
    expect(repos.items.list({}, 100000).length).toBeGreaterThan(300);
  });

  it('import: Cancel in the mode dialog leaves the library untouched', async () => {
    const json = createBackupJson(freshApp({ seed: true }));
    const repos = freshApp();
    (pickBackupText as jest.Mock).mockResolvedValue(json);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Cancel')?.onPress?.());
    await render(<Settings />);
    await fireEvent.press(screen.getByTestId('import'));
    expect(await screen.findByText(/Import cancelled/)).toBeTruthy();
    expect(repos.items.list()).toEqual([]);
  });
});
