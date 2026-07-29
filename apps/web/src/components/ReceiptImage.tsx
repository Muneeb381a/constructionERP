import { formatCurrency } from "../lib/format";

const TYPE_LABELS: Record<string, string> = {
  sale: "Sale Invoice",
  purchase: "Purchase Invoice",
  sale_return: "Sale Return",
  purchase_return: "Purchase Return",
};

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
  items,
  subtotal,
  discount,
  totalAmount,
}: {
  businessName: string;
  logoUrl?: string | null;
  invoiceNo: string;
  type: string;
  createdAt: string;
  partyName?: string | null;
  partyPhone?: string | null;
  items: ReceiptLine[];
  subtotal: string;
  discount: string;
  totalAmount: string;
}) {
  return (
    <div style={{ width: 380, background: "#ffffff", color: "#111827", fontFamily: "system-ui, -apple-system, sans-serif", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ height: 48, maxWidth: 160, objectFit: "contain", margin: "0 auto 8px" }} />}
        <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{businessName}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{TYPE_LABELS[type] ?? type}</p>
      </div>

      <div style={{ borderTop: "1px dashed #d1d5db", borderBottom: "1px dashed #d1d5db", padding: "10px 0", marginBottom: 12, fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7280" }}>Invoice No</span>
          <span style={{ fontWeight: 600 }}>{invoiceNo}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ color: "#6b7280" }}>Date</span>
          <span>{new Date(createdAt).toLocaleString()}</span>
        </div>
        {partyName && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "#6b7280" }}>Customer</span>
            <span>
              {partyName}
              {partyPhone ? ` · ${partyPhone}` : ""}
            </span>
          </div>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 600 }}>Item</th>
            <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>Price</th>
            <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "5px 0" }}>{item.productName}</td>
              <td style={{ textAlign: "right", padding: "5px 0" }}>
                {item.quantity} {item.unitName}
              </td>
              <td style={{ textAlign: "right", padding: "5px 0" }}>{formatCurrency(Number(item.unitPrice))}</td>
              <td style={{ textAlign: "right", padding: "5px 0" }}>{formatCurrency(Number(item.lineTotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
          <span>Subtotal</span>
          <span>{formatCurrency(Number(subtotal))}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", marginTop: 2 }}>
          <span>Discount</span>
          <span>{formatCurrency(Number(discount))}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 15,
            fontWeight: 700,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid #111827",
          }}
        >
          <span>Total</span>
          <span>{formatCurrency(Number(totalAmount))}</span>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 20, marginBottom: 0 }}>Thank you for your business!</p>
    </div>
  );
}
