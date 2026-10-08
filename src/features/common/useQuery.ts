import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useLibrary } from '@/store/library';

/**
 * Runs a (synchronous) repository query when the screen gains focus and whenever the
 * library changes. `key` identifies the query inputs (e.g. the id or filter string); the query
 * re-runs when it changes. Errors are captured instead of thrown so screens can show an error state.
 */
export function useQuery<T>(fn: () => T, key: string | number = ''): { data: T | undefined; error: string | null; reload: () => void } {
  const revision = useLibrary((s) => s.revision);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      try {
        setData(fn());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong while loading.');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revision, tick, key]),
  );

  return { data, error, reload: () => setTick((t) => t + 1) };
}
