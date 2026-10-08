import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/features/settings/theme';
import { useToast } from '@/store/toast';

export function ToastHost() {
  const { message, tone, seq, hide } = useToast();
  const { colors, font } = useTheme();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 1800);
    return () => clearTimeout(t);
  }, [message, seq, hide]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: tone === 'error' ? colors.danger : colors.text }]}
      >
        <Text style={{ color: colors.bg, fontSize: font.body }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  toast: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 22, maxWidth: '88%' },
});
