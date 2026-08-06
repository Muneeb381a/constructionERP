import { useMemo, useRef, useState } from "react";
import { formatCurrency } from "../lib/format";
import type { SalesTrendPoint } from "../lib/api/reports";

const WIDTH = 800;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 24, left: 68 };

export function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const maxValue = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.salesTotal, d.purchasesTotal))),
    [data],
  );

  const xFor = (i: number) => PAD.left + (data.length <= 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
  const yFor = (value: number) => PAD.top + plotHeight - (value / maxValue) * plotHeight;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || data.length === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    data.forEach((_, i) => {
      const d = Math.abs(xFor(i) - px);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  if (data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No invoices in this date range.</p>;
  }

  const salesPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.salesTotal)}`).join(" ");
  const purchasesPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.purchasesTotal)}`).join(" ");
  const salesAreaPath = `${salesPath} L ${xFor(data.length - 1)} ${yFor(0)} L ${xFor(0)} ${yFor(0)} Z`;
  const gridValues = [0, maxValue / 2, maxValue];
  const hovered = hoverIndex != null ? data[hoverIndex] : null;
  const lastIndex = data.length - 1;

  // sparse x-axis labels so dates don't collide — first, last, and a few in between
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  const totalSales = data.reduce((sum, d) => sum + d.salesTotal, 0);
  const totalPurchases = data.reduce((sum, d) => sum + d.purchasesTotal, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
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

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.16} className="text-blue-600 dark:text-blue-400" />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} className="text-blue-600 dark:text-blue-400" />
          </linearGradient>
        </defs>

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
            <text x={PAD.left - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} className="fill-gray-400">
              {v >= 1000 ? `${Math.round(v / 1000)}K` : Math.round(v)}
            </text>
          </g>
        ))}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={xFor(i)} y={HEIGHT - 6} textAnchor="middle" fontSize={10} className="fill-gray-400">
              {d.day.slice(5)}
            </text>
          ) : null,
        )}

        <path d={salesAreaPath} fill="url(#salesAreaFill)" stroke="none" />
        <path d={purchasesPath} fill="none" className="stroke-orange-500 dark:stroke-orange-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={salesPath} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* emphasized endpoint — the most recent day's figures, always visible */}
        <circle cx={xFor(lastIndex)} cy={yFor(data[lastIndex].salesTotal)} r={3.5} className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-gray-900" strokeWidth={1.5} />
        <circle cx={xFor(lastIndex)} cy={yFor(data[lastIndex].purchasesTotal)} r={3.5} className="fill-orange-500 stroke-white dark:fill-orange-400 dark:stroke-gray-900" strokeWidth={1.5} />

        {hoverIndex != null && (
          <>
            <line
              x1={xFor(hoverIndex)}
              y1={PAD.top}
              x2={xFor(hoverIndex)}
              y2={HEIGHT - PAD.bottom}
              className="stroke-gray-300 dark:stroke-gray-700"
              strokeWidth={1}
            />
            <circle cx={xFor(hoverIndex)} cy={yFor(data[hoverIndex].salesTotal)} r={4} className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-gray-900" strokeWidth={2} />
            <circle cx={xFor(hoverIndex)} cy={yFor(data[hoverIndex].purchasesTotal)} r={4} className="fill-orange-500 stroke-white dark:fill-orange-400 dark:stroke-gray-900" strokeWidth={2} />
          </>
        )}
      </svg>

      <div className="mt-2 flex h-10 items-center justify-center">
        {hovered && (
          <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs dark:border-gray-800 dark:bg-gray-800/60">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{hovered.day}</span>
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
