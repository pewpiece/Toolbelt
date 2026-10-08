import * as Clipboard from 'expo-clipboard';
import { create } from 'zustand';

import type { Item } from '@/data/types';
import { extractVariables, fillTemplate } from '@/services/template';

import { useLibrary } from './library';
import { getRepos } from './repos';
import { useToast } from './toast';

interface CopyState {
  /** Item waiting for the user to fill in its {{variables}}. */
  pending: Item | null;
  variables: string[];
  requestCopy: (item: Item) => Promise<void>;
  confirm: (values: Record<string, string>) => Promise<void>;
  cancel: () => void;
}

async function performCopy(item: Item, text: string) {
  try {
    await Clipboard.setStringAsync(text);
  } catch {
    useToast.getState().show('Could not access the clipboard.', 'error');
    return;
  }
  try {
    getRepos().items.recordCopy(item.id);
    useLibrary.getState().bump();
  } catch {
    // The text is already on the clipboard; failing to count the use is not worth an error.
  }
  useToast.getState().show('Copied');
}

export const useCopy = create<CopyState>((set, get) => ({
  pending: null,
  variables: [],

  requestCopy: async (item) => {
    const variables = extractVariables(item.body);
    if (variables.length === 0) {
      await performCopy(item, item.body);
      return;
    }
    set({ pending: item, variables });
  },

  confirm: async (values) => {
    const { pending } = get();
    if (!pending) return;
    set({ pending: null, variables: [] });
    await performCopy(pending, fillTemplate(pending.body, values));
  },

  cancel: () => set({ pending: null, variables: [] }),
}));
