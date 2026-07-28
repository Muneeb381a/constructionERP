import { apiClient } from "../apiClient";
import type { Role } from "../types";

export type MyProfile = {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function getMe() {
  const res = await apiClient.get<MyProfile>("/users/me");
  return res.data;
}

export async function updateMe(input: { name?: string }) {
  const res = await apiClient.patch<MyProfile>("/users/me", input);
  return res.data;
}

export async function uploadMyAvatar(file: File) {
  const formData = new FormData();
  formData.append("avatar", file);
  const res = await apiClient.post<MyProfile>("/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
