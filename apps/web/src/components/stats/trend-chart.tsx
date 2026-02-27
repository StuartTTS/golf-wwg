'use client';

interface TrendChartProps {
  data: { label: string; value: number }[];
  title: string;
  color?: string;
  height?: number;
}

/**
 * Simple SVG-based trend chart (no external dependencies).
 * Renders a line chart showing values over time.
 */
export function TrendChart({
  data,
  title,
  color = '#22c55e',
  height = 200,
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-surface-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const width = 600;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const xScale = (i: number) =>
    padding.left + (i / (data.length - 1 || 1)) * chartWidth;
  const yScale = (v: number) =>
    padding.top + chartHeight - ((v - minVal) / range) * chartHeight;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ');

  return (
    <div>
      <h4 className="text-sm font-semibold text-surface-200 mb-2">{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padding.top + chartHeight * (1 - pct);
          const val = (minVal + range * pct).toFixed(1);
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#1e2a24"
                strokeWidth={1}
              />
              <text
                x={padding.left - 5}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-surface-400"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.value)}
            r={3}
            fill={color}
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show every Nth label to avoid crowding
          const showEvery = Math.max(1, Math.floor(data.length / 8));
          if (i % showEvery !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={xScale(i)}
              y={height - 5}
              textAnchor="middle"
              className="text-[9px] fill-surface-400"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
