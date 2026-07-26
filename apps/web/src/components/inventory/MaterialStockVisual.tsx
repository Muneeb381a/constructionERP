import { useId, type ReactElement } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import "./MaterialStockVisual.css";

export type StockStatus = "good" | "warning" | "critical";
export type MaterialKind = "liquid" | "bag" | "brick" | "rod" | "generic";

export const STATUS_META: Record<StockStatus, { label: string; color: string; Icon: typeof AlertTriangle }> = {
  good: { label: "In Stock", color: "#0ca30c", Icon: CheckCircle2 },
  warning: { label: "Low Stock", color: "#fab219", Icon: AlertTriangle },
  critical: { label: "Critical", color: "#d03b3b", Icon: AlertOctagon },
};

/** Category/unit keyword heuristic — no explicit "material type" field exists on products,
 * so the visual metaphor is inferred from the category name (primary) and unit name (fallback). */
export function inferMaterialKind(categoryName: string | null, unitName: string): MaterialKind {
  const cat = (categoryName ?? "").toLowerCase();
  const unit = unitName.toLowerCase();
  if (/brick|block|eent/.test(cat)) return "brick";
  if (/cement|plaster|gypsum/.test(cat) || /bag/.test(unit)) return "bag";
  if (/steel|iron|sariya|rod|rebar|girder|pipe/.test(cat)) return "rod";
  if (/sand|gravel|crush|bajri|aggregate|rait|grit|gitti|dust/.test(cat) || /\bton\b|\bkg\b|cft|cubic/.test(unit)) return "liquid";
  return "generic";
}

export function computeStockLevel(quantity: number, minStock: number, maxStock: number | null) {
  const capacity = maxStock && maxStock > 0 ? maxStock : minStock > 0 ? minStock * 4 : Math.max(quantity, 1) * 1.5;
  const pct = capacity > 0 ? Math.max(0, Math.min(100, (quantity / capacity) * 100)) : 0;
  const ratio = minStock > 0 ? quantity / minStock : quantity > 0 ? Infinity : 0;

  let status: StockStatus;
  if (quantity <= 0) status = "critical";
  else if (ratio < 0.34) status = "critical";
  else if (minStock > 0 && ratio < 1) status = "warning";
  else status = "good";

  const minMarkPct = minStock > 0 ? Math.max(0, Math.min(100, (minStock / capacity) * 100)) : null;

  return { pct, status, capacity, minMarkPct };
}

export function StatusBadge({ status }: { status: StockStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: meta.color, backgroundColor: `${meta.color}1a` }}
    >
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

type ContainerProps = { clipId: string; pct: number; color: string; minMarkPct: number | null };

function WaveCrest({ fillY }: { fillY: number }) {
  return (
    <g transform={`translate(0, ${fillY - 4})`}>
      <g className="mv-wave">
        <path
          d="M -100 6 C -85 0 -65 0 -50 6 C -35 12 -15 12 0 6 C 15 0 35 0 50 6 C 65 12 85 12 100 6 C 115 0 135 0 150 6 L 150 24 L -100 24 Z"
          fill="currentColor"
          opacity="0.55"
        />
      </g>
    </g>
  );
}

function MinLine({ y, pctLabel }: { y: number; pctLabel: string }) {
  return (
    <g>
      <line x1="12" x2="88" y1={y} y2={y} stroke="var(--mv-min-line)" strokeWidth="1.25" strokeDasharray="3 3" />
      <text x="90" y={y + 3} fontSize="7" fill="var(--mv-min-line)">
        {pctLabel}
      </text>
    </g>
  );
}

/** Sand, gravel, and other loose bulk material — reads as a storage silo with a moving fill line. */
function SiloVisual({ clipId, pct, color, minMarkPct }: ContainerProps) {
  const top = 20;
  const bottom = 108;
  const fillY = bottom - ((bottom - top) * pct) / 100;
  return (
    <svg viewBox="0 0 100 120" className="mv-svg" role="img" aria-label={`${Math.round(pct)}% full`}>
      <defs>
        <clipPath id={clipId}>
          <rect x="18" y="18" width="64" height="92" />
        </clipPath>
      </defs>
      <rect x="18" y="18" width="64" height="92" fill="var(--mv-empty)" />
      <g clipPath={`url(#${clipId})`} style={{ color }}>
        <rect x="10" y={fillY} width="80" height={bottom - fillY + 12} fill={color} opacity="0.85" />
        <WaveCrest fillY={fillY} />
      </g>
      <rect x="18" y="18" width="64" height="92" fill="none" stroke="var(--mv-stroke)" strokeWidth="1.75" />
      <ellipse cx="50" cy="18" rx="32" ry="7" fill="var(--mv-cap)" stroke="var(--mv-stroke)" strokeWidth="1.75" />
      <ellipse cx="50" cy="108" rx="32" ry="6" fill="none" stroke="var(--mv-stroke)" strokeWidth="1.25" opacity="0.5" />
      {minMarkPct != null && <MinLine y={bottom - ((bottom - top) * minMarkPct) / 100} pctLabel="min" />}
    </svg>
  );
}

/** Cement, plaster, gypsum — reads as a sack filling from the bottom. */
function BagVisual({ clipId, pct, color, minMarkPct }: ContainerProps) {
  const top = 30;
  const bottom = 114;
  const fillY = bottom - ((bottom - top) * pct) / 100;
  const bagPath = "M 25 26 L 75 26 L 82 108 Q 82 114 76 114 L 24 114 Q 18 114 18 108 Z";
  return (
    <svg viewBox="0 0 100 120" className="mv-svg" role="img" aria-label={`${Math.round(pct)}% full`}>
      <defs>
        <clipPath id={clipId}>
          <path d={bagPath} />
        </clipPath>
      </defs>
      <path d={bagPath} fill="var(--mv-empty)" />
      <g clipPath={`url(#${clipId})`} style={{ color }}>
        <rect x="10" y={fillY} width="80" height={bottom - fillY + 12} fill={color} opacity="0.85" />
        <WaveCrest fillY={fillY} />
      </g>
      <path d={bagPath} fill="none" stroke="var(--mv-stroke)" strokeWidth="1.75" />
      <rect x="22" y="14" width="56" height="13" rx="2" fill="var(--mv-cap)" stroke="var(--mv-stroke)" strokeWidth="1.5" />
      <line x1="30" y1="14" x2="26" y2="6" stroke="var(--mv-stroke)" strokeWidth="1.25" />
      <line x1="70" y1="14" x2="74" y2="6" stroke="var(--mv-stroke)" strokeWidth="1.25" />
      {minMarkPct != null && <MinLine y={bottom - ((bottom - top) * minMarkPct) / 100} pctLabel="min" />}
    </svg>
  );
}

/** Fallback for anything without a dedicated metaphor — a clean capsule gauge. */
function CapsuleVisual({ clipId, pct, color, minMarkPct }: ContainerProps) {
  const top = 10;
  const bottom = 110;
  const fillY = bottom - ((bottom - top) * pct) / 100;
  return (
    <svg viewBox="0 0 100 120" className="mv-svg" role="img" aria-label={`${Math.round(pct)}% full`}>
      <defs>
        <clipPath id={clipId}>
          <rect x="20" y="8" width="60" height="104" rx="18" />
        </clipPath>
      </defs>
      <rect x="20" y="8" width="60" height="104" rx="18" fill="var(--mv-empty)" />
      <g clipPath={`url(#${clipId})`} style={{ color }}>
        <rect x="10" y={fillY} width="80" height={bottom - fillY + 12} fill={color} opacity="0.85" />
        <WaveCrest fillY={fillY} />
      </g>
      <rect x="20" y="8" width="60" height="104" rx="18" fill="none" stroke="var(--mv-stroke)" strokeWidth="1.75" />
      {minMarkPct != null && <MinLine y={bottom - ((bottom - top) * minMarkPct) / 100} pctLabel="min" />}
    </svg>
  );
}

/** Bricks/blocks — a pictogram wall filling from the ground up, one brick at a time. */
function BrickPictogram({ pct, color }: { pct: number; color: string }) {
  const cols = 4;
  const rows = 5;
  const total = cols * rows;
  const filled = Math.round((pct / 100) * total);
  const bw = 20;
  const bh = 18;
  const gap = 2;
  const startX = 6;
  const startY = 8;
  const bricks: ReactElement[] = [];
  let idx = 0;
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const isFilled = idx < filled;
      const x = startX + c * (bw + gap);
      const y = startY + r * (bh + gap);
      bricks.push(
        <rect
          key={`${r}-${c}`}
          x={x}
          y={y}
          width={bw}
          height={bh}
          rx={1.5}
          fill={isFilled ? color : "var(--mv-empty)"}
          stroke="var(--mv-stroke)"
          strokeWidth={isFilled ? 0 : 1}
          opacity={isFilled ? 0.9 : 0.55}
          className={isFilled ? "mv-brick-in" : undefined}
          style={isFilled ? { animationDelay: `${idx * 20}ms` } : undefined}
        />,
      );
      idx++;
    }
  }
  return (
    <svg viewBox="0 0 100 120" className="mv-svg" role="img" aria-label={`${Math.round(pct)}% full`}>
      {bricks}
    </svg>
  );
}

/** Steel/rebar/pipe — a pictogram of stacked bars, filling from the bottom of the pile. */
function RodPictogram({ pct, color }: { pct: number; color: string }) {
  const total = 8;
  const filled = Math.round((pct / 100) * total);
  const barH = 10;
  const gap = 3;
  const startY = 14;
  const bars: ReactElement[] = [];
  for (let i = 0; i < total; i++) {
    const rowFromBottom = total - 1 - i;
    const isFilled = rowFromBottom < filled;
    const y = startY + i * (barH + gap);
    const inset = (i % 2) * 4;
    bars.push(
      <rect
        key={i}
        x={10 + inset}
        y={y}
        width={80 - inset * 2}
        height={barH}
        rx={barH / 2}
        fill={isFilled ? color : "var(--mv-empty)"}
        stroke="var(--mv-stroke)"
        strokeWidth={isFilled ? 0 : 1}
        opacity={isFilled ? 0.9 : 0.55}
        className={isFilled ? "mv-rod-in" : undefined}
        style={isFilled ? { animationDelay: `${rowFromBottom * 30}ms` } : undefined}
      />,
    );
  }
  return (
    <svg viewBox="0 0 100 120" className="mv-svg" role="img" aria-label={`${Math.round(pct)}% full`}>
      {bars}
    </svg>
  );
}

export function MaterialStockVisual({
  quantity,
  unitName,
  minStock,
  maxStock,
  categoryName,
}: {
  quantity: number;
  unitName: string;
  minStock: number;
  maxStock: number | null;
  categoryName: string | null;
}) {
  const uid = useId();
  const kind = inferMaterialKind(categoryName, unitName);
  const { pct, status, minMarkPct } = computeStockLevel(quantity, minStock, maxStock);
  const color = STATUS_META[status].color;
  const clipId = `mv-clip-${uid.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="mv-root">
      {kind === "brick" ? (
        <BrickPictogram pct={pct} color={color} />
      ) : kind === "rod" ? (
        <RodPictogram pct={pct} color={color} />
      ) : kind === "liquid" ? (
        <SiloVisual clipId={clipId} pct={pct} color={color} minMarkPct={minMarkPct} />
      ) : kind === "bag" ? (
        <BagVisual clipId={clipId} pct={pct} color={color} minMarkPct={minMarkPct} />
      ) : (
        <CapsuleVisual clipId={clipId} pct={pct} color={color} minMarkPct={minMarkPct} />
      )}
    </div>
  );
}
