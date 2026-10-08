import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Text, TextInput, View } from 'react-native';

import type { Item } from '@/data/types';
import { Button, EmptyState, ErrorState } from '@/features/common/ui';
import { useQuery } from '@/features/common/useQuery';
import { ItemCard } from '@/features/items/ItemCard';
import { useTheme } from '@/features/settings/theme';
import { useCopy } from '@/store/copy';
import { useLibrary } from '@/store/library';
import { getRepos } from '@/store/repos';

export default function CollectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collectionId = Number(id);
  const router = useRouter();
  const { colors, font } = useTheme();
  const bump = useLibrary((s) => s.bump);
  const requestCopy = useCopy((s) => s.requestCopy);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const { data, error, reload } = useQuery(() => {
    const repos = getRepos();
    const collection = repos.collections.get(collectionId);
    return { collection, items: collection ? repos.collections.items(collectionId) : [] };
  }, collectionId);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const { collection, items } = data;
  if (!collection) return <EmptyState title="Collection not found" hint="It may have been deleted." />;

  function saveRename() {
    try {
      getRepos().collections.rename(collectionId, renaming ?? '');
      setRenaming(null);
      setRenameError(null);
      bump();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Could not rename.');
    }
  }

  function confirmRemove(item: Item) {
    Alert.alert('Remove from collection?', `"${item.title}" stays in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        onPress: () => {
          getRepos().collections.removeItem(collectionId, item.id);
          bump();
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete collection?', 'Its items stay in your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          getRepos().collections.remove(collectionId);
          bump();
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: collection.name }} />
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            {renaming !== null ? (
              <View>
                <TextInput
                  testID="rename-input"
                  accessibilityLabel="Collection name"
                  value={renaming}
                  onChangeText={setRenaming}
                  autoFocus
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.text, fontSize: font.body, backgroundColor: colors.surface }}
                />
                {renameError ? <Text style={{ color: colors.danger, fontSize: font.small, marginTop: 4 }}>{renameError}</Text> : null}
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Button label="Save" onPress={saveRename} style={{ marginRight: 8 }} />
                  <Button label="Cancel" variant="secondary" onPress={() => { setRenaming(null); setRenameError(null); }} />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row' }}>
                <Button label="Rename" variant="secondary" onPress={() => setRenaming(collection.name)} style={{ marginRight: 8 }} />
                <Button label="Delete" variant="danger" onPress={confirmDelete} />
              </View>
            )}
            {items.length > 0 ? (
              <Text style={{ color: colors.muted, fontSize: font.small, marginTop: 10 }}>Long-press an item to remove it from this collection.</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState title="Empty collection" hint='Open an item and tap "Collections" to add it here.' />}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onOpen={(i) => router.push({ pathname: '/item/[id]', params: { id: String(i.id) } })}
            onCopy={requestCopy}
            onLongPress={confirmRemove}
          />
        )}
      />
    </View>
  );
}
