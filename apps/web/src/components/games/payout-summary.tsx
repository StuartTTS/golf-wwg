'use client';

interface Settlement {
  payerId: string;
  payeeId: string;
  amount: number;
  status: string;
}

interface PayoutSummaryProps {
  settlements: Settlement[];
  playerNames: Record<string, string>;
  onMarkSettled?: (payerId: string, payeeId: string) => void;
}

export function PayoutSummary({
  settlements,
  playerNames,
  onMarkSettled,
}: PayoutSummaryProps) {
  const getName = (id: string) => playerNames[id] || id;

  if (settlements.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-surface-400">
        No settlements to display
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-surface-200 mb-3">
        Settlements
      </h4>
      {settlements.map((s, i) => (
        <div
          key={i}
          className={`flex items-center justify-between rounded-lg border p-3 ${
            s.status === 'settled'
              ? 'border-golf-500 bg-golf-900/30'
              : 'border-surface-500 bg-surface-800'
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-surface-100">{getName(s.payerId)}</span>
            <span className="text-surface-400">&#8594;</span>
            <span className="font-medium text-surface-100">{getName(s.payeeId)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-surface-50">
              ${s.amount.toFixed(2)}
            </span>
            {s.status === 'settled' ? (
              <span className="text-xs text-golf-400 font-medium">Settled</span>
            ) : (
              onMarkSettled && (
                <button
                  onClick={() => onMarkSettled(s.payerId, s.payeeId)}
                  className="text-xs text-golf-400 hover:text-golf-300 font-medium"
                >
                  Mark Paid
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
