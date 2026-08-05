import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "../lib/jwt.js";
import { db } from "../db/index.js";
import { tenants } from "../db/schema.js";

// A platform admin suspending/closing a shop must take effect promptly, not just once the
// access token happens to expire (up to 15 min later) — so this checks tenant status on
// every authenticated request, not only at login. A single indexed PK lookup, negligible
// at this app's traffic (small-shop ERP, not high QPS).
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  let payload;
  try {
    payload = verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }

  const [tenant] = await db.select({ status: tenants.status }).from(tenants).where(eq(tenants.id, payload.tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    return res.status(403).json({ error: "This shop's account has been suspended. Contact support." });
  }

  req.auth = payload;
  next();
}
