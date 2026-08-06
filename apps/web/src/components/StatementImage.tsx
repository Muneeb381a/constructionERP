import { formatCurrency } from "../lib/format";
import type { PartyBill } from "../lib/api/payments";

const ACCENT = "#b45309"; // amber-700 — same construction accent used across the app's receipts
const ACCENT_SOFT = "#fef3c7"; // amber-100
const INK = "#1c1917"; // stone-900
const MUTED = "#78716c"; // stone-500
const HAIRLINE = "#e7e5e4"; // stone-200

const BILL_STATUS_LABELS: Record<PartyBill["status"], string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  void: "Deleted",
};

const BILL_STATUS_COLORS: Record<PartyBill["status"], string> = {
  paid: "#15803d",
  partial: "#b45309",
  unpaid: "#dc2626",
  void: "#78716c",
};

/** Shareable "account statement" image — same visual language as ReceiptImage, but for a
 * party's running bill history instead of a single invoice's line items. */
export function StatementImage({
  businessName,
  logoUrl,
  businessPhone,
  businessAddress,
  partyName,
  partyPhone,
  partyType,
  bills,
  balance,
}: {
  businessName: string;
  logoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  partyName: string;
  partyPhone?: string | null;
  partyType: "customer" | "supplier";
  bills: PartyBill[];
  balance: number;
}) {
  const openBills = bills.filter((b) => b.status !== "void");
  const balanceLabel = balance <= 0.01 ? "Settled" : partyType === "customer" ? "Balance Owed to You" : "Balance You Owe";

  return (
    <div
      style={{
        width: 420,
        background: "#ffffff",
        color: INK,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ height: 6, background: ACCENT }} />

      <div style={{ padding: "22px 26px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ height: 46, maxWidth: 160, objectFit: "contain", margin: "0 auto 10px" }} />}
          <p style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>{businessName}</p>
          {businessAddress && <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED }}>{businessAddress}</p>}
          {businessPhone && <p style={{ margin: "1px 0 0", fontSize: 11, color: MUTED }}>{businessPhone}</p>}
          <span
            style={{
              display: "inline-block",
              marginTop: 10,
              background: ACCENT_SOFT,
              color: ACCENT,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              padding: "4px 12px",
              borderRadius: 999,
            }}
          >
            Account Statement
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            padding: "12px 0",
            borderTop: `1px solid ${HAIRLINE}`,
            borderBottom: `1px solid ${HAIRLINE}`,
            marginBottom: 16,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED }}>
              {partyType === "customer" ? "Customer" : "Supplier"}
            </p>
            <p style={{ margin: "2px 0 0", fontWeight: 600 }}>
              {partyName}
              {partyPhone ? ` · ${partyPhone}` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED }}>
              Generated
            </p>
            <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginBottom: 4 }}>
          <thead>
            <tr style={{ background: ACCENT_SOFT }}>
              <th style={{ textAlign: "left", padding: "7px 8px", fontWeight: 700, fontSize: 9.5, letterSpacing: 0.4, color: ACCENT, borderRadius: "6px 0 0 6px" }}>
                BILL
              </th>
              <th style={{ textAlign: "right", padding: "7px 8px", fontWeight: 700, fontSize: 9.5, letterSpacing: 0.4, color: ACCENT }}>
                DATE
              </th>
              <th style={{ textAlign: "right", padding: "7px 8px", fontWeight: 700, fontSize: 9.5, letterSpacing: 0.4, color: ACCENT }}>
                TOTAL
              </th>
              <th style={{ textAlign: "right", padding: "7px 8px", fontWeight: 700, fontSize: 9.5, letterSpacing: 0.4, color: ACCENT, borderRadius: "0 6px 6px 0" }}>
                DUE
              </th>
            </tr>
          </thead>
          <tbody>
            {openBills.map((bill, i) => (
              <tr key={bill.invoice.id} style={{ background: i % 2 === 1 ? "#fafaf9" : "transparent" }}>
                <td style={{ padding: "7px 8px" }}>
                  <div style={{ fontWeight: 600 }}>{bill.invoice.invoiceNo}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: BILL_STATUS_COLORS[bill.status], marginTop: 1 }}>
                    {BILL_STATUS_LABELS[bill.status]}
                  </div>
                </td>
                <td style={{ textAlign: "right", padding: "7px 8px", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {new Date(bill.invoice.createdAt).toLocaleDateString()}
                </td>
                <td style={{ textAlign: "right", padding: "7px 8px", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(Number(bill.invoice.totalAmount))}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "7px 8px",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: bill.balanceDue > 0.01 ? "#dc2626" : INK,
                  }}
                >
                  {formatCurrency(Math.max(0, bill.balanceDue))}
                </td>
              </tr>
            ))}
            {openBills.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "16px 8px", textAlign: "center", color: MUTED }}>
                  No bills on record.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 12,
            padding: "12px 14px",
            background: ACCENT_SOFT,
            borderLeft: `4px solid ${ACCENT}`,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: 0.4, textTransform: "uppercase" }}>
            {balanceLabel}
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(balance)}
          </span>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 20, marginBottom: 0, fontStyle: "italic" }}>
          Thank you for your business!
        </p>
      </div>
    </div>
  );
}
