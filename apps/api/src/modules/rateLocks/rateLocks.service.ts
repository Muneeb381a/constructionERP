import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { parties, products, rateLocks } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import type { CreateRateLockInput } from "./rateLocks.schema.js";

export async function createRateLock(tenantId: string, userId: string, input: CreateRateLockInput) {
  const [party] = await db
    .select({ id: parties.id })
    .from(parties)
    .where(and(eq(parties.id, input.partyId), eq(parties.tenantId, tenantId)))
    .limit(1);
  if (!party) throw new HttpError(400, "partyId does not refer to a party in this tenant");

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.tenantId, tenantId)))
    .limit(1);
  if (!product) throw new HttpError(400, "productId does not refer to a product in this tenant");

  const [lock] = await db
    .insert(rateLocks)
    .values({
      tenantId,
      partyId: input.partyId,
      productId: input.productId,
      lockedPrice: input.lockedPrice.toString(),
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      notes: input.notes ?? null,
      createdBy: userId,
    })
    .returning();

  return lock;
}

/** Every lock for a party (active and expired) — for the Rate Locks panel on their profile. */
export async function listRateLocksForParty(tenantId: string, partyId: string) {
  return db
    .select({
      id: rateLocks.id,
      productId: rateLocks.productId,
      productName: products.name,
      lockedPrice: rateLocks.lockedPrice,
      validFrom: rateLocks.validFrom,
      validUntil: rateLocks.validUntil,
      notes: rateLocks.notes,
      createdAt: rateLocks.createdAt,
    })
    .from(rateLocks)
    .innerJoin(products, eq(products.id, rateLocks.productId))
    .where(and(eq(rateLocks.tenantId, tenantId), eq(rateLocks.partyId, partyId)))
    .orderBy(desc(rateLocks.validUntil));
}

/** Currently-active locks only — what Sale Invoice creation pre-fills prices from. */
export async function listActiveRateLocksForParty(tenantId: string, partyId: string) {
  const now = new Date();
  return db
    .select({
      id: rateLocks.id,
      productId: rateLocks.productId,
      productName: products.name,
      lockedPrice: rateLocks.lockedPrice,
      validUntil: rateLocks.validUntil,
    })
    .from(rateLocks)
    .innerJoin(products, eq(products.id, rateLocks.productId))
    .where(
      and(
        eq(rateLocks.tenantId, tenantId),
        eq(rateLocks.partyId, partyId),
        lte(rateLocks.validFrom, now),
        gte(rateLocks.validUntil, now),
      ),
    );
}

/**
 * The single price lookup sale.service.ts uses (via shared.ts's resolveLineItems) — most
 * recently created active lock wins if more than one somehow overlaps for the same product.
 */
export async function getActiveRateLockPrice(
  executor: DbOrTx,
  tenantId: string,
  partyId: string,
  productId: string,
): Promise<number | null> {
  const now = new Date();
  const [lock] = await executor
    .select({ lockedPrice: rateLocks.lockedPrice })
    .from(rateLocks)
    .where(
      and(
        eq(rateLocks.tenantId, tenantId),
        eq(rateLocks.partyId, partyId),
        eq(rateLocks.productId, productId),
        lte(rateLocks.validFrom, now),
        gte(rateLocks.validUntil, now),
      ),
    )
    .orderBy(desc(rateLocks.createdAt))
    .limit(1);
  return lock ? Number(lock.lockedPrice) : null;
}
