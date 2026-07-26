import cron from "node-cron";
import { reconcileAllBalances } from "../modules/reconciliation/reconciliation.service.js";

export function scheduleReconciliationJob() {
  // 2 AM daily, Asia/Karachi — off-peak for a retail shop
  cron.schedule(
    "0 2 * * *",
    async () => {
      try {
        const mismatches = await reconcileAllBalances();
        if (mismatches.length > 0) {
          console.warn(`[reconciliation] ${mismatches.length} balance mismatch(es) found and corrected`, mismatches);
        } else {
          console.log("[reconciliation] all party balances match ledger history");
        }
      } catch (err) {
        console.error("[reconciliation] job failed", err);
      }
    },
    { timezone: "Asia/Karachi" },
  );
}
