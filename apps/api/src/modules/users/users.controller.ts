import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as usersService from "./users.service.js";
import { createUserSchema, updateUserSchema } from "./users.schema.js";

export async function list(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  const result = await usersService.listUsers(tenantId);
  res.json(result);
}

export async function create(req: Request, res: Response) {
  const input = createUserSchema.parse(req.body);
  if (input.role === "owner" && req.auth!.role !== "owner") {
    throw new HttpError(403, "Only an owner can create another owner account");
  }
  const user = await usersService.createUser(req.auth!.tenantId, input);
  res.status(201).json(user);
}

export async function update(req: Request, res: Response) {
  const input = updateUserSchema.parse(req.body);
  if (input.role === "owner" && req.auth!.role !== "owner") {
    throw new HttpError(403, "Only an owner can grant the owner role");
  }
  const user = await usersService.updateUser(req.auth!.tenantId, req.params.id as string, input);
  res.json(user);
}
