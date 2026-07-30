import type { PDFDocument, PDFImage } from "pdf-lib";

/**
 * Fetches and embeds the tenant's logo into a pdf-lib document. Tries PNG then JPG since a
 * Cloudinary URL's extension doesn't reliably match its actual encoding. Returns null on any
 * failure (no logo set, network hiccup, unsupported format) — a missing logo should never
 * fail the whole PDF, just render without one.
 */
// Typed locally rather than relying on the ambient global `Response` — its shape can vary
// across TypeScript/@types-node resolutions between environments (e.g. this API's local
// typecheck vs. Vercel's build), and this is the only part of it we actually use.
type FetchResponse = { ok: boolean; arrayBuffer(): Promise<ArrayBuffer> };

export async function embedTenantLogo(pdfDoc: PDFDocument, logoUrl: string | null | undefined): Promise<PDFImage | null> {
  if (!logoUrl) return null;
  try {
    const res = (await fetch(logoUrl)) as unknown as FetchResponse;
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}
