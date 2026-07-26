import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "./index.js";
import { categories, units } from "./schema.js";

const DEFAULT_UNITS = [
  { name: "Bag", shortCode: "bag" },
  { name: "Ton", shortCode: "ton" },
  { name: "Kilogram", shortCode: "kg" },
  { name: "Piece", shortCode: "pc" },
  { name: "Feet", shortCode: "ft" },
  { name: "Meter", shortCode: "m" },
  { name: "Square Feet", shortCode: "sqft" },
  { name: "Liter", shortCode: "ltr" },
  { name: "CFT", shortCode: "cft" }, // cubic feet — sand & crush
  { name: "Thousand", shortCode: "1000" }, // bricks/blocks are quoted per 1000 pieces
];

const DEFAULT_CATEGORIES = [
  { name: "Cement", nameUrdu: "سیمنٹ" },
  { name: "Steel", nameUrdu: "سریا" },
  { name: "Sand & Crush", nameUrdu: "ریت اور کرش" },
  { name: "Bricks", nameUrdu: "اینٹیں" },
  { name: "Tiles", nameUrdu: "ٹائلز" },
  { name: "Sanitary", nameUrdu: "سینیٹری" },
  { name: "Electrical", nameUrdu: "الیکٹریکل" },
  { name: "Paint", nameUrdu: "پینٹ" },
  { name: "Hardware", nameUrdu: "ہارڈویئر" },
];

async function seed(tenantId: string) {
  for (const unit of DEFAULT_UNITS) {
    const [existing] = await db
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.tenantId, tenantId), eq(units.name, unit.name)))
      .limit(1);
    if (!existing) {
      await db.insert(units).values({ tenantId, ...unit });
      console.log(`+ unit: ${unit.name}`);
    }
  }

  for (const category of DEFAULT_CATEGORIES) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.name, category.name)))
      .limit(1);
    if (!existing) {
      await db.insert(categories).values({ tenantId, ...category });
      console.log(`+ category: ${category.name}`);
    }
  }
}

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: pnpm db:seed <tenantId>");
  process.exit(1);
}

seed(tenantId)
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
