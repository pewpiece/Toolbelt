import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BackupError } from './backup';

/** Writes the backup to the cache folder and opens the Android share sheet (save to Drive, email, files...). */
export async function shareBackup(json: string, fileName: string): Promise<'shared' | 'unavailable'> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save DevCheat backup',
    UTI: 'public.json',
  });
  return 'shared';
}

/** Lets the user choose a .json file and returns its text, or null if they cancelled. */
export async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  try {
    return await new File(result.assets[0].uri).text();
  } catch {
    throw new BackupError('The selected file could not be read.');
  }
}
