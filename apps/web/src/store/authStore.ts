import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse, User } from "../lib/types";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (data: AuthResponse) => void;
  updateUser: (patch: Partial<User>) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      updateUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "construction-erp-auth" },
  ),
);
