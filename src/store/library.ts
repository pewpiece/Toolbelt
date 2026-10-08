import { create } from 'zustand';

/**
 * Screens re-query the database when `revision` changes. Every mutation (create, edit,
 * delete, pin, copy, pack import...) calls `bump()` so lists elsewhere refresh.
 */
interface LibraryState {
  revision: number;
  bump: () => void;
}

export const useLibrary = create<LibraryState>((set) => ({
  revision: 0,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));
