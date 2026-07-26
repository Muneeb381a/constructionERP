import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listProductConversions, type Product } from "../lib/api/products";
import type { Unit } from "../lib/api/units";

export type CartItem = {
  key: string;
  productId: string;
  productName: string;
  baseUnitId: number;
  unitOptions: { id: number; name: string }[];
  unitId: number;
  quantity: number;
  unitPrice: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Shared cart state for both sale and purchase invoice screens — adding a product
 * resolves its unit conversions once so the unit dropdown always matches what's actually
 * sellable/purchasable for that item, and defaults its price from the given field. */
export function useInvoiceCart(units: Unit[] | undefined, priceField: "salePrice" | "purchasePrice") {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);

  async function addProduct(product: Product) {
    if (cart.some((item) => item.productId === product.id && item.unitId === product.baseUnitId)) return;

    const conversions = await queryClient.fetchQuery({
      queryKey: ["product-conversions", product.id],
      queryFn: () => listProductConversions(product.id),
    });

    const unitOptions = [
      { id: product.baseUnitId, name: units?.find((u) => u.id === product.baseUnitId)?.name ?? "base unit" },
      ...conversions.map((c) => ({
        id: c.fromUnitId,
        name: units?.find((u) => u.id === c.fromUnitId)?.name ?? `unit ${c.fromUnitId}`,
      })),
    ];

    setCart((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        baseUnitId: product.baseUnitId,
        unitOptions,
        unitId: product.baseUnitId,
        quantity: 1,
        unitPrice: Number(product[priceField]),
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<CartItem>) {
    setCart((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  function clear() {
    setCart([]);
  }

  const subtotal = round2(cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));

  return { cart, addProduct, updateItem, removeItem, clear, subtotal };
}
