import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CodeBlock } from '@/features/items/CodeBlock';
import { Button, Chip, EmptyState, ErrorState } from '@/features/common/ui';
import { useQuery } from '@/features/common/useQuery';
import { useTheme } from '@/features/settings/theme';
import { useCopy } from '@/store/copy';
import { useLibrary } from '@/store/library';
import { getRepos } from '@/store/repos';
import { useToast } from '@/store/toast';

export function formatLastUsed(ts: number | null, now = Date.now()): string {
  if (!ts) return 'Never copied';
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return 'Last used just now';
  if (mins < 60) return `Last used ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last used ${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Last used ${days} d ago`;
  return `Last used ${new Date(ts).toISOString().slice(0, 10)}`;
}

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const router = useRouter();
  const { colors, font } = useTheme();
  const bump = useLibrary((s) => s.bump);
  const requestCopy = useCopy((s) => s.requestCopy);
  const { data: item, error, reload } = useQuery(() => getRepos().items.get(itemId), itemId);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (item === undefined) return null;
  if (item === null) return <EmptyState title="Item not found" hint="It may have been deleted." />;

  function togglePin() {
    getRepos().items.setPinned(item!.id, !item!.pinned);
    bump();
  }

  function confirmDelete() {
    Alert.alert('Delete item?', `"${item!.title}" will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          getRepos().items.remove(item!.id);
          bump();
          useToast.getState().show('Deleted');
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '' }} />
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }} accessibilityRole="header">
        {item.title}
      </Text>
      <View style={styles.meta}>
        <Chip label={item.type} />
        {item.language ? <Chip label={item.language} /> : null}
        {item.source !== 'user' ? <Chip label={item.source} /> : null}
      </View>

      <Button label="Copy" onPress={() => requestCopy(item)} testID="copy-button" style={styles.copy} />

      {item.description ? (
        <Text style={{ color: colors.text, fontSize: font.body, marginBottom: 14 }}>{item.description}</Text>
      ) : null}

      <CodeBlock code={item.body} language={item.language} />

      {item.tags.length > 0 ? (
        <View style={[styles.meta, { marginTop: 14 }]}>
          {item.tags.map((t) => (
            <Chip key={t} label={`#${t}`} onPress={() => router.push({ pathname: '/', params: { tag: t } })} />
          ))}
        </View>
      ) : null}

      <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 14 }}>
        {formatLastUsed(item.lastUsedAt)} · copied {item.useCount} {item.useCount === 1 ? 'time' : 'times'}
      </Text>

      <View style={styles.actions}>
        <Button label={item.pinned ? 'Unpin' : 'Pin'} variant="secondary" onPress={togglePin} style={styles.action} testID="pin-button" />
        <Button label="Edit" variant="secondary" onPress={() => router.push({ pathname: '/item/edit', params: { id: String(item.id) } })} style={styles.action} />
        <Button label="Delete" variant="danger" onPress={confirmDelete} style={styles.action} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 60 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  copy: { marginVertical: 16, paddingVertical: 18 },
  actions: { flexDirection: 'row', marginTop: 22 },
  action: { flex: 1, marginRight: 8 },
});
