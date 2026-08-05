import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import { uploadBuffer } from "../../lib/cloudinary.js";
import * as usersService from "./users.service.js";
import { createUserSchema, updateOwnProfileSchema, updateUserSchema } from "./users.schema.js";

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
  const user = await usersService.updateUser(req.auth!.tenantId, req.params.id as string, req.auth!.role, input);
  res.json(user);
}

export async function me(req: Request, res: Response) {
  const user = await usersService.getUserById(req.auth!.tenantId, req.auth!.sub);
  res.json(user);
}

export async function updateMe(req: Request, res: Response) {
  const input = updateOwnProfileSchema.parse(req.body);
  const user = await usersService.updateOwnProfile(req.auth!.tenantId, req.auth!.sub, input);
  res.json(user);
}

export async function uploadMyAvatar(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, "No image file provided (field name: avatar)");
  const avatarUrl = await uploadBuffer(req.file.buffer, `construction-erp/${req.auth!.tenantId}/users/${req.auth!.sub}`);
  const user = await usersService.setUserAvatar(req.auth!.tenantId, req.auth!.sub, avatarUrl);
  res.json(user);
}
