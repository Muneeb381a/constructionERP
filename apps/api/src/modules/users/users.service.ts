import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { hashPassword } from "../../lib/password.js";
import type { CreateUserInput, UpdateUserInput } from "./users.schema.js";

const columns = {
  id: users.id,
  tenantId: users.tenantId,
  branchId: users.branchId,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
};

export function listUsers(tenantId: string) {
  return db.select(columns).from(users).where(eq(users.tenantId, tenantId));
}

export async function createUser(tenantId: string, input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, input.email.toLowerCase())))
    .limit(1);
  if (existing) throw new HttpError(409, "A user with this email already exists in this tenant");

  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
    })
    .returning(columns);

  return user;
}

export async function updateUser(tenantId: string, userId: string, input: UpdateUserInput) {
  const [updated] = await db
    .update(users)
    .set(input)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning(columns);

  if (!updated) throw new HttpError(404, "User not found");
  return updated;
}
