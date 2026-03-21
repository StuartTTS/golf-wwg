'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { closeRegistration, reopenRegistration } from '@/lib/actions/registration';
import { addPlayerToRound } from '@/lib/actions/rounds';

interface RegisteredPlayer {
  id: string;
  displayName: string;
  status: string;
  handicapIndex: number | null;
  isGuest: boolean;
}

interface InvitedPlayer {
  email: string;
  status: string; // 'pending' | 'declined'
  displayName: string | null;
  handicapIndex: number | null;
  userId: string | null;
}

interface AvailableMember {
  userId: string;
  displayName: string;
  handicapIndex: number | null;
  defaultTeeTier: number | null;
}

interface RegistrationCardProps {
  roundId: string;
  registrationStatus: string;
  roundStatus: string;
  defaultTeeBoxId: string;
  registeredPlayers: RegisteredPlayer[];
  invitedPlayers: InvitedPlayer[];
  availableMembers: AvailableMember[];
  courseTeeBoxes: { id: string; tier: number | null }[];
}

function findBestTeeBox(
  defaultTeeTier: number | null,
  courseTeeBoxes: { id: string; tier: number | null }[],
  fallbackId: string
): string {
  if (defaultTeeTier === null || courseTeeBoxes.length === 0) return fallbackId;

  const withTiers = courseTeeBoxes.filter((tb) => tb.tier !== null) as { id: string; tier: number }[];
  if (withTiers.length === 0) return fallbackId;

  let best = withTiers[0];
  let bestDiff = Math.abs(withTiers[0].tier - defaultTeeTier);
  for (const tb of withTiers.slice(1)) {
    const diff = Math.abs(tb.tier - defaultTeeTier);
    if (diff < bestDiff) {
      best = tb;
      bestDiff = diff;
    }
  }
  return best.id;
}

export function RegistrationCard({
  roundId,
  registrationStatus,
  roundStatus,
  defaultTeeBoxId,
  registeredPlayers,
  invitedPlayers,
  availableMembers,
  courseTeeBoxes,
}: RegistrationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (roundStatus !== 'upcoming') return null;

  const isOpen = registrationStatus === 'open';
  const pendingPlayers = invitedPlayers.filter((p) => p.status === 'pending');
  const declinedPlayers = invitedPlayers.filter((p) => p.status === 'declined');

  function handleToggleRegistration() {
    setError(null);
    startTransition(async () => {
      const result = isOpen
        ? await closeRegistration(roundId)
        : await reopenRegistration(roundId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleAddMember() {
    if (!selectedMemberId) return;
    const member = availableMembers.find((m) => m.userId === selectedMemberId);
    if (!member) return;

    const teeBoxId = findBestTeeBox(member.defaultTeeTier, courseTeeBoxes, defaultTeeBoxId);
    setError(null);
    startTransition(async () => {
      const result = await addPlayerToRound(roundId, member.userId, teeBoxId);
      if (result.error) {
        setError(result.error);
      } else {
        setSelectedMemberId('');
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setIsCollapsed((v) => !v)}
          >
            <CardTitle className="text-lg">Registration</CardTitle>
            <Badge variant={isOpen ? 'success' : 'error'}>
              {isOpen ? 'Open' : 'Closed'}
            </Badge>
            <svg
              className={`w-4 h-4 text-surface-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <Button
            variant={isOpen ? 'destructive' : 'primary'}
            size="sm"
            onClick={handleToggleRegistration}
            loading={isPending}
            disabled={isPending}
          >
            {isOpen ? 'Close Registration' : 'Reopen Registration'}
          </Button>
        </div>

        {/* Summary line */}
        <p className="text-sm text-surface-400 mt-1">
          {registeredPlayers.length} registered
          {pendingPlayers.length > 0 && ` • ${pendingPlayers.length} pending`}
          {declinedPlayers.length > 0 && ` • ${declinedPlayers.length} declined`}
        </p>
      </CardHeader>

      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-4">
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Player list */}
          {(registeredPlayers.length > 0 || invitedPlayers.length > 0) && (
            <div className="space-y-1">
              {registeredPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-surface-800/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-surface-100">{player.displayName}</span>
                    {player.isGuest && (
                      <span className="text-xs text-surface-400">(Guest)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {player.handicapIndex !== null && (
                      <span className="text-xs text-surface-400">
                        HCP {player.handicapIndex.toFixed(1)}
                      </span>
                    )}
                    <Badge variant="success">Registered</Badge>
                  </div>
                </div>
              ))}

              {pendingPlayers.map((player) => (
                <div
                  key={player.email}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-surface-800/50"
                >
                  <span className="text-sm text-surface-100">
                    {player.displayName ?? player.email}
                  </span>
                  <div className="flex items-center gap-2">
                    {player.handicapIndex !== null && (
                      <span className="text-xs text-surface-400">
                        HCP {player.handicapIndex.toFixed(1)}
                      </span>
                    )}
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </div>
              ))}

              {declinedPlayers.map((player) => (
                <div
                  key={player.email}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-surface-800/50"
                >
                  <span className="text-sm text-surface-300">
                    {player.displayName ?? player.email}
                  </span>
                  <div className="flex items-center gap-2">
                    {player.handicapIndex !== null && (
                      <span className="text-xs text-surface-400">
                        HCP {player.handicapIndex.toFixed(1)}
                      </span>
                    )}
                    <Badge variant="error">Declined</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {registeredPlayers.length === 0 && invitedPlayers.length === 0 && (
            <p className="text-sm text-surface-400 text-center py-2">
              No players registered yet
            </p>
          )}

          {/* Add group member */}
          {availableMembers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-surface-700">
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                Add group member
              </p>
              <div className="flex gap-2">
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="flex-1 bg-surface-700 text-surface-100 text-sm rounded-golf border border-surface-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-golf-500"
                >
                  <option value="">Select a member...</option>
                  {availableMembers.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName}
                      {member.handicapIndex !== null
                        ? ` (HCP ${member.handicapIndex.toFixed(1)})`
                        : ''}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleAddMember}
                  disabled={!selectedMemberId || isPending}
                  loading={isPending}
                >
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
