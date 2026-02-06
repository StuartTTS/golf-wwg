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
      <div className="text-center py-6 text-sm text-slate-500">
        No settlements to display
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">
        Settlements
      </h4>
      {settlements.map((s, i) => (
        <div
          key={i}
          className={`flex items-center justify-between rounded-lg border p-3 ${
            s.status === 'settled'
              ? 'border-green-200 bg-green-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{getName(s.payerId)}</span>
            <span className="text-slate-400">&#8594;</span>
            <span className="font-medium">{getName(s.payeeId)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900">
              ${s.amount.toFixed(2)}
            </span>
            {s.status === 'settled' ? (
              <span className="text-xs text-green-600 font-medium">Settled</span>
            ) : (
              onMarkSettled && (
                <button
                  onClick={() => onMarkSettled(s.payerId, s.payeeId)}
                  className="text-xs text-golf-600 hover:text-golf-700 font-medium"
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
