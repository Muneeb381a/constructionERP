import {
  pgTable, serial, varchar, text, integer, numeric, timestamp, date,
  boolean, pgEnum, uuid, uniqueIndex, index, jsonb
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["owner", "manager", "cashier", "accountant"]);
export const partyTypeEnum = pgEnum("party_type", ["customer", "supplier"]);
export const invoiceTypeEnum = pgEnum("invoice_type", ["sale", "purchase", "sale_return", "purchase_return"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "confirmed", "void"]);
export const ledgerDirectionEnum = pgEnum("ledger_direction", ["debit", "credit"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bank_transfer", "cheque"]);
export const chequeStatusEnum = pgEnum("cheque_status", ["pending", "cleared", "bounced"]);
export const quotationStatusEnum = pgEnum("quotation_status", ["draft", "sent", "accepted", "rejected", "expired", "converted"]);
export const employmentTypeEnum = pgEnum("employment_type", ["daily_wage", "monthly"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "half_day", "absent", "leave"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["not_applicable", "pending", "delivered"]);
export const projectStatusEnum = pgEnum("project_status", ["active", "completed", "on_hold"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended", "closed"]);
export const platformAdminRoleEnum = pgEnum("platform_admin_role", ["super_admin"]);

// ── Tenancy ───────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessName: varchar("business_name", { length: 160 }).notNull(),
  logoUrl: text("logo_url"),
  address: varchar("address", { length: 250 }),
  phone: varchar("phone", { length: 20 }),
  reminderIntervalDays: integer("reminder_interval_days").default(7),
  allowNegativeStock: boolean("allow_negative_stock").default(false),
  defaultCurrency: varchar("default_currency", { length: 10 }).default("PKR"),
  // Platform-admin controlled lifecycle — "suspended"/"closed" both block login (see
  // auth.service.ts + authenticate middleware); "closed" never transitions back to active.
  status: tenantStatusEnum("status").notNull().default("active"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedReason: text("closed_reason"),
  // Null = self-registered via /auth/register. Set = provisioned by a platform admin.
  createdByPlatformAdminId: uuid("created_by_platform_admin_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  isMain: boolean("is_main").default(false),
});

// ── Users ─────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("cashier"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  emailPerTenant: uniqueIndex("users_tenant_email_idx").on(t.tenantId, t.email),
}));

// ── Catalog ───────────────────────────────────────────
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  nameUrdu: varchar("name_urdu", { length: 100 }),
  parentId: integer("parent_id"),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 40 }).notNull(), // Bag, Ton, KG, Piece, Feet, Meter, Sqft, Liter
  shortCode: varchar("short_code", { length: 10 }),
});

// Conversion between units for a specific product (e.g. 1 Ton = 1000 KG for "Mughal Steel 60mm")
export const productUnitConversions = pgTable("product_unit_conversions", {
  id: serial("id").primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  fromUnitId: integer("from_unit_id").references(() => units.id).notNull(),
  toBaseUnitFactor: numeric("to_base_unit_factor", { precision: 14, scale: 6 }).notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  nameUrdu: varchar("name_urdu", { length: 160 }),
  categoryId: integer("category_id").references(() => categories.id),
  baseUnitId: integer("base_unit_id").references(() => units.id).notNull(),
  barcode: varchar("barcode", { length: 60 }),
  imageUrl: text("image_url"),
  purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 }).default("0"),
  salePrice: numeric("sale_price", { precision: 14, scale: 2 }).default("0"), // current/reference rate only — NEVER used for historical invoice totals
  minStock: numeric("min_stock", { precision: 14, scale: 3 }).default("0"),
  maxStock: numeric("max_stock", { precision: 14, scale: 3 }), // optional "full container" capacity reference for stock-level visuals; null = auto-derived from minStock
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Rate change timeline — for reporting/trend charts only, not for invoice totals
export const rateHistory = pgTable("rate_history", {
  id: serial("id").primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow(),
}, (t) => ({
  productDateIdx: index("rate_history_product_date_idx").on(t.productId, t.effectiveFrom),
}));

// ── Warehouses & Stock (per-branch stock, not global) ──
export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
});

export const productStock = pgTable("product_stock", {
  id: serial("id").primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id).notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("0"), // in base unit
  version: integer("version").notNull().default(0), // optimistic concurrency check
}, (t) => ({
  productWarehouseIdx: uniqueIndex("product_stock_product_warehouse_idx").on(t.productId, t.warehouseId),
}));

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id).notNull(),
  quantityChange: numeric("quantity_change", { precision: 14, scale: 3 }).notNull(), // +ve or -ve, base unit
  reason: varchar("reason", { length: 40 }).notNull(), // sale, purchase, sale_return, purchase_return, transfer, adjustment
  referenceId: uuid("reference_id"), // invoice id / transfer id / adjustment id
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  productDateIdx: index("stock_movements_product_date_idx").on(t.productId, t.createdAt),
}));

// A transfer is one paired -qty/+qty adjustStock call under one reference — the row here
// is the human-readable record; the two stock_movements rows are the audit detail.
export const stockTransfers = pgTable("stock_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id).notNull(),
  toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id).notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  note: text("note"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  idempotencyIdx: uniqueIndex("stock_transfers_idempotency_idx").on(t.idempotencyKey),
  productDateIdx: index("stock_transfers_product_date_idx").on(t.productId, t.createdAt),
}));

// ── Parties ───────────────────────────────────────────
export const parties = pgTable("parties", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  type: partyTypeEnum("type").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  cnic: varchar("cnic", { length: 20 }),
  address: text("address"),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).default("0"),
  cachedBalance: numeric("cached_balance", { precision: 14, scale: 2 }).default("0"), // regenerated from ledger_entries, never incremented directly
  balanceUpdatedAt: timestamp("balance_updated_at", { withTimezone: true }),
  publicToken: uuid("public_token").unique(), // lazily generated — lets a customer view their own balance without logging in
  lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Invoices ──────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  type: invoiceTypeEnum("type").notNull(),
  status: invoiceStatusEnum("status").notNull().default("confirmed"),
  invoiceNo: varchar("invoice_no", { length: 40 }).notNull(), // from per-tenant sequence
  partyId: uuid("party_id").references(() => parties.id),
  userId: uuid("user_id").references(() => users.id),
  originalInvoiceId: uuid("original_invoice_id"), // set on returns, points to the invoice being returned against
  projectId: uuid("project_id").references(() => projects.id), // optional — ties this sale to a site's running material total
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  // Named add-on charges — loader/rolly labor, freight, etc. — added on top of the item
  // subtotal: [{ label: string, amount: number }]. Stored as a snapshot at invoice time,
  // same principle as invoice_items, so a later rename of nothing (there's no separate
  // "charge type" table) never rewrites history.
  otherCharges: jsonb("other_charges").$type<{ label: string; amount: number }[]>(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  idempotencyKey: uuid("idempotency_key").notNull(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedBy: uuid("voided_by").references(() => users.id),
  // Delivery is opt-in metadata on the invoice, not a separate entity — a small shop's
  // mental model is "this bill has a driver assigned," not a standalone shipment record.
  deliveryEmployeeId: uuid("delivery_employee_id").references(() => employees.id),
  deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("not_applicable"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  publicToken: uuid("public_token").unique(), // lazily generated — customer order-tracking link, no login
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  invoiceNoPerTenantIdx: uniqueIndex("invoices_tenant_invoiceno_idx").on(t.tenantId, t.invoiceNo),
  idempotencyIdx: uniqueIndex("invoices_idempotency_idx").on(t.idempotencyKey),
  partyDateIdx: index("invoices_party_date_idx").on(t.partyId, t.createdAt),
}));

// A construction site spanning many separate sales over weeks/months (foundation today,
// walls next month, slab after that) — grouping them lets the shop see cumulative material
// supplied against the original estimate, instead of each sale standing alone.
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  partyId: uuid("party_id").references(() => parties.id),
  address: text("address"),
  status: projectStatusEnum("status").notNull().default("active"),
  // snapshot of the Material Estimator's linked lines at project creation time:
  // { productId, productName, targetQuantity, unitName }[] — the "plan" actual sales are measured against
  estimateSnapshot: jsonb("estimate_snapshot"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  unitId: integer("unit_id").references(() => units.id).notNull(), // unit the sale/purchase actually happened in
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(), // in unitId, not base unit
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(), // SNAPSHOT — never re-derive from products.salePrice
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
});

// ── Quotations (estimates for contractors — zero stock/ledger effect until converted) ─
export const quotations = pgTable("quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  quotationNo: varchar("quotation_no", { length: 40 }).notNull(),
  partyId: uuid("party_id").references(() => parties.id),
  userId: uuid("user_id").references(() => users.id),
  status: quotationStatusEnum("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  notes: text("notes"),
  // set once a sale invoice is created from this quotation — see quotations.service.ts convertToInvoice()
  convertedInvoiceId: uuid("converted_invoice_id").references(() => invoices.id),
  publicToken: uuid("public_token").unique(), // lazily generated — customer accept-quotation link, no login
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  quotationNoPerTenantIdx: uniqueIndex("quotations_tenant_quotationno_idx").on(t.tenantId, t.quotationNo),
}));

export const quotationItems = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: uuid("quotation_id").references(() => quotations.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  unitId: integer("unit_id").references(() => units.id).notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(), // honored at conversion time, even if the product's rate has since changed
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
});

// ── Ledger (source of truth for all balances) ─────────
export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  partyId: uuid("party_id").references(() => parties.id).notNull(),
  direction: ledgerDirectionEnum("direction").notNull(), // debit = party owes more, credit = party owes less
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  sourceType: varchar("source_type", { length: 30 }).notNull(), // invoice, payment, opening_balance, adjustment
  sourceId: uuid("source_id").notNull(),
  // True insertion order for the hash chain — createdAt alone isn't enough because two
  // entries posted in the same transaction (e.g. a sale's invoice debit + payment credit)
  // can land in the same millisecond, and Postgres doesn't guarantee a stable re-sort on
  // ties. This column is DB-assigned and strictly increasing per insert, so it's used
  // instead of createdAt for both writing and verifying the chain.
  chainSeq: serial("chain_seq").notNull(),
  // Hash chain: entryHash = sha256(prevHash + this row's fields). Any row edited in place
  // (outside postLedgerEntry, e.g. a direct DB update) breaks the chain from that point on —
  // see ledger.service.ts verifyLedgerIntegrity(). Null on legacy rows written before this existed.
  prevHash: varchar("prev_hash", { length: 64 }),
  entryHash: varchar("entry_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  partyDateIdx: index("ledger_party_date_idx").on(t.partyId, t.createdAt),
  sourceIdx: index("ledger_source_idx").on(t.sourceType, t.sourceId),
}));

// ── Payments ──────────────────────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  partyId: uuid("party_id").references(() => parties.id).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id), // optional — which specific bill this payment settles; null = on-account/advance
  method: paymentMethodEnum("method").notNull().default("cash"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  note: text("note"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  idempotencyIdx: uniqueIndex("payments_idempotency_idx").on(t.idempotencyKey),
  invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
}));

// Post-dated cheques need their own lifecycle — a payment isn't "done" until cleared
export const cheques = pgTable("cheques", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),
  chequeNo: varchar("cheque_no", { length: 40 }).notNull(),
  bankName: varchar("bank_name", { length: 120 }),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  status: chequeStatusEnum("status").notNull().default("pending"),
});

// Freezes a product's price for a specific customer for a time window — common for regular
// contractors when cement/steel rates are climbing and the shop wants to honor an old quote.
export const rateLocks = pgTable("rate_locks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  partyId: uuid("party_id").references(() => parties.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  lockedPrice: numeric("locked_price", { precision: 14, scale: 2 }).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  partyProductIdx: index("rate_locks_party_product_idx").on(t.partyId, t.productId),
}));

export const cashBook = pgTable("cash_book", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  direction: ledgerDirectionEnum("direction").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  // defaultRandom() so a double-submit of the SAME client-issued key replays instead of
  // duplicating the entry — existing rows each get their own fresh value on migration.
  idempotencyKey: uuid("idempotency_key").defaultRandom().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  idempotencyIdx: uniqueIndex("cash_book_idempotency_idx").on(t.idempotencyKey),
}));

// One row per day a shop "closes the till" — a snapshot of that day's figures plus what
// the cashier actually counted, so a shortage/overage on a specific date is on record
// rather than discovered (or not) weeks later.
export const dailyClosings = pgTable("daily_closings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  closingDate: date("closing_date", { mode: "string" }).notNull(), // Asia/Karachi calendar day
  salesTotal: numeric("sales_total", { precision: 14, scale: 2 }).notNull(),
  purchasesTotal: numeric("purchases_total", { precision: 14, scale: 2 }).notNull(),
  cashCollected: numeric("cash_collected", { precision: 14, scale: 2 }).notNull(),
  bankCollected: numeric("bank_collected", { precision: 14, scale: 2 }).notNull(),
  chequeCollected: numeric("cheque_collected", { precision: 14, scale: 2 }).notNull(),
  expensesTotal: numeric("expenses_total", { precision: 14, scale: 2 }).notNull(),
  expectedCash: numeric("expected_cash", { precision: 14, scale: 2 }).notNull(),
  countedCash: numeric("counted_cash", { precision: 14, scale: 2 }).notNull(),
  discrepancy: numeric("discrepancy", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  closedBy: uuid("closed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  perBranchDateIdx: uniqueIndex("daily_closings_branch_date_idx").on(t.branchId, t.closingDate),
}));

// General business expenses (rent, utilities, fuel, maintenance...) — categorized and
// separately reportable, but also auto-posts a matching Cash Out row so the existing
// Cash Book total still reflects every rupee leaving the till.
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  method: paymentMethodEnum("method").notNull().default("cash"),
  expenseDate: date("expense_date", { mode: "string" }).notNull(), // Asia/Karachi calendar day
  cashBookEntryId: integer("cash_book_entry_id").references(() => cashBook.id),
  createdBy: uuid("created_by").references(() => users.id),
  idempotencyKey: uuid("idempotency_key").defaultRandom().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  branchDateIdx: index("expenses_branch_date_idx").on(t.branchId, t.expenseDate),
  idempotencyIdx: uniqueIndex("expenses_idempotency_idx").on(t.idempotencyKey),
}));

// Hashed refresh tokens — lets logout/rotation actually revoke access instead of relying on JWT expiry alone.
// Also doubles as the "device details" record the platform admin sees per tenant: one live
// row per logged-in device, re-stamped (lastUsedAt) on every rotation.
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  // Denormalized from users.tenantId so "all live devices for tenant X" is one indexed
  // query instead of a join. Nullable during rollout — see drizzle/0018 migration notes.
  tenantId: uuid("tenant_id").references(() => tenants.id),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  userIdx: index("refresh_tokens_user_idx").on(t.userId),
  tenantIdx: index("refresh_tokens_tenant_idx").on(t.tenantId),
}));

// ── Platform admin (SaaS operator layer, sits above every tenant) ─────
// Deliberately disjoint from `users`/`refreshTokens` — own identity table, own token
// table, own audit log — so a bug or bypass in tenant-land can never reach this layer.
// The only way a row is ever created here is the scripts/create-platform-admin.ts
// bootstrap script; there is no HTTP route that creates one.
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  role: platformAdminRoleEnum("role").notNull().default("super_admin"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// One-time backup codes, generated and shown once at bootstrap, for recovering access if
// the 2FA device is lost. Hashed at rest like a password, never stored in plaintext.
export const platformAdminRecoveryCodes = pgTable("platform_admin_recovery_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformAdminId: uuid("platform_admin_id").references(() => platformAdmins.id).notNull(),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  adminIdx: index("platform_admin_recovery_codes_admin_idx").on(t.platformAdminId),
}));

export const platformRefreshTokens = pgTable("platform_refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformAdminId: uuid("platform_admin_id").references(() => platformAdmins.id).notNull(),
  tokenHash: text("token_hash").notNull(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  adminIdx: index("platform_refresh_tokens_admin_idx").on(t.platformAdminId),
}));

// Append-only by convention (same discipline as ledger_entries) — no update/delete
// function is ever written for this table. Not tenant-scoped: a platform action isn't
// "inside" a tenant, it's done *to* one.
export const platformAuditLog = pgTable("platform_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformAdminId: uuid("platform_admin_id").references(() => platformAdmins.id).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // login, tenant_created, tenant_suspended, tenant_reactivated, tenant_closed
  targetTenantId: uuid("target_tenant_id").references(() => tenants.id),
  beforeData: text("before_data"), // JSON snapshot — never plaintext secrets
  afterData: text("after_data"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  idempotencyKey: uuid("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  targetIdx: index("platform_audit_log_target_idx").on(t.targetTenantId, t.createdAt),
  adminIdx: index("platform_audit_log_admin_idx").on(t.platformAdminId, t.createdAt),
}));

// Atomic per-(tenant, branch, document type, year) invoice numbering — locked with
// SELECT ... FOR UPDATE instead of app-code MAX(id)+1, which breaks under concurrency.
export const invoiceNumberCounters = pgTable("invoice_number_counters", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  // plain varchar, not invoiceTypeEnum — also backs quotation numbering ("QUO-2026-000123"),
  // which isn't one of the invoice document types
  documentType: varchar("document_type", { length: 30 }).notNull(),
  year: integer("year").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
}, (t) => ({
  counterIdx: uniqueIndex("invoice_number_counters_idx").on(t.tenantId, t.branchId, t.documentType, t.year),
}));

// ── Employees / Labor (drivers, loaders, helpers — not system users) ──
// Deliberately separate from `parties`/`ledger_entries`/`payments`: a shared polymorphic
// table would require every existing party-picker (Sale/Purchase POS, quotations, WhatsApp
// reminders) to be audited and filtered so labor never leaks in as an invoice counterparty.
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  cnic: varchar("cnic", { length: 20 }),
  designation: varchar("designation", { length: 80 }), // Driver, Loader, Helper, ...
  employmentType: employmentTypeEnum("employment_type").notNull().default("daily_wage"),
  dailyWageRate: numeric("daily_wage_rate", { precision: 12, scale: 2 }).default("0"),
  monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }).default("0"),
  joiningDate: date("joining_date", { mode: "string" }),
  cachedBalance: numeric("cached_balance", { precision: 14, scale: 2 }).default("0"), // regenerated from employee_ledger_entries — what the business owes this employee, never incremented directly
  balanceUpdatedAt: timestamp("balance_updated_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// One row per employee per Asia/Karachi calendar day — marking present auto-posts that
// day's wage to the ledger, so "days worked x rate" never needs manual recalculation.
export const employeeAttendance = pgTable("employee_attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  date: date("date", { mode: "string" }).notNull(), // Asia/Karachi calendar day, from karachiDateString() — never the UTC day
  status: attendanceStatusEnum("status").notNull(),
  wageAmount: numeric("wage_amount", { precision: 12, scale: 2 }).default("0"), // snapshot of what was posted — a later rate change never rewrites history
  note: text("note"),
  markedBy: uuid("marked_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  employeeDateIdx: uniqueIndex("employee_attendance_emp_date_idx").on(t.employeeId, t.date),
}));

export const employeeLedgerEntries = pgTable("employee_ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  direction: ledgerDirectionEnum("direction").notNull(), // debit = wage owed increases, credit = paid out / decreases
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  sourceType: varchar("source_type", { length: 30 }).notNull(), // attendance_wage, attendance_correction, payment, adjustment
  sourceId: uuid("source_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  employeeDateIdx: index("employee_ledger_emp_date_idx").on(t.employeeId, t.createdAt),
}));

export const employeePayments = pgTable("employee_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  method: paymentMethodEnum("method").notNull().default("cash"), // cheque is a valid enum value but not offered for labor payouts
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  isAdvance: boolean("is_advance").default(false),
  note: text("note"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  idempotencyIdx: uniqueIndex("employee_payments_idempotency_idx").on(t.idempotencyKey),
}));

// One row per employee per calendar month — posting salary auto-debits the ledger, and
// re-posting the same month corrects by the delta instead of duplicating, mirroring attendance.
export const employeeSalaryPostings = pgTable("employee_salary_postings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  postedBy: uuid("posted_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  employeeMonthIdx: uniqueIndex("employee_salary_posting_emp_month_idx").on(t.employeeId, t.month),
}));

// One row per reconciliation pass (nightly cron or manual "Run Now") — even a clean run
// with zero mismatches is recorded, so "last checked: 5 min ago, all clear" is showable
// without digging through audit_log (which only ever gets a row when something's wrong).
export const reconciliationRuns = pgTable("reconciliation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  mismatchCount: integer("mismatch_count").notNull(),
  triggeredBy: varchar("triggered_by", { length: 20 }).notNull(), // "cron" | "manual"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  tenantDateIdx: index("reconciliation_runs_tenant_date_idx").on(t.tenantId, t.createdAt),
}));

// ── Audit ─────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 40 }).notNull(), // invoice_void, payment_edit, stock_adjustment, etc.
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  beforeData: text("before_data"), // JSON snapshot
  afterData: text("after_data"),   // JSON snapshot
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
