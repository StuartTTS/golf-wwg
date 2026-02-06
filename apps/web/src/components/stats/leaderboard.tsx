interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  value: number;
  secondaryValue?: string;
}

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
  valueLabel: string;
  lowerIsBetter?: boolean;
}

export function Leaderboard({
  title,
  entries,
  valueLabel,
  lowerIsBetter = true,
}: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) =>
    lowerIsBetter ? a.value - b.value : b.value - a.value
  );

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-3">{title}</h4>
      <div className="space-y-1">
        {sorted.map((entry, i) => (
          <div
            key={entry.playerId}
            className={`flex items-center justify-between rounded-md px-3 py-2 ${
              i === 0
                ? 'bg-yellow-50 border border-yellow-200'
                : i === 1
                  ? 'bg-slate-50 border border-slate-200'
                  : i === 2
                    ? 'bg-orange-50 border border-orange-200'
                    : 'bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-400 w-6">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {entry.displayName}
                </div>
                {entry.secondaryValue && (
                  <div className="text-xs text-slate-500">
                    {entry.secondaryValue}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">
                {typeof entry.value === 'number' && !Number.isInteger(entry.value)
                  ? entry.value.toFixed(1)
                  : entry.value}
              </div>
              <div className="text-[10px] text-slate-400">{valueLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
