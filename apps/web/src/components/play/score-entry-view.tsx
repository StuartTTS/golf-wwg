'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  type PlayRound,
  type PlayScore,
  type PlayHole,
  type PlayPlayer,
  type GreenMiss,
  strokesReceivedOnHole,
  scoreToParClasses,
  groupScorerId,
} from './shared';
import { ScorerControl } from './scorer-control';

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
  /** Player ids whose card is confirmed/locked — inputs are read-only. */
  lockedPlayerIds: Set<string>;
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
  lockedPlayerIds,
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

  // Anyone in the foursome can enter anyone's score (same-foursome scoring is
  // RLS-allowed), so there's no "take over" step — whoever has the phone just
  // scores. `scorer` is only the soft "who's keeping the card" marker for the
  // control below and the group-confirm. null = nobody has claimed it.
  const scorer = groupScorerId(round);
  const iAmScorer = scorer === round.currentUserId;
  const scorerName = scorer
    ? round.players.find((p) => p.id === scorer)?.displayName ?? null
    : null;
  const isGroupRound = round.players.length > 1;

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
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setHoleIndex(Math.max(0, holeIndex - 1))}
          disabled={holeIndex === 0}
          className="flex items-center gap-1 h-10 pl-2 pr-3 rounded-full bg-surface-800 border border-surface-600 text-sm font-medium text-surface-100 hover:bg-surface-700 disabled:opacity-25 transition-colors"
          aria-label="Previous hole"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>
        <div className="text-center">
          <p className="text-2xl font-bold text-surface-50 leading-none">Hole {hole.number}</p>
          <p className="text-xs text-surface-300 mt-0.5">
            Par {hole.par} · {hole.yardage} yds · SI {hole.strokeIndex}
          </p>
        </div>
        <button
          onClick={() =>
            setHoleIndex(Math.min(layoutHoles.length - 1, holeIndex + 1))
          }
          disabled={holeIndex === layoutHoles.length - 1}
          className="flex items-center gap-1 h-10 pl-3 pr-2 rounded-full bg-golf-600 text-sm font-semibold text-white hover:bg-golf-500 disabled:opacity-25 disabled:bg-surface-700 disabled:text-surface-300 transition-colors"
          aria-label="Next hole"
        >
          Next
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {isGroupRound && (
        <ScorerControl
          roundId={round.id}
          scorerId={scorer}
          scorerName={scorerName}
          isMe={iAmScorer}
        />
      )}

      {/* Player cards */}
      <div className="space-y-3">
        {flightPlayers.map((player) => {
          const score = getScore(player.id, hole.number);
          const par = parFor(player);
          const isMe = player.id === round.currentUserId;
          const locked = lockedPlayerIds.has(player.id);
          // Mirror the scores RLS so the UI never offers an edit that will
          // silently fail: you can enter a card if it's your own, you're the
          // group's scorer, the round is shared (casual), or you're both in the
          // same foursome. Any foursome member can score any member — no
          // designated-scorer step. A confirmed/locked card is off-limits.
          const inMyFoursome =
            player.teeTimeGroupId != null &&
            player.teeTimeGroupId === round.currentUserGroupId;
          const canEditPlayer =
            !locked &&
            (isMe || iAmScorer || round.scoringMode === 'shared' || inMyFoursome);
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
                  {locked && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-surface-300 border border-surface-500 rounded px-1.5 py-0.5">
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      LOCKED
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
                  className={`text-2xl font-bold tabular-nums px-2 rounded ${
                    score?.pickup
                      ? 'text-surface-300'
                      : scoreToParClasses(score?.strokes ?? null, par)
                  }`}
                >
                  {score?.pickup ? 'X' : (score?.strokes ?? '-')}
                </span>
              </div>

              {/* Strokes quick buttons. For everyone but yourself we record the
                  score ONLY — no stats (not even auto-GIR); shot stats belong to
                  each player's own card. Your own card gets score + full stats. */}
              <StrokeButtons
                par={par}
                value={score?.strokes ?? null}
                disabled={!canEditPlayer}
                onSet={(strokes) =>
                  updateScore(
                    player.id,
                    hole.number,
                    isMe
                      ? {
                          strokes,
                          pickup: false,
                          gir: autoGir(
                            strokes,
                            score?.putts ?? null,
                            par,
                            score?.greenMiss ?? null,
                            score?.gir ?? null
                          ),
                        }
                      : { strokes, pickup: false }
                  )
                }
              />

              {/* Pick up ("X"): out of the hole, no stroke value — still counts as
                  recorded for the round-complete gate (best ball). */}
              {canEditPlayer && (
                <button
                  type="button"
                  onClick={() =>
                    updateScore(player.id, hole.number, {
                      strokes: null,
                      pickup: !score?.pickup,
                    })
                  }
                  className={`mt-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    score?.pickup
                      ? 'bg-surface-500 text-white'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  }`}
                >
                  {score?.pickup ? 'Picked up (X) — tap to undo' : 'Pick up (X)'}
                </button>
              )}

              {/* Other players: score only — makes the foursome-scoring rule explicit. */}
              {!isMe && !locked && (
                <p className="mt-2 text-center text-[11px] text-surface-400">
                  Score only · stats stay on {player.displayName.split(' ')[0]}&apos;s own card
                </p>
              )}

              {isMe && score?.strokes != null && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-surface-600" />
                  <span className="whitespace-nowrap text-[11px] font-medium text-surface-300">
                    {locked
                      ? 'Card confirmed — unlock to edit'
                      : saving
                        ? 'Saving…'
                        : 'Scores save automatically'}
                  </span>
                  <span className="h-px flex-1 bg-surface-600" />
                </div>
              )}

              {/* Full stat grid — ONLY on the current user's own card */}
              {isMe && score?.strokes != null && (
                <div className={locked ? 'opacity-60 pointer-events-none' : ''}>
                  <OwnStatPanel
                    par={par}
                    score={score}
                    onPatch={(patch) => updateScore(player.id, hole.number, patch)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {holeIndex === layoutHoles.length - 1 && (
        <p className="text-center text-sm text-surface-400">
          Last hole — tap <span className="text-golf-400 font-medium">Confirm round</span> when you&apos;re done.
        </p>
      )}
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
  // A 4-number window that defaults to par-2..par+1 and "rolls" to keep the
  // current value in view — tapping + past the right edge scrolls the window
  // right (2,3,4,5 → 3,4,5,6 with 6 selected); − rolls it back.
  // Default window: par 4/5 show birdie·par·bogey·double (par-1..par+2);
  // par 3 keeps ace·birdie·par·bogey (par-2..par+1) so a hole-in-one is one tap.
  const base = par >= 4 ? par + 2 : par + 1;
  let right = value == null || value <= base ? base : value;
  if (value != null && value < right - 3) right = value + 3; // rare low scores
  const start = Math.max(1, right - 3);
  const nums = [start, start + 1, start + 2, start + 3];
  const showMinus = start > 1;
  const btn =
    'flex-1 py-2.5 rounded-lg text-base font-bold transition-colors disabled:opacity-40';
  const plain = 'bg-surface-700 text-surface-200 hover:bg-surface-600';
  return (
    <div className="flex gap-1.5">
      {showMinus && (
        <button
          disabled={disabled}
          onClick={() => onSet(Math.max(1, (value ?? par + 1) - 1))}
          aria-label="Lower score"
          className={`${btn} ${plain}`}
        >
          −
        </button>
      )}
      {nums.map((s) => (
        <button
          key={s}
          disabled={disabled}
          onClick={() => onSet(s)}
          className={`${btn} ${
            value === s
              ? 'bg-golf-600 text-white'
              : 'bg-surface-700 text-surface-100 hover:bg-surface-600'
          }`}
        >
          {s}
        </button>
      ))}
      <button
        disabled={disabled}
        onClick={() => onSet((value ?? par - 1) + 1)}
        aria-label="Raise score"
        className={`${btn} ${plain}`}
      >
        +
      </button>
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
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="mt-1">
      <div className="divide-y divide-surface-700/60">
        {/* Putts */}
        <div className="py-3">
          <p className="mb-2 text-xs font-medium text-surface-300">Putts</p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() =>
                  onPatch({
                    putts: p,
                    gir: recomputeGir(score.strokes, p, par, score.greenMiss),
                  })
                }
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                  score.putts === p
                    ? 'bg-golf-600 text-white'
                    : 'bg-surface-700 text-surface-200 hover:bg-surface-600'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              aria-label="More putts"
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
              className="flex-1 py-2 rounded-lg bg-surface-700 text-surface-200 hover:bg-surface-600 text-sm font-bold"
            >
              +
            </button>
          </div>
        </div>

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

        {/* More detail — bunker + penalties tucked away to reduce scrolling */}
        <div className="py-3">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-golf-400"
          >
            {showMore ? 'Hide bunker / penalty' : 'Bunker or penalty'}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMore && (
            <div className="mt-1 divide-y divide-surface-700/60">
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
          )}
        </div>
      </div>
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
    <div className="flex items-start justify-between gap-3 py-3">
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
