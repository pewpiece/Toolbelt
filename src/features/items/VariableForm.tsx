import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/features/common/ui';
import { useTheme } from '@/features/settings/theme';
import { useCopy } from '@/store/copy';

/** Bottom sheet shown on Copy when the item has {{variables}}. Mounted once at the app root. */
export function VariableFormHost() {
  const { pending, variables, confirm, cancel } = useCopy();
  return (
    <VariableForm
      visible={!!pending}
      title={pending?.title ?? ''}
      variables={variables}
      onSubmit={confirm}
      onCancel={cancel}
    />
  );
}

interface VariableFormProps {
  visible: boolean;
  title: string;
  variables: string[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function VariableForm(props: VariableFormProps) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onCancel}>
      {/* Content only mounts while visible, so field values start empty on every open. */}
      {props.visible ? <VariableFormBody {...props} /> : null}
    </Modal>
  );
}

function VariableFormBody({ title, variables, onSubmit, onCancel }: VariableFormProps) {
  const { colors, font } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontSize: font.title - 2, fontWeight: '700' }} numberOfLines={2}>
            Fill in values
          </Text>
          <Text style={{ color: colors.muted, fontSize: font.small, marginBottom: 10 }} numberOfLines={1}>
            {title}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
            {variables.map((name, i) => (
              <View key={name} style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.muted, fontSize: font.small, marginBottom: 4 }}>{name}</Text>
                <TextInput
                  testID={`var-${name}`}
                  accessibilityLabel={name}
                  autoFocus={i === 0}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={values[name] ?? ''}
                  onChangeText={(v) => setValues((s) => ({ ...s, [name]: v }))}
                  placeholder={`{{${name}}}`}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, fontSize: font.body }]}
                />
              </View>
            ))}
          </ScrollView>
          <Text style={{ color: colors.muted, fontSize: font.small, marginBottom: 10 }}>
            Empty fields stay as {'{{name}}'} in the copied text.
          </Text>
          <View style={styles.row}>
            <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1, marginRight: 8 }} />
            <Button label="Copy" onPress={() => onSubmit(values)} style={{ flex: 1 }} testID="var-submit" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  row: { flexDirection: 'row' },
});
