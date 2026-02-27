import Link from 'next/link';
import { Card } from '@/components/ui';

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
  };
}

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="hover:border-golf-500 transition-colors cursor-pointer">
        <h3 className="font-semibold text-surface-50">{group.name}</h3>
        {group.description && (
          <p className="mt-1 text-sm text-surface-300 line-clamp-2">
            {group.description}
          </p>
        )}
        <p className="mt-2 text-xs text-surface-400">
          {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
        </p>
      </Card>
    </Link>
  );
}
