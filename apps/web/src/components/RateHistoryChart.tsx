import { useMemo, useRef, useState } from "react";

type RatePoint = { rate: string; effectiveFrom: string };

const WIDTH = 480;
const HEIGHT = 200;
const PAD = { top: 16, right: 16, bottom: 8, left: 52 };

export function RateHistoryChart({ data }: { data: RatePoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = useMemo(
    () => data.map((d) => ({ rate: Number(d.rate), date: new Date(d.effectiveFrom) })),
    [data],
  );

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const minRate = points.length ? Math.min(...points.map((p) => p.rate)) : 0;
  const maxRate = points.length ? Math.max(...points.map((p) => p.rate)) : 1;
  const rateRange = maxRate - minRate || 1;

  const xFor = (i: number) => PAD.left + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const yFor = (rate: number) => PAD.top + plotHeight - ((rate - minRate) / rateRange) * plotHeight;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(xFor(i) - px);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  if (points.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No rate history yet.</p>;
  }

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.rate)}`).join(" ");
  const gridValues = [minRate, (minRate + maxRate) / 2, maxRate];
  const hovered = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div>
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
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        ))}

        <path
          d={linePath}
          fill="none"
          className="stroke-blue-600 dark:stroke-blue-400"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* end-point marker — always visible so the latest rate is direct-labeled */}
        <circle
          cx={xFor(points.length - 1)}
          cy={yFor(points[points.length - 1].rate)}
          r={4}
          className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-gray-900"
          strokeWidth={2}
        />

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
            <circle
              cx={xFor(hoverIndex)}
              cy={yFor(points[hoverIndex].rate)}
              r={4}
              className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-gray-900"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      <div className="mt-1 h-5 text-center text-xs text-gray-600 dark:text-gray-400">
        {hovered && (
          <>
            {hovered.date.toLocaleDateString()} —{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">Rs {hovered.rate.toLocaleString()}</span>
          </>
        )}
      </div>

      <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-gray-800/90 dark:text-gray-400">
            <tr>
              <th className="px-3 py-1.5 font-medium">Date</th>
              <th className="px-3 py-1.5 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {[...points].reverse().map((p, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{p.date.toLocaleDateString()}</td>
                <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">Rs {p.rate.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
