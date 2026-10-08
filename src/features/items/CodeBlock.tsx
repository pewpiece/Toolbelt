import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/features/settings/theme';
import { tokenize } from '@/services/highlight';

export function CodeBlock({ code, language }: { code: string; language?: string | null }) {
  const { colors, font } = useTheme();
  const tokens = tokenize(code, language);
  return (
    <View style={[styles.box, { backgroundColor: colors.codeBg, borderColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <Text
          selectable
          testID="code-body"
          style={{ fontFamily: 'monospace', fontSize: font.code, color: colors.token.plain, lineHeight: font.code * 1.5 }}
        >
          {tokens.map((t, i) => (
            <Text key={i} style={{ color: colors.token[t.kind] }}>
              {t.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
});
