import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ValidationError } from '@/data/validation';
import { Button, EmptyState, ErrorState } from '@/features/common/ui';
import { useQuery } from '@/features/common/useQuery';
import { useTheme } from '@/features/settings/theme';
import { useLibrary } from '@/store/library';
import { getRepos } from '@/store/repos';

export default function Collections() {
  const router = useRouter();
  const { colors, font } = useTheme();
  const bump = useLibrary((s) => s.bump);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadError, reload } = useQuery(() => getRepos().collections.list());

  function create() {
    try {
      getRepos().collections.create(name);
      setName('');
      setError(null);
      bump();
    } catch (e) {
      setError(e instanceof ValidationError || e instanceof Error ? e.message : 'Could not create the collection.');
    }
  }

  function confirmDelete(id: number, label: string) {
    Alert.alert('Delete collection?', `"${label}" will be deleted. Its items stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          getRepos().collections.remove(id);
          bump();
        },
      },
    ]);
  }

  if (loadError) return <ErrorState message={loadError} onRetry={reload} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={{ padding: 12 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ marginBottom: 12 }}>
          <View style={styles.newRow}>
            <TextInput
              testID="new-collection-name"
              accessibilityLabel="New collection name"
              value={name}
              onChangeText={setName}
              onSubmitEditing={create}
              placeholder="New collection name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, fontSize: font.body }]}
            />
            <Button label="Add" onPress={create} style={{ marginLeft: 8 }} testID="add-collection" />
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: font.small, marginTop: 4 }}>
              {error}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyState title="No collections yet" hint="Group items you use together, like a project or an exam topic." />}
      renderItem={({ item }) => (
        <Pressable
          testID={`collection-${item.id}`}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/collection/[id]', params: { id: String(item.id) } })}
          onLongPress={() => confirmDelete(item.id, item.name)}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600', flex: 1 }}>{item.name}</Text>
          <Text style={{ color: colors.muted, fontSize: font.small }}>
            {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  newRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
});
