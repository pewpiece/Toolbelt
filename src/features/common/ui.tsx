import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/features/settings/theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, font } = useTheme();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.chip;
  const fg = variant === 'secondary' ? colors.text : colors.onPrimary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: font.body, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, font } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.primary : colors.chip },
      ]}
    >
      <Text style={{ color: selected ? colors.onPrimary : colors.text, fontSize: font.small }}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  const { colors, font } = useTheme();
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <Text style={{ color: colors.text, fontSize: font.title - 3, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      {hint ? (
        <Text style={{ color: colors.muted, fontSize: font.body, textAlign: 'center', marginTop: 6 }}>{hint}</Text>
      ) : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors, font } = useTheme();
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <Text style={{ color: colors.danger, fontSize: font.body, textAlign: 'center' }}>{message}</Text>
      {onRetry ? (
        <View style={{ marginTop: 12 }}>
          <Button label="Retry" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 6 },
  empty: { padding: 28, alignItems: 'center', justifyContent: 'center' },
});
