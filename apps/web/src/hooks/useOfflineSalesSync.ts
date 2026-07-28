import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSaleInvoice } from "../lib/api/invoices";
import { listQueuedSales, removeQueuedSale, type QueuedSale } from "../lib/offlineSalesQueue";

/** Tracks browser online/offline state, the locally-queued offline sales, and replays
 * them (oldest first) whenever the connection returns — each queued sale keeps the
 * idempotencyKey it was created with, so a retry after a dropped connection is safe. */
export function useOfflineSalesSync() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setQueued(await listQueuedSales());
  }, []);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const pending = await listQueuedSales();
      for (const item of pending) {
        try {
          await createSaleInvoice(item.input);
          await removeQueuedSale(item.idempotencyKey);
        } catch {
          break; // still offline (or a transient failure) — stop and retry on the next trigger
        }
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } finally {
      await refresh();
      setSyncing(false);
    }
  }, [syncing, refresh, queryClient]);

  useEffect(() => {
    refresh();
    function handleOnline() {
      setIsOnline(true);
      sync();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, queued, syncing, refresh, sync };
}
