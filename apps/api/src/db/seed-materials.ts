import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "./index.js";
import { categories, units, products, productUnitConversions } from "./schema.js";

/**
 * Populates realistic Pakistani-market sample products for an existing tenant, based on
 * researched brand/size/price data (sariya, cement, bricks, sand, TR girder). Run AFTER
 * seed.ts, which must have already created the base categories/units this script looks up
 * by name. Idempotent — skips any product that already exists by name for the tenant.
 */

type ConversionSpec = { fromUnitName: string; toBaseUnitFactor: number };

type ProductSpec = {
  name: string;
  categoryName: string;
  baseUnitName: string;
  purchasePrice: number;
  salePrice: number;
  minStock: number;
  maxStock: number;
  conversion?: ConversionSpec;
};

// 40 ft standard bar weight (kg) by size — used for the Piece -> Kilogram conversion on rebar
const PRODUCTS: ProductSpec[] = [
  // Steel — Sariya (Piece = one 40ft bar, converts to its actual weight in kg)
  { name: "Amreli Grade 60 20mm", categoryName: "Steel", baseUnitName: "Kilogram", purchasePrice: 257, salePrice: 265, minStock: 500, maxStock: 3000, conversion: { fromUnitName: "Piece", toBaseUnitFactor: 30.12 } },
  { name: "Amreli Grade 60 16mm", categoryName: "Steel", baseUnitName: "Kilogram", purchasePrice: 257, salePrice: 265, minStock: 400, maxStock: 2500, conversion: { fromUnitName: "Piece", toBaseUnitFactor: 19.28 } },
  { name: "Agha Steel Grade 60 12mm", categoryName: "Steel", baseUnitName: "Kilogram", purchasePrice: 257, salePrice: 265, minStock: 300, maxStock: 2000, conversion: { fromUnitName: "Piece", toBaseUnitFactor: 10.84 } },
  { name: "Mughal Steel Grade 40 10mm", categoryName: "Steel", baseUnitName: "Kilogram", purchasePrice: 252, salePrice: 260, minStock: 300, maxStock: 2000, conversion: { fromUnitName: "Piece", toBaseUnitFactor: 7.52 } },
  // Steel — TR Girder (no fixed conversion: weighed per batch, unlike sariya)
  { name: "Mughal Supreme TR Girder 9 inch", categoryName: "Steel", baseUnitName: "Kilogram", purchasePrice: 285, salePrice: 300, minStock: 300, maxStock: 1500 },

  // Cement — sold and priced per bag
  { name: "Lucky Cement OPC", categoryName: "Cement", baseUnitName: "Bag", purchasePrice: 1400, salePrice: 1450, minStock: 100, maxStock: 500 },
  { name: "DG Khan Cement OPC", categoryName: "Cement", baseUnitName: "Bag", purchasePrice: 1380, salePrice: 1430, minStock: 100, maxStock: 500 },
  { name: "Maple Leaf Cement OPC", categoryName: "Cement", baseUnitName: "Bag", purchasePrice: 1370, salePrice: 1420, minStock: 100, maxStock: 500 },
  { name: "Fauji Cement OPC", categoryName: "Cement", baseUnitName: "Bag", purchasePrice: 1350, salePrice: 1400, minStock: 100, maxStock: 500 },

  // Bricks — priced per piece, quoted per Thousand
  { name: "A-Class Awwal Brick", categoryName: "Bricks", baseUnitName: "Piece", purchasePrice: 16.5, salePrice: 18, minStock: 5000, maxStock: 20000, conversion: { fromUnitName: "Thousand", toBaseUnitFactor: 1000 } },
  { name: "B-Class Brick", categoryName: "Bricks", baseUnitName: "Piece", purchasePrice: 11.5, salePrice: 13, minStock: 5000, maxStock: 20000, conversion: { fromUnitName: "Thousand", toBaseUnitFactor: 1000 } },

  // Sand — priced per CFT; trolley size varies by supplier, so no fixed conversion is set up
  { name: "Lawrencepur Sand", categoryName: "Sand & Crush", baseUnitName: "CFT", purchasePrice: 290, salePrice: 305, minStock: 200, maxStock: 1000 },
  { name: "Chenab Sand A-Grade", categoryName: "Sand & Crush", baseUnitName: "CFT", purchasePrice: 90, salePrice: 97.5, minStock: 200, maxStock: 1000 },
  { name: "Ravi Sand", categoryName: "Sand & Crush", baseUnitName: "CFT", purchasePrice: 80, salePrice: 87.5, minStock: 200, maxStock: 1000 },
];

async function seedMaterials(tenantId: string) {
  const cats = await db.select().from(categories).where(eq(categories.tenantId, tenantId));
  const uns = await db.select().from(units).where(eq(units.tenantId, tenantId));
  const catByName = new Map(cats.map((c) => [c.name, c.id]));
  const unitByName = new Map(uns.map((u) => [u.name, u.id]));

  for (const spec of PRODUCTS) {
    const categoryId = catByName.get(spec.categoryName);
    const baseUnitId = unitByName.get(spec.baseUnitName);
    if (!categoryId || !baseUnitId) {
      console.error(`! skipping "${spec.name}" — missing category "${spec.categoryName}" or unit "${spec.baseUnitName}". Run seed.ts first.`);
      continue;
    }

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.name, spec.name)))
      .limit(1);

    let productId = existing?.id;
    if (!existing) {
      const [inserted] = await db
        .insert(products)
        .values({
          tenantId,
          name: spec.name,
          categoryId,
          baseUnitId,
          purchasePrice: spec.purchasePrice.toString(),
          salePrice: spec.salePrice.toString(),
          minStock: spec.minStock.toString(),
          maxStock: spec.maxStock.toString(),
        })
        .returning({ id: products.id });
      productId = inserted.id;
      console.log(`+ product: ${spec.name}`);
    }

    if (spec.conversion && productId) {
      const fromUnitId = unitByName.get(spec.conversion.fromUnitName);
      if (!fromUnitId) {
        console.error(`! skipping conversion for "${spec.name}" — missing unit "${spec.conversion.fromUnitName}"`);
        continue;
      }
      const [existingConversion] = await db
        .select({ id: productUnitConversions.id })
        .from(productUnitConversions)
        .where(and(eq(productUnitConversions.productId, productId), eq(productUnitConversions.fromUnitId, fromUnitId)))
        .limit(1);
      if (!existingConversion) {
        await db.insert(productUnitConversions).values({
          productId,
          fromUnitId,
          toBaseUnitFactor: spec.conversion.toBaseUnitFactor.toString(),
        });
        console.log(`  + conversion: ${spec.conversion.fromUnitName} -> ${spec.conversion.toBaseUnitFactor} ${spec.baseUnitName}`);
      }
    }
  }
}

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: tsx src/db/seed-materials.ts <tenantId>");
  process.exit(1);
}

seedMaterials(tenantId)
  .then(() => {
    console.log("Materials seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
