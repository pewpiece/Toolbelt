import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';

import { ToastHost } from '@/features/common/Toast';
import { ErrorState } from '@/features/common/ui';
import { VariableFormHost } from '@/features/items/VariableForm';
import { useTheme } from '@/features/settings/theme';
import { bootstrap } from '@/services/bootstrap';

export default function RootLayout() {
  const { colors, dark } = useTheme();
  // Runs once; bootstrap() is idempotent, so a dev-mode double invoke is harmless.
  const [error] = useState<string | null>(() => {
    try {
      bootstrap();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'The database could not be opened.';
    }
  });

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ErrorState message={`DevCheat could not start: ${error}`} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <VariableFormHost />
      <ToastHost />
    </View>
  );
}
