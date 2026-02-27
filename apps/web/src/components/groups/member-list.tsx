'use client';

import { Badge, Button } from '@/components/ui';
import { Avatar } from '@/components/ui/avatar';

interface Member {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  handicapIndex: number | null;
}

interface MemberListProps {
  members: Member[];
  currentUserId: string;
  isAdmin: boolean;
  onRemove?: (userId: string) => void;
  onToggleRole?: (userId: string, newRole: 'admin' | 'member') => void;
}

export function MemberList({
  members,
  currentUserId,
  isAdmin,
  onRemove,
  onToggleRole,
}: MemberListProps) {
  return (
    <div className="divide-y divide-surface-600">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Avatar name={member.displayName} size="sm" />
            <div>
              <div className="text-sm font-medium text-surface-50">
                {member.displayName}
                {member.userId === currentUserId && (
                  <span className="ml-1 text-surface-400">(you)</span>
                )}
              </div>
              <div className="text-xs text-surface-300">
                {member.email}
                {member.handicapIndex !== null && ` • Hdcp ${member.handicapIndex}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={member.role === 'admin' ? 'info' : 'default'}>
              {member.role}
            </Badge>
            {isAdmin && member.userId !== currentUserId && (
              <div className="flex items-center gap-1">
                {onToggleRole && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onToggleRole(
                        member.userId,
                        member.role === 'admin' ? 'member' : 'admin'
                      )
                    }
                  >
                    {member.role === 'admin' ? 'Demote' : 'Promote'}
                  </Button>
                )}
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(member.userId)}
                    className="text-red-500 hover:text-red-400"
                  >
                    Remove
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
