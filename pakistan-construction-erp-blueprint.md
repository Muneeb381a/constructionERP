# Pakistan Construction ERP — System Design Blueprint (v2)

POS + Inventory + Accounting + CRM for Pakistani building material dealers (cement, steel, sand/crush, tiles, sanitary, electrical, paint, hardware) and contractors.

This version is written the way a senior system designer would approach it: every schema decision has a "why", and every module lists the edge cases that break naive implementations in this specific domain.

---

## 1. Architectural Decisions That Must Be Made Before Writing Code

These are the decisions that are expensive to reverse later. Get them right first.

### 1.1 Single-tenant vs Multi-tenant
**Assumption made here: multi-tenant SaaS from day one** — every business (cement dealer, steel trader, hardware shop) is a `tenant`, and every table carries `tenant_id`. Reasoning: retrofitting multi-tenancy after launch means touching every table, every query, and every index. It's cheap to add now, brutally expensive later — and given your other project (Assaan Electronics) is also multi-tenant SaaS, this is the pattern you're already committed to as a business model. **If you actually want a single-shop, sell-as-installed-software product instead, say so — it simplifies the schema a lot and I'll strip tenant_id out.**

### 1.2 Ledger balance: stored vs computed
Naive design stores `parties.balance` as a mutable number that gets `+=`/`-=` on every transaction. This **will drift** — a failed request that updates stock but not balance, a manual DB fix, a race condition — and once it drifts, nobody trusts the software again (this is the #1 reason Pakistani shop owners abandon custom software).

**Decision: append-only ledger table (`ledger_entries`) is the source of truth. `parties.balance` is a cached/denormalized column that is only ever set by re-summing `ledger_entries`, never incremented directly.** A nightly reconciliation job re-sums and flags mismatches. This is the same principle as double-entry bookkeeping — never trust a running total you can't regenerate from history.

### 1.3 Rate changes must not corrupt historical invoices
Steel and cement rates change daily, sometimes twice a day. If `invoice_items.unitPrice` is looked up live from `products.salePrice` at render time instead of being **snapshotted at the moment of sale**, every old invoice's total will silently change when today's rate changes. This is not a hypothetical — it's the single most common bug in Pakistani retail software.

**Decision: `invoice_items` always stores its own `unit_price` and `line_total` at creation time. Never join to `products.salePrice` for historical display.** A separate `rate_history` table tracks the rate timeline for reporting/trend purposes only.

### 1.4 Units: don't model as one unit per product
Real scenario: steel is purchased in Tons, sold in KG or per-piece (saria), cement is purchased and sold in Bags but sometimes broken and sold loose in KG. A single `unit_id` on `products` cannot represent this.

**Decision: `products.base_unit_id` (the unit stock is tracked in) + a `product_unit_conversions` table** (e.g. 1 Ton = 1000 KG, 1 Bag = 50 KG) so sales/purchases can happen in any allowed unit and the system converts to base unit for stock deduction.

### 1.5 Stock concurrency
Two cashiers on two terminals sell the last 2 bags of cement at the same second. Naive `UPDATE products SET stock = stock - qty` without a transaction + row lock can oversell.

**Decision: every stock-affecting operation runs inside a DB transaction with `SELECT ... FOR UPDATE` on the product row (or the `product_stock` row per warehouse) before checking/deducting quantity.** Reject or flag negative stock based on a per-tenant setting (see 1.7).

### 1.6 Invoice numbering
`invoice_no` generated in application code (`SELECT MAX(id)+1`) breaks under concurrency — two invoices can get the same number. **Decision: use a Postgres sequence per tenant+branch+document type+year** (`INV-2026-000123`), fetched via `nextval()` inside the same transaction as invoice creation.

### 1.7 Negative stock policy
Many Pakistani dealers deliberately sell beyond recorded stock (goods arriving same day, stock not yet entered). Blocking this outright makes shop owners abandon the software.

**Decision: `tenants.allow_negative_stock` boolean setting.** Default: warn but allow for Owner/Manager, block for Cashier unless overridden.

### 1.8 Soft deletes + audit trail on financial records
Nothing that touches money is ever hard-deleted. Every invoice, payment, and stock adjustment edit/cancel is captured in an `audit_log` table (who, when, before/after values). Cashiers should not be able to edit/delete an invoice after save — only Owner/Manager can void it (which creates a reversing entry, not a delete).

### 1.9 Idempotency on financial write endpoints
Double-clicking "Save Invoice" on a slow connection is the most common real-world cause of duplicate invoices in POS software. **Decision: client generates a UUID `idempotency_key` per invoice attempt; server stores it and returns the existing invoice if the same key is retried**, instead of creating a duplicate.

### 1.10 Timezone
All timestamps stored in UTC in Postgres (`timestamptz`), converted to Asia/Karachi only at the display/report layer. "Today's Sale" on the dashboard must filter by Pakistan calendar day, not UTC day — a sale at 11 PM PKT must not fall into "yesterday."

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM + drizzle-kit (migrations) |
| Auth | JWT (short-lived access + refresh token, rotated) + bcrypt |
| Validation | Zod (shared package between frontend/backend) |
| Media/Docs | Cloudinary free tier |
| PDF generation | `pdf-lib` (self-hosted, free) |
| Real-time | Socket.io (dashboard live updates) |
| Frontend state | React Query + Zustand |
| Background jobs (Phase 1+) | `node-cron` for reconciliation/reports — no paid queue needed at this scale |
| Deployment | Render/Railway free tier → VPS + Docker later |

---

## 3. Database Schema (Drizzle ORM)

```ts
// db/schema.ts
import {
  pgTable, serial, varchar, text, integer, numeric, timestamp,
  boolean, pgEnum, uuid, uniqueIndex, index
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["owner", "manager", "cashier", "accountant"]);
export const partyTypeEnum = pgEnum("party_type", ["customer", "supplier"]);
export const invoiceTypeEnum = pgEnum("invoice_type", ["sale", "purchase", "sale_return", "purchase_return"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "confirmed", "void"]);
export const ledgerDirectionEnum = pgEnum("ledger_direction", ["debit", "credit"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bank_transfer", "cheque"]);
export const chequeStatusEnum = pgEnum("cheque_status", ["pending", "cleared", "bounced"]);

// ── Tenancy ───────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessName: varchar("business_name", { length: 160 }).notNull(),
  allowNegativeStock: boolean("allow_negative_stock").default(false),
  defaultCurrency: varchar("default_currency", { length: 10 }).default("PKR"),
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
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  idempotencyKey: uuid("idempotency_key").notNull(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedBy: uuid("voided_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  invoiceNoPerTenantIdx: uniqueIndex("invoices_tenant_invoiceno_idx").on(t.tenantId, t.invoiceNo),
  idempotencyIdx: uniqueIndex("invoices_idempotency_idx").on(t.idempotencyKey),
  partyDateIdx: index("invoices_party_date_idx").on(t.partyId, t.createdAt),
}));

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  unitId: integer("unit_id").references(() => units.id).notNull(), // unit the sale/purchase actually happened in
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(), // in unitId, not base unit
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(), // SNAPSHOT — never re-derive from products.salePrice
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
  method: paymentMethodEnum("method").notNull().default("cash"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  note: text("note"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  idempotencyIdx: uniqueIndex("payments_idempotency_idx").on(t.idempotencyKey),
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

export const cashBook = pgTable("cash_book", {
  id: serial("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  direction: ledgerDirectionEnum("direction").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

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
```

Every table with `tenant_id` should also get a Postgres Row-Level Security policy in Phase 1 once you have >1 real tenant — for MVP with a single pilot tenant, enforcing `tenant_id` in the WHERE clause of every query at the application layer is enough, but plan the RLS migration now so it isn't a rewrite later.

---

## 4. Edge Case Catalog (by module)

### Inventory
- Selling a quantity in a unit other than the base unit (KG sale of a Ton-tracked product) → must go through `product_unit_conversions`, round to the base unit's precision, and never silently truncate a fractional remainder.
- Two terminals selling the last unit of the same product simultaneously → row-level lock (`SELECT ... FOR UPDATE`) on `product_stock` inside the invoice transaction.
- Negative stock → allowed/blocked per `tenants.allow_negative_stock`, and even when allowed, flagged in a "negative stock" report so the owner can reconcile physical stock later.
- Stock transfer between warehouses failing halfway (deduct succeeds at source, credit fails at destination) → must be one DB transaction, not two API calls.
- Product deactivated (`isActive = false`) but still referenced in old invoices → never hard-delete products; deactivate only, historical invoice_items keep the FK.

### Sales / Purchase
- Rate changed after invoice creation → invoice_items.unitPrice is a snapshot, immune to later product price changes.
- Return against an invoice that was later voided → reject; check `invoices.status` before allowing a return.
- Partial return (customer returns 2 of 5 bags) → return invoice references `originalInvoiceId` but is its own invoice with its own items/ledger entries, never mutates the original.
- Discount applied at both line level and invoice level → decide precedence explicitly (line discount first, then invoice-level discount on the post-line-discount subtotal) and document it — don't let it be implicit in code.
- Cashier accidentally creates duplicate invoice via double-click/slow network → idempotency key on the client-generated draft prevents duplicate rows.

### Credit / Ledger
- Customer balance appears wrong after a support ticket → because `cached_balance` might be stale; the fix is to re-sum `ledger_entries` for that party, never to manually edit the cached column.
- Customer exceeds credit limit → warn at UI level for Manager/Owner, hard-block for Cashier role, with an explicit "Owner override" action that gets audit-logged.
- Cheque bounces after being recorded as a payment → don't delete the payment; instead reverse it with a new ledger entry tagged `source_type = cheque_bounce`, and update `cheques.status = bounced`. The customer's balance goes back up, but history shows both the original payment attempt and the reversal.
- Opening balance for a customer being onboarded mid-relationship → a `ledger_entries` row with `source_type = opening_balance`, not a hack on `cached_balance`.

### Multi-branch / Multi-warehouse
- Same product sold from two branches → stock is per-`(product, warehouse)`, never a single global number once Phase 2 (multi-branch) is enabled.
- Branch-level cash book vs tenant-level financial reports → cash_book is branch-scoped; P&L/trial balance aggregate across branches for tenant-level owners only.

### Security / Access
- Cashier tries to edit or delete a confirmed invoice → blocked at the API layer regardless of frontend UI state (never trust client-side role checks alone).
- Voided invoice must reverse both stock and ledger effects atomically, and record who voided it and why (`audit_log`).
- JWT refresh token reuse after logout → refresh tokens should be stored (hashed) server-side and invalidated on logout/rotation, not just relying on short expiry.

### Reporting / Time
- "Today's Sales" must filter by Asia/Karachi calendar day computed from `timestamptz`, not by UTC date — a sale at 11:30 PM PKT is 6:30 PM UTC same day, but a sale at 1 AM PKT is 8 PM UTC the *previous* day; get this wrong and the dashboard misreports for hours every day.
- Fast-moving / dead stock reports need `stock_movements`, not just current `product_stock.quantity` — you need the history, not just the snapshot.

---

## 5. API Design Notes

- Every financial mutation endpoint (create invoice, record payment, void invoice, stock adjustment) requires an `Idempotency-Key` header; server dedupes on it.
- Every such endpoint runs in a single Postgres transaction: check credit limit → lock stock rows → deduct/add stock → insert invoice + items → insert ledger entries → commit. If any step fails, everything rolls back.
- Role checks happen server-side on every route, not just hidden UI buttons.
- All list endpoints (invoices, ledger, stock movements) are paginated and filterable by date range from day one — a shop doing 50+ invoices/day will have tens of thousands of rows within a year.

---

## 6. Folder Structure

```
construction-erp/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   └── index.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── tenants/
│   │   │   │   ├── products/
│   │   │   │   ├── inventory/        # stock, warehouses, movements, transfers
│   │   │   │   ├── parties/
│   │   │   │   ├── invoices/         # sale, purchase, returns
│   │   │   │   ├── payments/         # payments, cheques
│   │   │   │   ├── ledger/
│   │   │   │   ├── audit/
│   │   │   │   └── dashboard/
│   │   │   ├── middleware/           # auth guard, role guard, tenant scoping, error handler, idempotency
│   │   │   └── server.ts
│   │   └── drizzle.config.ts
│   └── web/
│       └── src/
│           ├── pages/
│           ├── components/
│           ├── lib/i18n/
│           └── store/
└── packages/
    └── shared/                        # Zod schemas shared between api & web
```

---

## 7. Build Order (Phase 0 — strict sequence, do not skip ahead)

1. Monorepo (pnpm workspaces), Postgres + Drizzle connection
2. Migration: `tenants`, `branches`, `users` + auth (JWT, bcrypt, role guard, tenant-scoping middleware)
3. `categories`, `units` — CRUD + seed script
4. `products` + `product_unit_conversions` — CRUD, Cloudinary image upload
5. `warehouses` + `product_stock` — with row-lock-safe stock adjustment function used by every later module
6. `parties` — CRUD, credit limit field
7. `ledger_entries` table + a small internal service `postLedgerEntry()` used by every module below (never write ledger rows ad hoc from multiple places)
8. Sale invoice: creation flow using idempotency key + transaction (lock stock → deduct → insert invoice/items → post ledger entry)
9. Purchase invoice: same pattern, stock addition instead of deduction
10. Sales/Purchase returns: reference `originalInvoiceId`, reverse stock + ledger via the same shared functions
11. Payments (cash/bank) against a party + cheque sub-flow with `pending/cleared/bounced` lifecycle
12. Cash book (branch-scoped manual entries)
13. Void invoice flow (Owner/Manager only) — reversing entries + audit log, not deletion
14. Dashboard API — today's sale/purchase computed in Asia/Karachi calendar day, cash in hand, outstanding, low stock
15. Frontend: all Phase 0 screens wired via React Query
16. i18n (English/Urdu, RTL/LTR) + PDF invoice generation
17. Reconciliation job (`node-cron`, nightly): re-sum `ledger_entries` per party, compare to `cached_balance`, log/report mismatches
18. Manual QA pass specifically against the Section 4 edge case list before calling Phase 0 done

---

## 8. Open Decision For You

Confirm before Step 1: **multi-tenant SaaS (as designed above) or single-shop installed product?** This determines whether `tenant_id` stays in every table or gets stripped out for a simpler single-business schema. Everything else in this document holds either way.
