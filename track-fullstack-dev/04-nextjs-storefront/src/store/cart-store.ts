import { create } from 'zustand';

interface CartUiState {
  /** Mirror of the server cart count (the cookie is the source of truth). */
  count: number;
  /** Text announced to screen readers via an aria-live region. */
  announcement: string;
  setCount: (count: number) => void;
  announce: (message: string) => void;
}

export const useCartStore = create<CartUiState>()((set) => ({
  count: 0,
  announcement: '',
  setCount: (count) => set({ count: Math.max(0, count) }),
  announce: (announcement) => set({ announcement }),
}));
