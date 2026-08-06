import { useMemo, useState } from "react";
import { formatCurrency } from "../lib/format";
import type { SalesTrendPoint } from "../lib/api/reports";

const WIDTH = 800;
const HEIGHT = 300;
const PAD = { top: 20, right: 16, bottom: 28, left: 60 };
const BAR_RADIUS = 4;
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2; // surface gap between the two bars in a pair

type Group = {
  label: string;
  fullLabel: string;
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  purchasesCount: number;
};

/** Round up to a "clean" axis max (1/2/5 × 10^n) so gridlines read as round numbers
 * instead of whatever the tallest bar happens to be. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0.5) return "";
  const radius = Math.max(0, Math.min(r, w / 2, h));
  const bottom = y + h;
  return `M ${x} ${bottom} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${bottom} Z`;
}

function shortDate(day: string) {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

export function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  // Daily bars stay readable up to ~14 groups; past that, week-bucket so each bar
  // group keeps a sane width instead of shrinking into unreadable slivers.
  const groups = useMemo<Group[]>(() => {
    if (data.length <= 14) {
      return data.map((d) => ({
        label: shortDate(d.day),
        fullLabel: d.day,
        salesTotal: d.salesTotal,
        salesCount: d.salesCount,
        purchasesTotal: d.purchasesTotal,
        purchasesCount: d.purchasesCount,
      }));
    }
    const weeks: Group[] = [];
    for (let i = 0; i < data.length; i += 7) {
      const chunk = data.slice(i, i + 7);
      weeks.push({
        label: shortDate(chunk[0].day),
        fullLabel: chunk.length > 1 ? `${chunk[0].day} – ${chunk[chunk.length - 1].day}` : chunk[0].day,
        salesTotal: chunk.reduce((s, d) => s + d.salesTotal, 0),
        salesCount: chunk.reduce((s, d) => s + d.salesCount, 0),
        purchasesTotal: chunk.reduce((s, d) => s + d.purchasesTotal, 0),
        purchasesCount: chunk.reduce((s, d) => s + d.purchasesCount, 0),
      });
    }
    return weeks;
  }, [data]);

  const isWeekly = data.length > 14;
  const maxRaw = Math.max(1, ...groups.map((g) => Math.max(g.salesTotal, g.purchasesTotal)));
  const axisMax = niceMax(maxRaw);

  const groupWidth = groups.length > 0 ? plotWidth / groups.length : plotWidth;
  const barWidth = Math.max(2, Math.min(MAX_BAR_WIDTH, (groupWidth * 0.62 - BAR_GAP) / 2));
  const yFor = (value: number) => PAD.top + plotHeight - (value / axisMax) * plotHeight;
  const xForGroup = (i: number) => PAD.left + i * groupWidth;

  const totalSales = groups.reduce((s, g) => s + g.salesTotal, 0);
  const totalPurchases = groups.reduce((s, g) => s + g.purchasesTotal, 0);
  const gridValues = [0, axisMax / 2, axisMax];
  const labelEvery = Math.max(1, Math.ceil(groups.length / 7));
  const hovered = hoverIndex != null ? groups[hoverIndex] : null;

  if (data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No invoices in this date range.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 dark:bg-blue-500/10">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span className="text-blue-900 dark:text-blue-300">Sales</span>
            <span className="font-semibold tabular-nums text-blue-900 dark:text-blue-200">{formatCurrency(totalSales)}</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 dark:bg-orange-500/10">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500 dark:bg-orange-400" />
            <span className="text-orange-900 dark:text-orange-300">Purchases</span>
            <span className="font-semibold tabular-nums text-orange-900 dark:text-orange-200">{formatCurrency(totalPurchases)}</span>
          </span>
        </div>
        {isWeekly && <span className="text-xs text-gray-400 dark:text-gray-500">Grouped by week — {groups.length} weeks</span>}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full touch-none" onPointerLeave={() => setHoverIndex(null)}>
        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={yFor(v)}
              x2={WIDTH - PAD.right}
              y2={yFor(v)}
              className="stroke-gray-200 dark:stroke-gray-800"
              strokeWidth={1}
            />
            <text x={PAD.left - 10} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} className="fill-gray-400">
              {v >= 1000 ? `${Math.round(v / 1000)}K` : Math.round(v)}
            </text>
          </g>
        ))}

        {groups.map((g, i) => {
          const gx = xForGroup(i);
          const center = gx + groupWidth / 2;
          const salesX = center - BAR_GAP / 2 - barWidth;
          const purchasesX = center + BAR_GAP / 2;
          const salesH = (g.salesTotal / axisMax) * plotHeight;
          const purchasesH = (g.purchasesTotal / axisMax) * plotHeight;
          const isHovered = hoverIndex === i;

          return (
            <g
              key={i}
              onPointerEnter={() => setHoverIndex(i)}
              onFocus={() => setHoverIndex(i)}
              tabIndex={0}
              role="img"
              aria-label={`${g.fullLabel}: sales ${formatCurrency(g.salesTotal)}, purchases ${formatCurrency(g.purchasesTotal)}`}
              className="outline-none"
            >
              {/* full-height invisible hit target — bars are thin, this is what's easy to hover/focus */}
              <rect x={gx} y={PAD.top} width={groupWidth} height={plotHeight} fill="transparent" />
              <path
                d={roundedTopRectPath(salesX, yFor(g.salesTotal), barWidth, salesH, BAR_RADIUS)}
                className={isHovered ? "fill-blue-700 dark:fill-blue-300" : "fill-blue-600 dark:fill-blue-400"}
              />
              <path
                d={roundedTopRectPath(purchasesX, yFor(g.purchasesTotal), barWidth, purchasesH, BAR_RADIUS)}
                className={isHovered ? "fill-orange-600 dark:fill-orange-300" : "fill-orange-500 dark:fill-orange-400"}
              />
              {isHovered && (
                <rect
                  x={gx + 1}
                  y={PAD.top}
                  width={groupWidth - 2}
                  height={plotHeight}
                  className="fill-gray-900/3 dark:fill-white/4"
                />
              )}
            </g>
          );
        })}

        {groups.map((g, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={xForGroup(i) + groupWidth / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={10} className="fill-gray-400">
              {g.label}
            </text>
          ) : null,
        )}
      </svg>

      <div className="mt-2 flex h-10 items-center justify-center">
        {hovered && (
          <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs dark:border-gray-800 dark:bg-gray-800/60">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{hovered.fullLabel}</span>
            <span className="h-3 w-px bg-gray-300 dark:bg-gray-700" />
            <span className="text-blue-700 dark:text-blue-400">
              {formatCurrency(hovered.salesTotal)} <span className="text-gray-400 dark:text-gray-500">({hovered.salesCount})</span>
            </span>
            <span className="text-orange-700 dark:text-orange-400">
              {formatCurrency(hovered.purchasesTotal)} <span className="text-gray-400 dark:text-gray-500">({hovered.purchasesCount})</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
