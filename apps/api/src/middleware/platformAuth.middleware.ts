import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { platformAdmins } from "../db/schema.js";
import { verifyPlatformAccessToken } from "../lib/platformJwt.js";

// Unlike the tenant `authenticate` middleware (which trusts the JWT payload for
// performance), this hits the DB on every request. Traffic here is a single operator,
// not thousands of tenant users, so instant revocation (isActive flip) matters more
// than the extra indexed PK lookup costs.
export async function authenticatePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  let payload;
  try {
    payload = verifyPlatformAccessToken(header.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }

  const [admin] = await db
    .select({ id: platformAdmins.id, email: platformAdmins.email, name: platformAdmins.name, isActive: platformAdmins.isActive })
    .from(platformAdmins)
    .where(eq(platformAdmins.id, payload.sub))
    .limit(1);

  if (!admin || !admin.isActive) {
    return res.status(401).json({ error: "Account no longer active" });
  }

  req.platformAuth = { id: admin.id, email: admin.email, name: admin.name };
  next();
}
