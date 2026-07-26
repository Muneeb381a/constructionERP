import { useMemo, useRef, useState } from "react";
import { formatCurrency } from "../lib/format";
import type { SalesTrendPoint } from "../lib/api/reports";

const WIDTH = 800;
const HEIGHT = 260;
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
  const gridValues = [0, maxValue / 2, maxValue];
  const hovered = hoverIndex != null ? data[hoverIndex] : null;

  // sparse x-axis labels so dates don't collide — first, last, and a few in between
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <span className="inline-block h-0.5 w-4 rounded-full bg-blue-600 dark:bg-blue-400" />
          Sales
        </span>
        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <span className="inline-block h-0.5 w-4 rounded-full bg-orange-500 dark:bg-orange-400" />
          Purchases
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
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

        <path d={purchasesPath} fill="none" className="stroke-orange-500 dark:stroke-orange-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={salesPath} fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

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

      <div className="mt-1 h-9 text-center text-xs text-gray-600 dark:text-gray-400">
        {hovered && (
          <>
            <span className="font-medium text-gray-900 dark:text-gray-100">{hovered.day}</span>
            <br />
            Sales {formatCurrency(hovered.salesTotal)} ({hovered.salesCount}) · Purchases {formatCurrency(hovered.purchasesTotal)} (
            {hovered.purchasesCount})
          </>
        )}
      </div>
    </div>
  );
}
