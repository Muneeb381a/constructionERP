import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { DbOrTx } from "../../db/index.js";
import { db } from "../../db/index.js";
import { invoices, parties } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { listBillsForParty } from "../payments/payments.service.js";
import type { CreatePartyInput, ListPartiesQuery, UpdatePartyInput } from "./parties.schema.js";

/** Locks the party row for the caller's transaction so concurrent invoices/payments against the same party can't race past a stale balance/credit check. */
export async function lockParty(tx: DbOrTx, tenantId: string, partyId: string) {
  const [party] = await tx
    .select()
    .from(parties)
    .where(and(eq(parties.id, partyId), eq(parties.tenantId, tenantId)))
    .for("update");
  if (!party) throw new HttpError(400, "partyId does not refer to a party in this tenant");
  return party;
}

export async function listParties(tenantId: string, query: ListPartiesQuery) {
  const conditions = [eq(parties.tenantId, tenantId)];
  if (query.type) conditions.push(eq(parties.type, query.type));
  if (query.search) {
    conditions.push(
      or(ilike(parties.name, `%${query.search}%`), ilike(parties.phone, `%${query.search}%`))!,
    );
  }

  const where = and(...conditions);
  const offset = (query.page - 1) * query.limit;
  const orderBy = query.sort === "balance" ? desc(parties.cachedBalance) : desc(parties.createdAt);

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(parties).where(where).orderBy(orderBy).limit(query.limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(parties).where(where),
  ]);

  return { data: rows, page: query.page, limit: query.limit, total: count };
}

/**
 * Ranks customers by lifetime sale spend (non-void sale invoices only — returns
 * aren't netted out, this is a "who buys the most" ranking, not a strict ledger
 * balance). Powers the Sale-screen quick-pick and the Dashboard's Top Customers.
 */
export async function getTopCustomers(tenantId: string, limit: number) {
  return db
    .select({
      id: parties.id,
      name: parties.name,
      phone: parties.phone,
      cachedBalance: parties.cachedBalance,
      orderCount: sql<number>`count(${invoices.id})::int`,
      totalSpent: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
      lastPurchaseAt: sql<Date | null>`max(${invoices.createdAt})`,
    })
    .from(parties)
    .innerJoin(
      invoices,
      and(eq(invoices.partyId, parties.id), eq(invoices.type, "sale"), ne(invoices.status, "void")),
    )
    .where(and(eq(parties.tenantId, tenantId), eq(parties.type, "customer")))
    .groupBy(parties.id, parties.name, parties.phone, parties.cachedBalance)
    .orderBy(sql`coalesce(sum(${invoices.totalAmount}), 0) desc`)
    .limit(limit);
}

export async function getParty(tenantId: string, partyId: string) {
  const [party] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.id, partyId), eq(parties.tenantId, tenantId)))
    .limit(1);
  if (!party) throw new HttpError(404, "Party not found");
  return party;
}

export async function createParty(tenantId: string, input: CreatePartyInput) {
  const [party] = await db
    .insert(parties)
    .values({
      tenantId,
      type: input.type,
      name: input.name,
      phone: input.phone ?? null,
      cnic: input.cnic ?? null,
      address: input.address ?? null,
      creditLimit: input.creditLimit?.toString() ?? "0",
    })
    .returning();
  return party;
}

export async function updateParty(tenantId: string, partyId: string, input: UpdatePartyInput) {
  const [updated] = await db
    .update(parties)
    .set({
      ...input,
      creditLimit: input.creditLimit != null ? input.creditLimit.toString() : undefined,
    })
    .where(and(eq(parties.id, partyId), eq(parties.tenantId, tenantId)))
    .returning();

  if (!updated) throw new HttpError(404, "Party not found");
  return updated;
}

/** Lazily creates and returns a party's public balance-check token — same token every
 * time once generated, so the link a shop owner shares stays valid until revoked. */
export async function getOrCreatePublicToken(tenantId: string, partyId: string) {
  const party = await getParty(tenantId, partyId);
  if (party.publicToken) return party.publicToken;

  const [updated] = await db
    .update(parties)
    .set({ publicToken: sql`gen_random_uuid()` })
    .where(and(eq(parties.id, partyId), eq(parties.tenantId, tenantId)))
    .returning({ publicToken: parties.publicToken });
  return updated.publicToken!;
}

export async function revokePublicToken(tenantId: string, partyId: string) {
  await getParty(tenantId, partyId); // 404s if not in this tenant
  await db.update(parties).set({ publicToken: null }).where(and(eq(parties.id, partyId), eq(parties.tenantId, tenantId)));
}

/**
 * The only party-facing lookup that doesn't require a login — deliberately returns a
 * narrow, safe slice (name, balance, recent bills) and nothing else about the tenant.
 */
export async function getPublicBalanceByToken(token: string) {
  const [party] = await db.select().from(parties).where(eq(parties.publicToken, token)).limit(1);
  if (!party) throw new HttpError(404, "Invalid or expired link");

  const bills = await listBillsForParty(party.tenantId, party.id);

  return {
    partyName: party.name,
    balance: party.cachedBalance,
    balanceUpdatedAt: party.balanceUpdatedAt,
    bills: bills.slice(0, 20).map((b) => ({
      invoiceNo: b.invoice.invoiceNo,
      date: b.invoice.createdAt,
      totalAmount: b.invoice.totalAmount,
      balanceDue: b.balanceDue,
      status: b.status,
    })),
  };
}

export async function deleteParty(tenantId: string, partyId: string) {
  try {
    const [deleted] = await db
      .delete(parties)
      .where(and(eq(parties.id, partyId), eq(parties.tenantId, tenantId)))
      .returning({ id: parties.id });

    if (!deleted) throw new HttpError(404, "Party not found");
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as { code?: string }).code === "23503") {
      throw new HttpError(409, "Party has invoices, payments, or ledger history — it can't be deleted");
    }
    throw err;
  }
}
