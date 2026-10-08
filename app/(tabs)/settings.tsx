import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Chip } from '@/features/common/ui';
import { useTheme } from '@/features/settings/theme';
import { backupFileName, createBackupJson, describeRestore, restoreBackup } from '@/services/backup';
import { pickBackupText, shareBackup } from '@/services/backupIO';
import { useLibrary } from '@/store/library';
import { getRepos } from '@/store/repos';
import { FONT_SIZES, useSettings, type ThemeMode } from '@/store/settings';

type Status = { tone: 'ok' | 'error'; text: string } | null;

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export default function Settings() {
  const { colors, font } = useTheme();
  const { themeMode, fontSize, setThemeMode, setFontSize } = useSettings();
  const bump = useLibrary((s) => s.bump);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function guarded(job: () => Promise<string | null>) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const text = await job();
      if (text) setStatus({ tone: 'ok', text });
    } catch (e) {
      setStatus({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  const exportLibrary = () =>
    guarded(async () => {
      const result = await shareBackup(createBackupJson(getRepos()), backupFileName());
      return result === 'unavailable' ? 'Sharing is not available on this device.' : 'Backup ready. Choose where to save it.';
    });

  const importLibrary = () =>
    guarded(async () => {
      const text = await pickBackupText();
      if (text === null) return null;
      const choice = await askMode();
      if (choice === null) return 'Import cancelled. Nothing was changed.';
      const summary = restoreBackup(getRepos(), text, choice);
      bump();
      return describeRestore(summary);
    });

  const section = (t: string) => (
    <Text style={{ color: colors.muted, fontSize: font.small, fontWeight: '700', textTransform: 'uppercase', marginTop: 22, marginBottom: 8 }}>
      {t}
    </Text>
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {section('Theme')}
      <View style={styles.row}>
        {THEMES.map((t) => (
          <Chip key={t.mode} label={t.label} selected={themeMode === t.mode} onPress={() => setThemeMode(t.mode)} testID={`theme-${t.mode}`} />
        ))}
      </View>

      {section('Font size')}
      <View style={styles.row}>
        {FONT_SIZES.map((n) => (
          <Chip key={n} label={String(n)} selected={fontSize === n} onPress={() => setFontSize(n)} testID={`font-${n}`} />
        ))}
      </View>
      <View style={[styles.preview, { backgroundColor: colors.codeBg, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: font.body }}>The quick brown fox jumps over the lazy dog.</Text>
        <Text style={{ color: colors.muted, fontFamily: 'monospace', fontSize: font.code, marginTop: 4 }}>git status -sb</Text>
      </View>

      {section('Backup')}
      <Text style={{ color: colors.muted, fontSize: font.small, marginBottom: 10 }}>
        Export your whole library (items, tags, collections, packs, pins and usage) to a JSON file, or restore one. Backups contain only data on this device.
      </Text>
      <Button label="Export library (JSON)" onPress={exportLibrary} disabled={busy} testID="export" />
      <Button label="Import library (JSON)" variant="secondary" onPress={importLibrary} disabled={busy} style={{ marginTop: 8 }} testID="import" />
      {status ? (
        <Text accessibilityRole="alert" style={{ marginTop: 12, fontSize: font.body, color: status.tone === 'error' ? colors.danger : colors.text }}>
          {status.text}
        </Text>
      ) : null}

      {section('About')}
      <Text style={{ color: colors.muted, fontSize: font.small }}>
        DevCheat {Constants.expoConfig?.version ?? ''} · everything stays on this device. No account, no tracking.
      </Text>
    </ScrollView>
  );
}

/** Asks how to apply a backup. Resolves to null when the user cancels. */
function askMode(): Promise<'merge' | 'replace' | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Import backup',
      'Merge adds what is missing and keeps your current data. Replace deletes everything on this device first.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Merge', onPress: () => resolve('merge') },
        {
          text: 'Replace all',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Replace everything?', 'All current items, collections and packs on this device will be deleted.', [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              { text: 'Replace', style: 'destructive', onPress: () => resolve('replace') },
            ]),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 60 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  preview: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginTop: 8 },
});
