import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import * as partiesService from "./parties.service.js";
import { createPartySchema, listPartiesQuerySchema, updatePartySchema } from "./parties.schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string) {
  if (!UUID_RE.test(raw)) throw new HttpError(400, "Invalid party id");
  return raw;
}

function assertCanSetCreditLimit(role: string) {
  if (role !== "owner" && role !== "manager") {
    throw new HttpError(403, "Only an owner or manager can set a party's credit limit");
  }
}

export async function list(req: Request, res: Response) {
  const query = listPartiesQuerySchema.parse(req.query);
  const result = await partiesService.listParties(req.auth!.tenantId, query);
  res.json(result);
}

export async function topCustomers(req: Request, res: Response) {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  const result = await partiesService.getTopCustomers(req.auth!.tenantId, limit);
  res.json(result);
}

export async function get(req: Request, res: Response) {
  const party = await partiesService.getParty(req.auth!.tenantId, parseId(req.params.id as string));
  res.json(party);
}

export async function create(req: Request, res: Response) {
  const input = createPartySchema.parse(req.body);
  if (input.creditLimit != null && input.creditLimit > 0) {
    assertCanSetCreditLimit(req.auth!.role);
  }
  const party = await partiesService.createParty(req.auth!.tenantId, input);
  res.status(201).json(party);
}

export async function update(req: Request, res: Response) {
  const input = updatePartySchema.parse(req.body);
  if (input.creditLimit != null) {
    assertCanSetCreditLimit(req.auth!.role);
  }
  const party = await partiesService.updateParty(req.auth!.tenantId, parseId(req.params.id as string), input);
  res.json(party);
}

export async function remove(req: Request, res: Response) {
  await partiesService.deleteParty(req.auth!.tenantId, parseId(req.params.id as string));
  res.status(204).send();
}

export async function getPublicLink(req: Request, res: Response) {
  const token = await partiesService.getOrCreatePublicToken(req.auth!.tenantId, parseId(req.params.id as string));
  res.json({ token });
}

export async function revokePublicLink(req: Request, res: Response) {
  await partiesService.revokePublicToken(req.auth!.tenantId, parseId(req.params.id as string));
  res.status(204).send();
}

export async function publicBalance(req: Request, res: Response) {
  const token = req.params.token as string;
  // A malformed token isn't just "not found" — publicToken is a uuid column, so querying it
  // with a non-UUID string throws a Postgres type error, not an empty result. Reject the
  // shape here so a garbage link 404s cleanly instead of 500ing.
  if (!UUID_RE.test(token)) throw new HttpError(404, "Invalid or expired link");
  const result = await partiesService.getPublicBalanceByToken(token);
  res.json(result);
}
