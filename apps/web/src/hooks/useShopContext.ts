import { useQuery } from "@tanstack/react-query";
import { listBranches } from "../lib/api/branches";
import { listWarehouses } from "../lib/api/warehouses";

/**
 * This product supports multiple branches/warehouses in the data model (a tenant can grow
 * into one), but almost every shop using it today is a single location with a single
 * stockroom. Rather than showing a branch/warehouse picker on every screen, this hook
 * silently resolves "the" branch and warehouse (the first one, which is all but always the
 * only one) so forms can just use them — no dropdown, no decision for the owner to make.
 */
export function useShopContext() {
  const { data: branches, isLoading: branchesLoading } = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const { data: warehouses, isLoading: warehousesLoading } = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });

  const branchId = branches?.[0]?.id ?? "";
  const warehouseId = warehouses?.[0]?.id ?? "";

  return {
    branchId,
    warehouseId,
    isLoading: branchesLoading || warehousesLoading,
    hasWarehouse: !!warehouseId,
  };
}
