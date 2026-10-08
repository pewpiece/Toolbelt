import { useEffect, type ReactNode } from 'react';

/** Mutable state tests can set before rendering a screen. */
export const routerState = {
  params: {} as Record<string, string>,
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
};

export function resetRouter() {
  routerState.params = {};
  routerState.push.mockClear();
  routerState.replace.mockClear();
  routerState.back.mockClear();
  routerState.setParams.mockClear();
}

/** Minimal stand-in for expo-router so screens render without a navigation container. */
export const expoRouterMock = {
  useRouter: () => ({
    push: routerState.push,
    replace: routerState.replace,
    back: routerState.back,
    setParams: routerState.setParams,
  }),
  useLocalSearchParams: () => routerState.params,
  // Focus effects run once on mount in tests.
  useFocusEffect: (cb: () => void | (() => void)) => {
    useEffect(cb, [cb]);
  },
  Stack: { Screen: (_props: { options?: unknown }): ReactNode => null },
  Link: ({ children }: { children?: ReactNode }) => children ?? null,
};
