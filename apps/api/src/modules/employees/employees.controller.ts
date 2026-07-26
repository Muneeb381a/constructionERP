import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as employeesService from "./employees.service.js";
import * as attendanceService from "./attendance.service.js";
import * as employeeLedgerService from "./employeeLedger.service.js";
import * as employeePaymentsService from "./employeePayments.service.js";
import * as salaryService from "./salary.service.js";
import {
  createEmployeePaymentSchema,
  createEmployeeSchema,
  listAttendanceQuerySchema,
  listEmployeesQuerySchema,
  markAttendanceSchema,
  postSalarySchema,
  updateEmployeeSchema,
} from "./employees.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, "Invalid employee id");
  return raw;
}

export async function list(req: Request, res: Response) {
  const query = listEmployeesQuerySchema.parse(req.query);
  const result = await employeesService.listEmployees(req.auth!.tenantId, query);
  res.json(result);
}

export async function today(req: Request, res: Response) {
  const result = await attendanceService.listTodayAttendance(req.auth!.tenantId);
  res.json(result);
}

export async function get(req: Request, res: Response) {
  const employee = await employeesService.getEmployee(req.auth!.tenantId, parseId(req.params.id as string));
  res.json(employee);
}

export async function create(req: Request, res: Response) {
  const input = createEmployeeSchema.parse(req.body);
  const employee = await employeesService.createEmployee(req.auth!.tenantId, input);
  res.status(201).json(employee);
}

export async function update(req: Request, res: Response) {
  const input = updateEmployeeSchema.parse(req.body);
  const employee = await employeesService.updateEmployee(req.auth!.tenantId, parseId(req.params.id as string), input);
  res.json(employee);
}

export async function remove(req: Request, res: Response) {
  await employeesService.deleteEmployee(req.auth!.tenantId, parseId(req.params.id as string));
  res.status(204).send();
}

export async function markAttendance(req: Request, res: Response) {
  const employeeId = parseId(req.params.employeeId as string);
  const input = markAttendanceSchema.parse(req.body);
  const result = await attendanceService.markAttendance({ tenantId: req.auth!.tenantId, markedBy: req.auth!.sub }, employeeId, input);
  res.status(201).json(result);
}

export async function listAttendance(req: Request, res: Response) {
  const employeeId = parseId(req.params.employeeId as string);
  const query = listAttendanceQuerySchema.parse(req.query);
  const result = attendanceService.listAttendanceForEmployee(req.auth!.tenantId, employeeId, query);
  res.json(await result);
}

export async function listLedger(req: Request, res: Response) {
  const employeeId = parseId(req.params.employeeId as string);
  const entries = await employeeLedgerService.listLedgerForEmployee(req.auth!.tenantId, employeeId);
  res.json({ entries });
}

export async function listPayments(req: Request, res: Response) {
  const employeeId = parseId(req.params.employeeId as string);
  const result = await employeePaymentsService.listPaymentsForEmployee(req.auth!.tenantId, employeeId);
  res.json(result);
}

export async function postSalary(req: Request, res: Response) {
  const employeeId = parseId(req.params.employeeId as string);
  const input = postSalarySchema.parse(req.body);
  const result = await salaryService.postMonthlySalary({ tenantId: req.auth!.tenantId, postedBy: req.auth!.sub }, employeeId, input);
  res.status(201).json(result);
}

export async function listSalaryPostings(req: Request, res: Response) {
  const employeeId = parseId(req.params.employeeId as string);
  const result = await salaryService.listSalaryPostings(req.auth!.tenantId, employeeId);
  res.json(result);
}

export async function createPayment(req: Request, res: Response) {
  const employeeId = parseId(req.params.employeeId as string);
  const input = createEmployeePaymentSchema.parse(req.body);
  const result = await employeePaymentsService.createEmployeePayment({ tenantId: req.auth!.tenantId }, employeeId, input);
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}
