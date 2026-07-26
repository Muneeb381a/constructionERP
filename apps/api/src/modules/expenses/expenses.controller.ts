import type { Request, Response } from "express";
import * as expensesService from "./expenses.service.js";
import { createExpenseSchema, listExpensesQuerySchema } from "./expenses.schema.js";

export async function list(req: Request, res: Response) {
  const query = listExpensesQuerySchema.parse(req.query);
  const result = await expensesService.listExpenses(req.auth!.tenantId, query);
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createExpenseSchema.parse(req.body);
  const expense = await expensesService.createExpense({ tenantId: req.auth!.tenantId, userId: req.auth!.sub }, input);
  res.status(201).json(expense);
}

export async function categorySummary(req: Request, res: Response) {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const result = await expensesService.getCategorySummary(req.auth!.tenantId, { dateFrom, dateTo });
  res.json(result);
}
