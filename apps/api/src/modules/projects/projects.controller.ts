import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as projectsService from "./projects.service.js";
import { createProjectSchema, updateProjectStatusSchema } from "./projects.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string, field: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, `Invalid ${field}`);
  return raw;
}

export async function create(req: Request, res: Response) {
  const input = createProjectSchema.parse(req.body);
  const project = await projectsService.createProject(req.auth!.tenantId, req.auth!.sub, input);
  res.status(201).json(project);
}

export async function list(req: Request, res: Response) {
  const partyId = typeof req.query.partyId === "string" ? req.query.partyId : undefined;
  const result = await projectsService.listProjects(req.auth!.tenantId, partyId);
  res.json(result);
}

export async function get(req: Request, res: Response) {
  const projectId = parseId(req.params.id as string, "project id");
  const result = await projectsService.getProjectWithProgress(req.auth!.tenantId, projectId);
  res.json(result);
}

export async function updateStatus(req: Request, res: Response) {
  const projectId = parseId(req.params.id as string, "project id");
  const input = updateProjectStatusSchema.parse(req.body);
  const project = await projectsService.updateProjectStatus(req.auth!.tenantId, projectId, input.status);
  res.json(project);
}
