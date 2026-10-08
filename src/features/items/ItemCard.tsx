import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Item } from '@/data/types';
import { useTheme } from '@/features/settings/theme';

export function ItemCard({
  item,
  onOpen,
  onCopy,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onCopy: (item: Item) => void;
}) {
  const { colors, font } = useTheme();
  const preview = item.body.split('\n').find((l) => l.trim()) ?? '';
  return (
    <Pressable
      testID={`item-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      onPress={() => onOpen(item)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }}>
          {item.pinned ? '★ ' : ''}
          {item.title}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: font.code, fontFamily: 'monospace', marginTop: 2 }}>
          {preview}
        </Text>
      </View>
      <Pressable
        testID={`copy-${item.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${item.title}`}
        hitSlop={8}
        onPress={() => onCopy(item)}
        style={[styles.copy, { backgroundColor: colors.chip }]}
      >
        <Text style={{ color: colors.primary, fontSize: font.small, fontWeight: '700' }}>COPY</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  copy: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 10 },
});
