import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Collection } from '@/data/types';
import { Button } from '@/features/common/ui';
import { useTheme } from '@/features/settings/theme';

/** Modal to tick which collections an item belongs to, with inline "new collection". */
export function CollectionPicker({
  visible,
  collections,
  memberIds,
  onToggle,
  onCreate,
  onClose,
}: {
  visible: boolean;
  collections: Collection[];
  memberIds: number[];
  onToggle: (collection: Collection, isMember: boolean) => void;
  /** May throw (ValidationError); the message is shown under the field. */
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? (
        <PickerBody collections={collections} memberIds={memberIds} onToggle={onToggle} onCreate={onCreate} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function PickerBody({
  collections,
  memberIds,
  onToggle,
  onCreate,
  onClose,
}: Omit<Parameters<typeof CollectionPicker>[0], 'visible'>) {
  const { colors, font } = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function create() {
    try {
      onCreate(name);
      setName('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the collection.');
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.text, fontSize: font.title - 2, fontWeight: '700', marginBottom: 8 }}>Add to collection</Text>
        <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
          {collections.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: font.body, marginVertical: 10 }}>No collections yet. Create one below.</Text>
          ) : null}
          {collections.map((c) => {
            const member = memberIds.includes(c.id);
            return (
              <Pressable
                key={c.id}
                testID={`pick-${c.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: member }}
                onPress={() => onToggle(c, member)}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <Text style={{ color: colors.primary, fontSize: font.body, width: 28 }}>{member ? '☑' : '☐'}</Text>
                <Text style={{ color: colors.text, fontSize: font.body }}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.newRow}>
          <TextInput
            testID="new-collection"
            accessibilityLabel="New collection name"
            value={name}
            onChangeText={setName}
            placeholder="New collection"
            placeholderTextColor={colors.muted}
            onSubmitEditing={create}
            style={[styles.input, { color: colors.text, borderColor: colors.border, fontSize: font.body }]}
          />
          <Button label="Create" onPress={create} variant="secondary" style={{ marginLeft: 8 }} testID="create-collection" />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: font.small, marginTop: 4 }}>
            {error}
          </Text>
        ) : null}
        <Button label="Done" onPress={onClose} style={{ marginTop: 14 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  newRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
