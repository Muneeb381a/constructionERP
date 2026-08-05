import axios, { type AxiosRequestConfig } from "axios";
import { usePlatformAdminAuthStore } from "../store/platformAdminAuthStore";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

// Deliberately its own axios instance + interceptors, not shared/parameterized with
// lib/apiClient.ts — an edit to tenant-refresh logic must never silently touch this.
export const platformApiClient = axios.create({ baseURL: `${API_BASE_URL}/platform-admin` });

platformApiClient.interceptors.request.use((config) => {
  const token = usePlatformAdminAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

platformApiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = usePlatformAdminAuthStore.getState().refreshToken;
    if (!refreshToken) {
      usePlatformAdminAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_BASE_URL}/platform-admin/auth/refresh`, { refreshToken })
          .then((res) => {
            usePlatformAdminAuthStore.getState().setAuth(res.data);
            return res.data.accessToken as string;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const newAccessToken = await refreshPromise;
      original.headers = { ...original.headers, Authorization: `Bearer ${newAccessToken}` };
      return platformApiClient(original);
    } catch (refreshError) {
      usePlatformAdminAuthStore.getState().clearAuth();
      return Promise.reject(refreshError);
    }
  },
);
