import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import * as ledgerService from "./ledger.service.js";
import * as partiesService from "../parties/parties.service.js";
import { postManualEntrySchema } from "./ledger.schema.js";

export async function listAll(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  const { partyType, search, page, limit } = req.query;
  const result = await ledgerService.listAllLedgerEntries(tenantId, {
    partyType: partyType === "customer" || partyType === "supplier" ? partyType : undefined,
    search: typeof search === "string" ? search : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json(result);
}

export async function history(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  const partyId = req.params.partyId as string;

  const [party, entries] = await Promise.all([
    partiesService.getParty(tenantId, partyId),
    ledgerService.listLedgerForParty(tenantId, partyId),
  ]);

  res.json({ cachedBalance: party.cachedBalance, balanceUpdatedAt: party.balanceUpdatedAt, entries });
}

export async function openingBalance(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  const partyId = req.params.partyId as string;
  const input = postManualEntrySchema.parse(req.body);

  await partiesService.getParty(tenantId, partyId); // 404s if not in this tenant

  const entry = await db.transaction((tx) =>
    ledgerService.postLedgerEntry(tx, {
      tenantId,
      partyId,
      direction: input.direction,
      amount: input.amount,
      sourceType: "opening_balance",
      sourceId: randomUUID(),
    }),
  );

  res.status(201).json(entry);
}

export async function adjustment(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  const partyId = req.params.partyId as string;
  const input = postManualEntrySchema.parse(req.body);

  await partiesService.getParty(tenantId, partyId);

  const entry = await db.transaction((tx) =>
    ledgerService.postLedgerEntry(tx, {
      tenantId,
      partyId,
      direction: input.direction,
      amount: input.amount,
      sourceType: "adjustment",
      sourceId: randomUUID(),
    }),
  );

  res.status(201).json(entry);
}
