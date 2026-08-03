interface BarChartPoint {
  label: string;
  value: number;
}

export function BarChart({ data }: { data: BarChartPoint[] }) {
  const maxValue = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="space-y-4">
      {data.map((point) => (
        <div key={point.label} className="space-y-2">
          <div className="flex justify-between text-sm font-medium text-on-surface">
            <span>{point.label}</span>
            <span>{point.value}</span>
          </div>
          <div className="h-4 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(point.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
