import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ITEM_TYPES, type Item, type ItemInput, type ItemType } from '@/data/types';
import { LIMITS, ValidationError } from '@/data/validation';
import { Button, Chip } from '@/features/common/ui';
import { useTheme } from '@/features/settings/theme';

export function ItemForm({
  initial,
  onSubmit,
  submitLabel = 'Save',
}: {
  initial?: Item | null;
  /** May throw; a ValidationError is shown next to its field, anything else at the bottom. */
  onSubmit: (input: ItemInput) => void;
  submitLabel?: string;
}) {
  const { colors, font } = useTheme();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<ItemType>(initial?.type ?? 'snippet');
  const [language, setLanguage] = useState(initial?.language ?? '');
  const [tagText, setTagText] = useState((initial?.tags ?? []).join(', '));
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function submit() {
    setFieldError(null);
    setFormError(null);
    try {
      onSubmit({
        title,
        body,
        description,
        type,
        language: language || null,
        tags: tagText.split(','),
      });
    } catch (e) {
      if (e instanceof ValidationError) setFieldError({ field: e.field, message: e.message });
      else setFormError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, fontSize: font.body, backgroundColor: colors.surface }];
  const err = (field: string) =>
    fieldError?.field === field ? (
      <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: font.small, marginTop: 3 }}>
        {fieldError.message}
      </Text>
    ) : null;
  const label = (t: string) => <Text style={{ color: colors.muted, fontSize: font.small, marginBottom: 4, marginTop: 14 }}>{t}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {label('Title')}
      <TextInput testID="field-title" accessibilityLabel="Title" value={title} onChangeText={setTitle} maxLength={LIMITS.title + 50} style={inputStyle} placeholder="Undo last commit" placeholderTextColor={colors.muted} />
      {err('title')}

      {label('Body (use {{name}} for fill-in values)')}
      <TextInput
        testID="field-body"
        accessibilityLabel="Body"
        value={body}
        onChangeText={setBody}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        textAlignVertical="top"
        style={[inputStyle, { minHeight: 140, fontFamily: 'monospace' }]}
        placeholder="git reset --soft HEAD~1"
        placeholderTextColor={colors.muted}
      />
      {err('body')}

      {label('Description (optional)')}
      <TextInput testID="field-description" accessibilityLabel="Description" value={description} onChangeText={setDescription} style={inputStyle} placeholder="One line on what it does" placeholderTextColor={colors.muted} />
      {err('description')}

      {label('Type')}
      <View style={styles.row}>
        {ITEM_TYPES.map((t) => (
          <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} testID={`type-${t}`} />
        ))}
      </View>
      {err('type')}

      {label('Language (optional, for highlighting)')}
      <TextInput testID="field-language" accessibilityLabel="Language" value={language} onChangeText={setLanguage} autoCapitalize="none" style={inputStyle} placeholder="bash, python, sql..." placeholderTextColor={colors.muted} />
      {err('language')}

      {label('Tags (comma separated)')}
      <TextInput testID="field-tags" accessibilityLabel="Tags" value={tagText} onChangeText={setTagText} autoCapitalize="none" style={inputStyle} placeholder="git, undo" placeholderTextColor={colors.muted} />
      {err('tags')}

      {formError ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, marginTop: 12, fontSize: font.body }}>
          {formError}
        </Text>
      ) : null}
      <Button label={submitLabel} onPress={submit} style={{ marginTop: 22 }} testID="submit-item" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 60 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
