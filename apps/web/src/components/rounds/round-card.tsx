import Link from 'next/link';
import { Badge, Card } from '@/components/ui';

interface RoundCardProps {
  round: {
    id: string;
    roundDate: string;
    teeTime: string | null;
    status: string;
    courseName: string;
    playerCount: number;
    scoringMode: string;
  };
}

export function RoundCard({ round }: RoundCardProps) {
  const statusVariant = {
    upcoming: 'info' as const,
    in_progress: 'warning' as const,
    completed: 'success' as const,
  }[round.status] ?? 'default' as const;

  const formattedDate = new Date(round.roundDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link href={`/rounds/${round.id}/scorecard`}>
      <Card className="hover:border-golf-300 transition-colors cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-slate-900">
            {round.courseName}
          </div>
          <Badge variant={statusVariant}>{round.status.replace('_', ' ')}</Badge>
        </div>
        <div className="text-xs text-slate-500">
          {formattedDate}
          {round.teeTime && ` at ${round.teeTime}`}
          {' • '}{round.playerCount} player{round.playerCount !== 1 ? 's' : ''}
          {' • '}{round.scoringMode === 'shared' ? 'Shared scoring' : 'Scorekeeper'}
        </div>
      </Card>
    </Link>
  );
}
