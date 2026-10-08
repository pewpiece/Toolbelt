import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Pack } from '@/data/types';
import { Button, EmptyState, ErrorState } from '@/features/common/ui';
import { useQuery } from '@/features/common/useQuery';
import { useTheme } from '@/features/settings/theme';
import { createPackService, describeImportError, summarize } from '@/services/packs/service';
import { useLibrary } from '@/store/library';
import { getRepos } from '@/store/repos';

type Status = { tone: 'ok' | 'error'; text: string } | null;

export default function PacksScreen() {
  const { colors, font } = useTheme();
  const bump = useLibrary((s) => s.bump);
  const [url, setUrl] = useState('');
  const [busyId, setBusyId] = useState<number | 'import' | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const { data, error, reload } = useQuery(() => getRepos().packs.list());

  async function run(id: number | 'import', job: () => Promise<string>) {
    if (busyId !== null) return;
    setBusyId(id);
    setStatus(null);
    try {
      setStatus({ tone: 'ok', text: await job() });
      bump();
    } catch (e) {
      setStatus({ tone: 'error', text: describeImportError(e) });
    } finally {
      setBusyId(null);
    }
  }

  const importUrl = () =>
    run('import', async () => {
      if (!url.trim()) throw new Error('Paste a URL to a pack (.json) or a tldr page (.md).');
      const result = await createPackService(getRepos()).importFromUrl(url);
      setUrl('');
      return summarize(result);
    });

  const update = (pack: Pack) =>
    run(pack.id, async () => summarize(await createPackService(getRepos()).updatePack(pack.id)));

  function confirmRemove(pack: Pack) {
    Alert.alert(
      `Remove "${pack.name}"?`,
      'Its items are deleted. Items you edited or created yourself are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            getRepos().packs.remove(pack.id);
            bump();
          },
        },
      ],
    );
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.muted, fontSize: font.small, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
            Import from URL
          </Text>
          <TextInput
            testID="pack-url"
            accessibilityLabel="Pack URL"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://.../pack.json or tldr page .md"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, fontSize: font.body }]}
          />
          <Button
            label={busyId === 'import' ? 'Importing...' : 'Import'}
            onPress={importUrl}
            disabled={busyId !== null}
            style={{ marginTop: 8 }}
            testID="pack-import"
          />
          {busyId !== null ? <ActivityIndicator style={{ marginTop: 10 }} color={colors.primary} /> : null}
          {status ? (
            <Text
              accessibilityRole="alert"
              style={{ marginTop: 10, fontSize: font.body, color: status.tone === 'error' ? colors.danger : colors.text }}
            >
              {status.text}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState title="No packs installed" hint="Starter packs install on first launch. You can also import a pack by URL above." />
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{item.name}</Text>
          <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 2 }}>
            {item.category} · {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'} · v{item.version} ·{' '}
            {item.sourceUrl ? 'imported' : 'built-in'}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            {item.sourceUrl ? (
              <Button
                label={busyId === item.id ? 'Updating...' : 'Update'}
                variant="secondary"
                onPress={() => update(item)}
                disabled={busyId !== null}
                style={{ marginRight: 8 }}
                testID={`pack-update-${item.id}`}
              />
            ) : null}
            <Button label="Remove" variant="secondary" onPress={() => confirmRemove(item)} disabled={busyId !== null} />
          </View>
          {item.sourceUrl ? null : (
            <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 8 }}>Built-in packs are updated with the app.</Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  card: { padding: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
});
