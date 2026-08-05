import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlatformAdmin = { id: string; name: string; email: string };

type PlatformAdminAuthState = {
  admin: PlatformAdmin | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (data: { admin: PlatformAdmin; accessToken: string; refreshToken: string }) => void;
  clearAuth: () => void;
};

// Deliberately a separate store + separate localStorage key from the tenant
// useAuthStore ("construction-erp-auth") — a platform-admin session must never be
// confused with, or overwrite, a tenant-user session in the same browser.
export const usePlatformAdminAuthStore = create<PlatformAdminAuthState>()(
  persist(
    (set) => ({
      admin: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ admin, accessToken, refreshToken }) => set({ admin, accessToken, refreshToken }),
      clearAuth: () => set({ admin: null, accessToken: null, refreshToken: null }),
    }),
    { name: "construction-erp-platform-admin-auth" },
  ),
);
