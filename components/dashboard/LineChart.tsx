import type { ReactNode } from "react";

interface LineChartPoint {
  label: string;
  value: number;
}

export function LineChart({ data }: { data: LineChartPoint[] }) {
  const maxValue = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-3 items-end h-44">
        {data.map((point) => (
          <div key={point.label} className="flex flex-col items-center gap-2">
            <div
              className="w-full rounded-full bg-primary"
              style={{ height: `${(point.value / maxValue) * 100}%` }}
            />
            <span className="text-xs font-label-sm text-on-surface-variant text-center">{point.label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm text-on-surface-variant">
        {data.map((point) => (
          <div key={point.label} className="text-center">
            <div className="text-body-md font-medium text-on-surface">{point.value}</div>
            <div>{point.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
