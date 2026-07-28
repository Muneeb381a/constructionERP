export type Role = "owner" | "manager" | "cashier" | "accountant";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  branchId: string | null;
  avatarUrl: string | null;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type DashboardSummary = {
  today: {
    sales: { total: number; count: number };
    purchases: { total: number; count: number };
  };
  cashInHand: number;
  outstanding: {
    receivables: number;
    payables: number;
  };
  lowStock: {
    productId: string;
    name: string;
    minStock: string;
    currentStock: string;
  }[];
};
