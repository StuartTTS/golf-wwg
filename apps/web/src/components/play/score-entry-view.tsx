'use client';

import { useMemo, type ReactNode } from 'react';
import {
  type PlayRound,
  type PlayScore,
  type PlayHole,
  type PlayPlayer,
  type GreenMiss,
  strokesReceivedOnHole,
  scoreToParClasses,
} from './shared';

interface ScoreEntryViewProps {
  round: PlayRound;
  scores: PlayScore[];
  holeIndex: number;
  setHoleIndex: (i: number) => void;
  updateScore: (
    playerId: string,
    holeNumber: number,
    patch: Partial<PlayScore>
  ) => void;
  saving: boolean;
}

/** GIR auto-derivation: on the green in regulation = reached green with 2 strokes to spare. */
function autoGir(
  strokes: number | null,
  putts: number | null,
  par: number,
  greenMiss: GreenMiss | null,
  currentGir: boolean | null
): boolean | null {
  if (greenMiss != null) return false; // explicit miss wins
  if (strokes == null || putts == null) return currentGir;
  return strokes - putts <= par - 2;
}

export function ScoreEntryView({
  round,
  scores,
  holeIndex,
  setHoleIndex,
  updateScore,
  saving,
}: ScoreEntryViewProps) {
  const hasFlights = round.players.some((p) => p.teeTimeGroupId !== null);

  const flightPlayers = useMemo<PlayPlayer[]>(() => {
    if (!hasFlights || !round.currentUserGroupId) return round.players;
    return round.players.filter(
      (p) => p.teeTimeGroupId === round.currentUserGroupId
    );
  }, [hasFlights, round.currentUserGroupId, round.players]);

  const holesFor = (teeBoxId: string): PlayHole[] =>
    round.holesByTeeBox[teeBoxId] ?? round.defaultHoles ?? [];

  const currentUser = round.players.find((p) => p.id === round.currentUserId);
  const layoutHoles = holesFor(currentUser?.teeBoxId ?? '') ?? round.defaultHoles;
  const hole = layoutHoles[holeIndex];

  // Designated-scorer gate. A player can ALWAYS enter/track their own card — a
  // flight scorer only owns everyone *else's* official card (see
  // docs/round-confirmation-lock.md). So "scorer" access is per-player, not global.
  const flightGroup = round.teeGroups.find(
    (g) => g.id === round.currentUserGroupId
  );
  const designatedScorer = flightGroup?.scorerId ?? null;
  // I'm the scorer if designated, or if no one is (shared self-scoring).
  const isScorer = !designatedScorer || designatedScorer === round.currentUserId;
  const someoneElseScoring =
    !!designatedScorer && designatedScorer !== round.currentUserId;
  const scorerName = designatedScorer
    ? round.players.find((p) => p.id === designatedScorer)?.displayName ?? null
    : null;

  const getScore = (playerId: string, holeNumber: number): PlayScore | null =>
    scores.find(
      (s) => s.playerId === playerId && s.holeNumber === holeNumber
    ) ?? null;

  if (!hole) {
    return (
      <div className="p-8 text-center text-surface-300">
        No holes are configured for this round yet.
      </div>
    );
  }

  const parFor = (player: PlayPlayer) =>
    holesFor(player.teeBoxId).find((h) => h.number === hole.number)?.par ??
    hole.par;
  const strokeIndexFor = (player: PlayPlayer) =>
    holesFor(player.teeBoxId).find((h) => h.number === hole.number)
      ?.strokeIndex ?? hole.strokeIndex;

  return (
    <div className="space-y-4">
      {/* Hole navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setHoleIndex(Math.max(0, holeIndex - 1))}
          disabled={holeIndex === 0}
          className="p-2 rounded-lg hover:bg-surface-700 disabled:opacity-30 transition-colors"
          aria-label="Previous hole"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-2xl font-bold text-surface-50">Hole {hole.number}</p>
          <p className="text-xs text-surface-300">
            Par {hole.par} · {hole.yardage} yds · SI {hole.strokeIndex}
          </p>
        </div>
        <button
          onClick={() =>
            setHoleIndex(Math.min(layoutHoles.length - 1, holeIndex + 1))
          }
          disabled={holeIndex === layoutHoles.length - 1}
          className="p-2 rounded-lg hover:bg-surface-700 disabled:opacity-30 transition-colors"
          aria-label="Next hole"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1 flex-wrap">
        {layoutHoles.map((h, i) => (
          <div
            key={h.number}
            className={`h-1.5 rounded-full transition-all ${
              i === holeIndex
                ? 'w-4 bg-golf-500'
                : i < holeIndex
                  ? 'w-1.5 bg-golf-700'
                  : 'w-1.5 bg-surface-600'
            }`}
          />
        ))}
      </div>

      {someoneElseScoring && (
        <div className="rounded-lg bg-surface-700/60 border border-surface-600 px-4 py-3 text-sm text-surface-200">
          {scorerName ?? 'A designated scorer'} is keeping the group&apos;s
          official card. You can still enter and track your own card below.
        </div>
      )}

      {/* Player cards */}
      <div className="space-y-3">
        {flightPlayers.map((player) => {
          const score = getScore(player.id, hole.number);
          const par = parFor(player);
          const isMe = player.id === round.currentUserId;
          // Scorer edits everyone; anyone can always edit their own card.
          const canEditPlayer = isScorer || isMe;
          const received = strokesReceivedOnHole(
            player.playingHandicap,
            strokeIndexFor(player)
          );

          return (
            <div
              key={player.id}
              className={`rounded-xl border p-4 ${
                isMe
                  ? 'bg-surface-800 border-golf-500/40'
                  : 'bg-surface-800 border-surface-600'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-surface-50">
                    {player.displayName}
                  </span>
                  {isMe && (
                    <span className="text-[10px] font-semibold text-golf-400 border border-golf-500/40 rounded px-1.5 py-0.5">
                      YOU
                    </span>
                  )}
                  {received > 0 && (
                    <span className="flex gap-0.5">
                      {Array.from({ length: received }, (_, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                      ))}
                    </span>
                  )}
                </div>
                <span
                  className={`text-2xl font-bold tabular-nums px-2 rounded ${scoreToParClasses(
                    score?.strokes ?? null,
                    par
                  )}`}
                >
                  {score?.strokes ?? '-'}
                </span>
              </div>

              {/* Strokes quick buttons */}
              <StrokeButtons
                par={par}
                value={score?.strokes ?? null}
                disabled={!canEditPlayer}
                onSet={(strokes) =>
                  updateScore(player.id, hole.number, {
                    strokes,
                    gir: autoGir(
                      strokes,
                      score?.putts ?? null,
                      par,
                      score?.greenMiss ?? null,
                      score?.gir ?? null
                    ),
                  })
                }
              />

              {/* Full stat grid — ONLY on the current user's own card */}
              {isMe && score?.strokes != null && (
                <OwnStatPanel
                  par={par}
                  score={score}
                  onPatch={(patch) => updateScore(player.id, hole.number, patch)}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-surface-500 h-4">
        {saving ? 'Saving…' : 'Scores save automatically'}
      </p>
    </div>
  );
}

/* ---------------- Strokes ---------------- */

function StrokeButtons({
  par,
  value,
  disabled,
  onSet,
}: {
  par: number;
  value: number | null;
  disabled: boolean;
  onSet: (strokes: number) => void;
}) {
  const quick = [par - 2, par - 1, par, par + 1, par + 2, par + 3].filter(
    (s) => s >= 1
  );
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {quick.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            disabled={disabled}
            onClick={() => onSet(s)}
            className={`py-2.5 rounded-lg text-base font-bold transition-colors disabled:opacity-40 ${
              active
                ? 'bg-golf-600 text-white'
                : 'bg-surface-700 text-surface-100 hover:bg-surface-600'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Own-card stat panel ---------------- */

function OwnStatPanel({
  par,
  score,
  onPatch,
}: {
  par: number;
  score: PlayScore;
  onPatch: (patch: Partial<PlayScore>) => void;
}) {
  const missedGreen = score.gir === false;

  return (
    <div className="mt-4 pt-4 border-t border-surface-700 space-y-4">
      {/* Putts */}
      <StatRow label="Putts">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((p) => (
            <Chip
              key={p}
              active={score.putts === p}
              onClick={() =>
                onPatch({
                  putts: p,
                  gir: recomputeGir(score.strokes, p, par, score.greenMiss),
                })
              }
            >
              {p}
            </Chip>
          ))}
          <button
            onClick={() =>
              onPatch({
                putts: (score.putts ?? 0) + 1,
                gir: recomputeGir(
                  score.strokes,
                  (score.putts ?? 0) + 1,
                  par,
                  score.greenMiss
                ),
              })
            }
            className="px-3 rounded-lg bg-surface-700 text-surface-200 hover:bg-surface-600 text-sm"
          >
            +
          </button>
        </div>
      </StatRow>

      {/* Fairway — only on par 4/5 */}
      {par >= 4 && (
        <StatRow label="Fairway">
          <div className="flex gap-1.5">
            <Chip
              active={score.fairwayHit === false && score.fairwayMiss === 'left'}
              onClick={() =>
                onPatch({ fairwayHit: false, fairwayMiss: 'left' })
              }
            >
              ◀ Left
            </Chip>
            <Chip
              active={score.fairwayHit === true}
              onClick={() => onPatch({ fairwayHit: true, fairwayMiss: null })}
            >
              ✓ Hit
            </Chip>
            <Chip
              active={score.fairwayHit === false && score.fairwayMiss === 'right'}
              onClick={() =>
                onPatch({ fairwayHit: false, fairwayMiss: 'right' })
              }
            >
              Right ▶
            </Chip>
          </div>
        </StatRow>
      )}

      {/* Green — GIR + 4-direction miss */}
      <StatRow label="Green">
        <div className="grid grid-cols-3 gap-1.5 w-full max-w-[220px]">
          <span />
          <GreenChip
            active={score.greenMiss === 'long'}
            onClick={() => setGreen(onPatch, 'long', score)}
          >
            Long
          </GreenChip>
          <span />
          <GreenChip
            active={score.greenMiss === 'left'}
            onClick={() => setGreen(onPatch, 'left', score)}
          >
            Left
          </GreenChip>
          <GreenChip
            active={score.gir === true}
            highlight
            onClick={() =>
              onPatch({ gir: true, greenMiss: null })
            }
          >
            GIR
          </GreenChip>
          <GreenChip
            active={score.greenMiss === 'right'}
            onClick={() => setGreen(onPatch, 'right', score)}
          >
            Right
          </GreenChip>
          <span />
          <GreenChip
            active={score.greenMiss === 'short'}
            onClick={() => setGreen(onPatch, 'short', score)}
          >
            Short
          </GreenChip>
          <span />
        </div>
      </StatRow>

      {/* Up & down — relevant when the green was missed */}
      {missedGreen && (
        <StatRow label="Up & down">
          <div className="flex gap-1.5">
            <Chip
              active={score.upAndDown === true}
              onClick={() => onPatch({ upAndDown: true })}
            >
              ✓ Saved
            </Chip>
            <Chip
              active={score.upAndDown === false}
              onClick={() => onPatch({ upAndDown: false })}
            >
              No
            </Chip>
          </div>
        </StatRow>
      )}

      {/* Bunkers */}
      <StatRow label="Bunker">
        <div className="flex gap-1.5">
          <Chip
            active={score.fairwayBunker === true}
            onClick={() =>
              onPatch({ fairwayBunker: !(score.fairwayBunker === true) })
            }
          >
            Fairway
          </Chip>
          <Chip
            active={score.greensideBunker === true}
            onClick={() =>
              onPatch({ greensideBunker: !(score.greensideBunker === true) })
            }
          >
            Greenside
          </Chip>
        </div>
      </StatRow>

      {/* Penalties */}
      <StatRow label="Penalties">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              onPatch({ penalties: Math.max(0, (score.penalties ?? 0) - 1) })
            }
            className="w-9 h-9 rounded-lg bg-surface-700 text-surface-200 hover:bg-surface-600 text-lg font-bold"
          >
            −
          </button>
          <span className="w-6 text-center text-lg font-bold tabular-nums text-surface-50">
            {score.penalties ?? 0}
          </span>
          <button
            onClick={() => onPatch({ penalties: (score.penalties ?? 0) + 1 })}
            className="w-9 h-9 rounded-lg bg-surface-700 text-surface-200 hover:bg-surface-600 text-lg font-bold"
          >
            +
          </button>
        </div>
      </StatRow>
    </div>
  );
}

function setGreen(
  onPatch: (patch: Partial<PlayScore>) => void,
  dir: GreenMiss,
  score: PlayScore
) {
  // Toggle off if tapping the active direction.
  if (score.greenMiss === dir) {
    onPatch({ greenMiss: null, gir: null });
  } else {
    onPatch({ gir: false, greenMiss: dir });
  }
}

function recomputeGir(
  strokes: number | null,
  putts: number | null,
  par: number,
  greenMiss: GreenMiss | null
): boolean | null {
  if (greenMiss != null) return false;
  if (strokes == null || putts == null) return null;
  return strokes - putts <= par - 2;
}

/* ---------------- Small UI atoms ---------------- */

function StatRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium text-surface-300 pt-2 w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-w-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-golf-600 text-white'
          : 'bg-surface-700 text-surface-200 hover:bg-surface-600'
      }`}
    >
      {children}
    </button>
  );
}

function GreenChip({
  active,
  highlight,
  onClick,
  children,
}: {
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-lg text-xs font-medium transition-colors ${
        active
          ? highlight
            ? 'bg-golf-500 text-white'
            : 'bg-score-bogey/30 text-score-bogey ring-1 ring-score-bogey/50'
          : highlight
            ? 'bg-surface-700 text-golf-300 ring-1 ring-golf-600/40 hover:bg-surface-600'
            : 'bg-surface-700 text-surface-200 hover:bg-surface-600'
      }`}
    >
      {children}
    </button>
  );
}
