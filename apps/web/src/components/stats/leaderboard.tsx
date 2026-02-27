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
      <h4 className="text-sm font-semibold text-surface-200 mb-3">{title}</h4>
      <div className="space-y-1">
        {sorted.map((entry, i) => (
          <div
            key={entry.playerId}
            className={`flex items-center justify-between rounded-md px-3 py-2 ${
              i === 0
                ? 'bg-gold-500/20 border border-gold-500/40'
                : i === 1
                  ? 'bg-surface-700 border border-surface-500'
                  : i === 2
                    ? 'bg-amber-700/20 border border-amber-700/40'
                    : 'bg-surface-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold w-6 ${
                i === 0 ? 'text-gold-500' : i === 1 ? 'text-surface-300' : i === 2 ? 'text-amber-700' : 'text-surface-400'
              }`}>
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-medium text-surface-50">
                  {entry.displayName}
                </div>
                {entry.secondaryValue && (
                  <div className="text-xs text-surface-400">
                    {entry.secondaryValue}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-surface-50">
                {typeof entry.value === 'number' && !Number.isInteger(entry.value)
                  ? entry.value.toFixed(1)
                  : entry.value}
              </div>
              <div className="text-[10px] text-surface-400">{valueLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
