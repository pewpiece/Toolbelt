import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ToastHost } from '@/features/common/Toast';
import { ErrorState } from '@/features/common/ui';
import { VariableFormHost } from '@/features/items/VariableForm';
import { useTheme } from '@/features/settings/theme';
import { bootstrapDatabase, seedStarterPacks } from '@/services/bootstrap';
import { useLibrary } from '@/store/library';

/** Replaces the default red error screen for crashes inside any route. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <ErrorState message={`Something went wrong: ${error.message}`} onRetry={retry} />
    </View>
  );
}

export default function RootLayout() {
  const { colors, dark, font } = useTheme();
  // Step 1 runs once (idempotent, so a dev-mode double invoke is harmless).
  const [dbError] = useState<string | null>(() => {
    try {
      bootstrapDatabase();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'The database could not be opened.';
    }
  });
  const [seedError, setSeedError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const bump = useLibrary((s) => s.bump);

  // Step 2: install or upgrade the starter packs without freezing the first frame.
  useEffect(() => {
    if (dbError) return;
    let cancelled = false;
    seedStarterPacks((p) => !cancelled && setProgress(p))
      .then((result) => {
        if (cancelled) return;
        if (result.invalid.length) setSeedError(`Some starter packs could not be loaded: ${result.invalid.join(', ')}`);
        bump();
        setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setSeedError(e instanceof Error ? e.message : 'Installing the starter packs failed.');
        if (!cancelled) setReady(true); // the app is still usable without them
      });
    return () => {
      cancelled = true;
    };
  }, [dbError, bump]);

  const error = dbError;
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ErrorState message={`DevCheat could not start: ${error}`} />
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>DevCheat</Text>
        {progress ? (
          <Text style={{ color: colors.muted, fontSize: font.body, marginTop: 8 }} accessibilityLiveRegion="polite">
            Setting up your starter library... {progress.done} / {progress.total}
          </Text>
        ) : null}
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
      {seedError ? <SeedWarning message={seedError} /> : null}
    </View>
  );
}

function SeedWarning({ message }: { message: string }) {
  const { colors, font } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 40, left: 12, right: 12, padding: 10, borderRadius: 8, backgroundColor: colors.danger }}>
      <Text style={{ color: colors.bg, fontSize: font.small }}>{message}</Text>
    </View>
  );
}
