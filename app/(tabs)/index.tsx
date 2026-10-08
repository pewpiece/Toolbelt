import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Item } from '@/data/types';
import { Button, Chip, EmptyState, ErrorState } from '@/features/common/ui';
import { useQuery } from '@/features/common/useQuery';
import { ItemCard } from '@/features/items/ItemCard';
import { loadHome } from '@/features/items/homeQuery';
import { useTheme } from '@/features/settings/theme';
import { useCopy } from '@/store/copy';
import { getRepos } from '@/store/repos';

export default function Home() {
  const router = useRouter();
  const { colors, font } = useTheme();
  const requestCopy = useCopy((s) => s.requestCopy);
  const params = useLocalSearchParams<{ tag?: string }>();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const tag = params.tag ?? null;

  const { data, error, reload } = useQuery(
    () => loadHome(getRepos(), { text, category, language, tag }),
    `${text}|${category}|${language}|${tag}`,
  );

  const open = (i: Item) => router.push({ pathname: '/item/[id]', params: { id: String(i.id) } });
  const card = ({ item }: { item: Item }) => <ItemCard item={item} onOpen={open} onCopy={requestCopy} />;
  const filtering = !!(text.trim() || category || language || tag);

  const header = (
    <View style={styles.header}>
      <TextInput
        testID="search"
        accessibilityLabel="Search"
        value={text}
        onChangeText={setText}
        placeholder="Search snippets and commands"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: font.body }]}
      />
      {data && data.categories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} keyboardShouldPersistTaps="handled">
          {data.categories.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} testID={`cat-${c}`} />
          ))}
        </ScrollView>
      ) : null}
      {data && data.languages.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} keyboardShouldPersistTaps="handled">
          {data.languages.map((l) => (
            <Chip key={l} label={l} selected={language === l} onPress={() => setLanguage(language === l ? null : l)} testID={`lang-${l}`} />
          ))}
        </ScrollView>
      ) : null}
      {tag ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip label={`#${tag}  ✕`} selected onPress={() => router.setParams({ tag: undefined })} />
        </View>
      ) : null}
    </View>
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;

  const addButton = (
    <Stack.Screen
      options={{
        title: 'DevCheat',
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Add item" onPress={() => router.push('/item/edit')} hitSlop={10} style={{ paddingHorizontal: 14 }}>
            <Text style={{ color: colors.primary, fontSize: font.title, fontWeight: '600' }}>＋</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (!data) return addButton;

  if (data.mode === 'results') {
    return (
      <View style={{ flex: 1 }}>
        {addButton}
        <SectionList
          sections={[{ title: `${data.items.length} ${data.items.length === 1 ? 'result' : 'results'}`, data: data.items }]}
          keyExtractor={(i) => String(i.id)}
          renderItem={card}
          renderSectionHeader={({ section }) => <SectionTitle text={section.title} />}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No matches"
              hint={filtering ? 'Try a different word, or clear the filters.' : undefined}
              action={
                <Button
                  label="Clear search and filters"
                  variant="secondary"
                  onPress={() => {
                    setText('');
                    setCategory(null);
                    setLanguage(null);
                    router.setParams({ tag: undefined });
                  }}
                />
              }
            />
          }
        />
      </View>
    );
  }

  const sections = [
    ...(data.pinned.length ? [{ title: '★ Pinned', data: data.pinned }] : []),
    ...(data.mostUsed.length ? [{ title: 'Most used', data: data.mostUsed }] : []),
  ];
  return (
    <View style={{ flex: 1 }}>
      {addButton}
      <SectionList
        sections={sections}
        keyExtractor={(i) => String(i.id)}
        renderItem={card}
        renderSectionHeader={({ section }) => <SectionTitle text={section.title} />}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Nothing pinned or used yet"
            hint="Pick a category above to browse, search, or pin the items you reach for most."
            action={<Button label="Add item" onPress={() => router.push('/item/edit')} />}
          />
        }
      />
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  const { colors, font } = useTheme();
  return (
    <Text style={{ color: colors.muted, fontSize: font.small, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6, backgroundColor: colors.bg }}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 4 },
  list: { padding: 12, paddingBottom: 40 },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  chips: { marginBottom: 6, flexGrow: 0 },
});
