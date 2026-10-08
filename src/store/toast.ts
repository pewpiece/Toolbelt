import { create } from 'zustand';

interface ToastState {
  message: string | null;
  tone: 'info' | 'error';
  seq: number;
  show: (message: string, tone?: 'info' | 'error') => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  seq: 0,
  show: (message, tone = 'info') => set((s) => ({ message, tone, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));
