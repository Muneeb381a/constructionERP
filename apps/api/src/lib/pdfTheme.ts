import { rgb } from "pdf-lib";

// Same construction-brand palette as the WhatsApp receipt/statement images
// (ReceiptImage.tsx / StatementImage.tsx) — the printed PDF a customer or driver
// actually holds should look like the same product, not a different, plainer one.
export const PDF_COLORS = {
  accent: rgb(0.706, 0.325, 0.035), // amber-700 #b45309
  accentSoft: rgb(0.996, 0.953, 0.780), // amber-100 #fef3c7
  ink: rgb(0.11, 0.098, 0.09), // stone-900 #1c1917
  muted: rgb(0.471, 0.443, 0.424), // stone-500 #78716c
  hairline: rgb(0.906, 0.898, 0.894), // stone-200 #e7e5e4
  zebra: rgb(0.98, 0.98, 0.976), // stone-50 #fafaf9
  white: rgb(1, 1, 1),
  danger: rgb(0.863, 0.149, 0.149), // red-600
  dangerSoft: rgb(0.996, 0.949, 0.949), // red-50
};

export const A4: [number, number] = [595.28, 841.89];
export const PAGE_LEFT = 50;
export const PAGE_RIGHT = 545;
export const PAGE_TOP = 792;

/** The 6px accent bar that opens every document, plus the business name/logo block —
 * identical composition to the receipt image's header so paper and screen match. */
export async function drawAccentBar(page: import("pdf-lib").PDFPage) {
  const { height, width } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: PDF_COLORS.accent });
}

/** A filled, rounded-corner-free pill used for a document-type/status label. pdf-lib has
 * no native rounded rect, so this approximates one with a plain filled box — flat corners
 * read fine in print at this size. */
export function drawPill(
  page: import("pdf-lib").PDFPage,
  text: string,
  x: number,
  y: number,
  font: import("pdf-lib").PDFFont,
  options?: { bg?: ReturnType<typeof rgb>; color?: ReturnType<typeof rgb>; size?: number },
) {
  const size = options?.size ?? 9;
  const bg = options?.bg ?? PDF_COLORS.accentSoft;
  const color = options?.color ?? PDF_COLORS.accent;
  const textWidth = font.widthOfTextAtSize(text, size);
  const paddingX = 8;
  const height = size + 8;
  page.drawRectangle({ x, y: y - height + size + 1, width: textWidth + paddingX * 2, height, color: bg });
  page.drawText(text, { x: x + paddingX, y, size, font, color });
  return textWidth + paddingX * 2;
}
