import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Share2 } from "lucide-react";
import { ReceiptImage, type ReceiptLine } from "./ReceiptImage";

/** Drop-in "Share Image" action for right after a bill is created — renders the same
 * WhatsApp-style receipt used on the invoice detail page off-screen, then shares/downloads
 * it as a PNG on click. Lets a cashier send the customer a picture of the bill immediately,
 * without navigating away to the invoice's own page first. */
export function ShareInvoiceImageButton({
  invoiceNo,
  type,
  createdAt,
  partyName,
  partyPhone,
  businessName,
  logoUrl,
  businessPhone,
  items,
  subtotal,
  discount,
  otherCharges,
  totalAmount,
  status,
  className,
}: {
  invoiceNo: string;
  type: string;
  createdAt: string;
  partyName?: string | null;
  partyPhone?: string | null;
  businessName: string;
  logoUrl?: string | null;
  businessPhone?: string | null;
  items: ReceiptLine[];
  subtotal: string;
  discount: string;
  otherCharges?: { label: string; amount: number }[] | null;
  totalAmount: string;
  status?: "draft" | "confirmed" | "void";
  className?: string;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    if (!receiptRef.current) return;
    setSharing(true);
    setError(null);
    try {
      const dataUrl = await toPng(receiptRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${invoiceNo}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${invoiceNo}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoiceNo}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Image share nahi ho saka.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        className={className ?? "flex items-center gap-1 font-medium hover:underline disabled:opacity-50"}
      >
        <Share2 size={14} />
        {sharing ? "Preparing…" : "Share Image"}
      </button>
      {error && <span className="text-xs font-normal text-red-600 dark:text-red-400">{error}</span>}
      <div style={{ position: "fixed", top: 0, left: -9999, pointerEvents: "none" }} aria-hidden>
        <div ref={receiptRef} className="w-fit">
          <ReceiptImage
            businessName={businessName}
            logoUrl={logoUrl}
            invoiceNo={invoiceNo}
            type={type}
            createdAt={createdAt}
            partyName={partyName}
            partyPhone={partyPhone}
            businessPhone={businessPhone}
            items={items}
            subtotal={subtotal}
            discount={discount}
            otherCharges={otherCharges}
            totalAmount={totalAmount}
            status={status}
          />
        </div>
      </div>
    </>
  );
}
