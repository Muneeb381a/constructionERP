import { z } from "zod";

export const createEmployeeSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1).max(160),
  phone: z.string().max(30).nullable().optional(),
  cnic: z.string().max(20).nullable().optional(),
  designation: z.string().max(80).nullable().optional(),
  employmentType: z.enum(["daily_wage", "monthly"]).default("daily_wage"),
  dailyWageRate: z.coerce.number().nonnegative().optional(),
  monthlySalary: z.coerce.number().nonnegative().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  phone: z.string().max(30).nullable().optional(),
  cnic: z.string().max(20).nullable().optional(),
  designation: z.string().max(80).nullable().optional(),
  employmentType: z.enum(["daily_wage", "monthly"]).optional(),
  dailyWageRate: z.coerce.number().nonnegative().optional(),
  monthlySalary: z.coerce.number().nonnegative().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listEmployeesQuerySchema = z.object({
  search: z.string().max(160).optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const markAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "half_day", "absent", "leave"]),
  note: z.string().max(300).nullable().optional(),
});

export const listAttendanceQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const postSalarySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.coerce.number().nonnegative(),
  note: z.string().max(300).nullable().optional(),
});

export const createEmployeePaymentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  method: z.enum(["cash", "bank_transfer"]),
  amount: z.coerce.number().positive(),
  isAdvance: z.boolean().optional(),
  note: z.string().max(300).nullable().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type PostSalaryInput = z.infer<typeof postSalarySchema>;
export type CreateEmployeePaymentInput = z.infer<typeof createEmployeePaymentSchema>;
