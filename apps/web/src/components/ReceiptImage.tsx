import { formatCurrency } from "../lib/format";

const TYPE_LABELS: Record<string, string> = {
  sale: "Sale Invoice",
  purchase: "Purchase Invoice",
  sale_return: "Sale Return",
  purchase_return: "Purchase Return",
};

const ACCENT = "#b45309"; // amber-700 — same construction accent as the login page
const ACCENT_SOFT = "#fef3c7"; // amber-100
const INK = "#1c1917"; // stone-900
const MUTED = "#78716c"; // stone-500
const HAIRLINE = "#e7e5e4"; // stone-200

export type ReceiptLine = {
  productName: string;
  unitName: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export function ReceiptImage({
  businessName,
  logoUrl,
  invoiceNo,
  type,
  createdAt,
  partyName,
  partyPhone,
  businessPhone,
  items,
  subtotal,
  discount,
  otherCharges,
  totalAmount,
  status,
}: {
  businessName: string;
  logoUrl?: string | null;
  invoiceNo: string;
  type: string;
  createdAt: string;
  partyName?: string | null;
  partyPhone?: string | null;
  businessPhone?: string | null;
  items: ReceiptLine[];
  subtotal: string;
  discount: string;
  otherCharges?: { label: string; amount: number }[] | null;
  totalAmount: string;
  status?: "draft" | "confirmed" | "void";
}) {
  const charges = otherCharges ?? [];
  const isVoid = status === "void";

  return (
    <div
      style={{
        width: 380,
        background: "#ffffff",
        color: INK,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 6, background: ACCENT }} />

      {isVoid && (
        <div
          style={{
            position: "absolute",
            top: 28,
            right: -46,
            width: 180,
            transform: "rotate(35deg)",
            background: "#dc2626",
            color: "#fff",
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            padding: "3px 0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        >
          DELETED
        </div>
      )}

      <div style={{ padding: "22px 26px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ height: 46, maxWidth: 160, objectFit: "contain", margin: "0 auto 10px" }} />}
          <p style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.3 }}>{businessName}</p>
          {businessPhone && <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED }}>{businessPhone}</p>}
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
            {TYPE_LABELS[type] ?? type}
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
            marginBottom: 14,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED }}>
              Invoice No
            </p>
            <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{invoiceNo}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED }}>Date</p>
            <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{new Date(createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {partyName && (
          <div style={{ fontSize: 12, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED }}>
              Billed To
            </p>
            <p style={{ margin: "2px 0 0", fontWeight: 600 }}>
              {partyName}
              {partyPhone ? ` · ${partyPhone}` : ""}
            </p>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 4 }}>
          <thead>
            <tr style={{ background: ACCENT_SOFT }}>
              <th style={{ textAlign: "left", padding: "7px 8px", fontWeight: 700, fontSize: 10, letterSpacing: 0.4, color: ACCENT, borderRadius: "6px 0 0 6px" }}>
                ITEM
              </th>
              <th style={{ textAlign: "right", padding: "7px 8px", fontWeight: 700, fontSize: 10, letterSpacing: 0.4, color: ACCENT }}>
                QTY
              </th>
              <th style={{ textAlign: "right", padding: "7px 8px", fontWeight: 700, fontSize: 10, letterSpacing: 0.4, color: ACCENT }}>
                RATE
              </th>
              <th style={{ textAlign: "right", padding: "7px 8px", fontWeight: 700, fontSize: 10, letterSpacing: 0.4, color: ACCENT, borderRadius: "0 6px 6px 0" }}>
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 1 ? "#fafaf9" : "transparent" }}>
                <td style={{ padding: "7px 8px", fontWeight: 500 }}>{item.productName}</td>
                <td style={{ textAlign: "right", padding: "7px 8px", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {item.quantity} {item.unitName}
                </td>
                <td style={{ textAlign: "right", padding: "7px 8px", color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(Number(item.unitPrice))}
                </td>
                <td style={{ textAlign: "right", padding: "7px 8px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(Number(item.lineTotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ fontSize: 12, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, padding: "3px 8px" }}>
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(Number(subtotal))}</span>
          </div>
          {Number(discount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, padding: "3px 8px" }}>
              <span>Discount</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>−{formatCurrency(Number(discount))}</span>
            </div>
          )}
          {charges.map((charge, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", color: MUTED, padding: "3px 8px" }}>
              <span>{charge.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(charge.amount)}</span>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 10,
              padding: "12px 14px",
              background: ACCENT_SOFT,
              borderLeft: `4px solid ${ACCENT}`,
              borderRadius: 6,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: 0.4, textTransform: "uppercase" }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(Number(totalAmount))}
            </span>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 20, marginBottom: 0, fontStyle: "italic" }}>
          Thank you for your business!
        </p>
      </div>
    </div>
  );
}
