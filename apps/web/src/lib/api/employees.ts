import { apiClient } from "../apiClient";

export type EmploymentType = "daily_wage" | "monthly";
export type AttendanceStatus = "present" | "half_day" | "absent" | "leave";

export type Employee = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  phone: string | null;
  cnic: string | null;
  designation: string | null;
  employmentType: EmploymentType;
  dailyWageRate: string;
  monthlySalary: string;
  joiningDate: string | null;
  cachedBalance: string;
  balanceUpdatedAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export type EmployeeInput = {
  branchId: string;
  name: string;
  phone?: string | null;
  cnic?: string | null;
  designation?: string | null;
  employmentType: EmploymentType;
  dailyWageRate?: number;
  monthlySalary?: number;
  joiningDate?: string | null;
};

export type Attendance = {
  id: string;
  tenantId: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  wageAmount: string;
  note: string | null;
  markedBy: string | null;
  createdAt: string;
};

export type EmployeeLedgerEntry = {
  id: string;
  tenantId: string;
  employeeId: string;
  direction: "debit" | "credit";
  amount: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

export type EmployeePayment = {
  id: string;
  tenantId: string;
  employeeId: string;
  method: "cash" | "bank_transfer";
  amount: string;
  isAdvance: boolean;
  note: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type SalaryPosting = {
  id: string;
  tenantId: string;
  employeeId: string;
  month: string;
  amount: string;
  note: string | null;
  postedBy: string | null;
  createdAt: string;
};

export type TodayAttendanceEmployee = Employee & { todayAttendance: Attendance | null };

export async function listEmployees(params: { search?: string; includeInactive?: boolean } = {}) {
  const res = await apiClient.get<Employee[]>("/employees", { params });
  return res.data;
}

export async function getTodayAttendance() {
  const res = await apiClient.get<{ date: string; employees: TodayAttendanceEmployee[] }>("/employees/attendance/today");
  return res.data;
}

export async function getEmployee(id: string) {
  const res = await apiClient.get<Employee>(`/employees/${id}`);
  return res.data;
}

export async function createEmployee(input: EmployeeInput) {
  const res = await apiClient.post<Employee>("/employees", input);
  return res.data;
}

export async function updateEmployee(id: string, input: Partial<EmployeeInput> & { isActive?: boolean }) {
  const res = await apiClient.patch<Employee>(`/employees/${id}`, input);
  return res.data;
}

export async function deleteEmployee(id: string) {
  await apiClient.delete(`/employees/${id}`);
}

export async function markAttendance(employeeId: string, input: { date: string; status: AttendanceStatus; note?: string | null }) {
  const res = await apiClient.post<Attendance>(`/employees/${employeeId}/attendance`, input);
  return res.data;
}

export async function listAttendance(employeeId: string, params: { from?: string; to?: string } = {}) {
  const res = await apiClient.get<Attendance[]>(`/employees/${employeeId}/attendance`, { params });
  return res.data;
}

export async function listEmployeeLedger(employeeId: string) {
  const res = await apiClient.get<{ entries: EmployeeLedgerEntry[] }>(`/employees/${employeeId}/ledger`);
  return res.data;
}

export async function listEmployeePayments(employeeId: string) {
  const res = await apiClient.get<EmployeePayment[]>(`/employees/${employeeId}/payments`);
  return res.data;
}

export async function postSalary(employeeId: string, input: { month: string; amount: number; note?: string | null }) {
  const res = await apiClient.post<SalaryPosting>(`/employees/${employeeId}/salary`, input);
  return res.data;
}

export async function listSalaryPostings(employeeId: string) {
  const res = await apiClient.get<SalaryPosting[]>(`/employees/${employeeId}/salary`);
  return res.data;
}

export type CreateEmployeePaymentInput = {
  idempotencyKey: string;
  method: "cash" | "bank_transfer";
  amount: number;
  isAdvance?: boolean;
  note?: string | null;
};

export async function createEmployeePayment(employeeId: string, input: CreateEmployeePaymentInput) {
  const res = await apiClient.post<{ payment: EmployeePayment; idempotentReplay: boolean }>(`/employees/${employeeId}/payments`, input);
  return res.data;
}
