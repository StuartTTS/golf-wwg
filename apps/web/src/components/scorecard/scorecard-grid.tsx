'use client';

import { useState } from 'react';
import type { HoleInfo, PlayerInfo, HoleScore } from '@golf/core';

interface ScorecardGridProps {
  holes: HoleInfo[];
  players: PlayerInfo[];
  scores: HoleScore[];
  activeHole: number;
  onScoreChange: (playerId: string, holeNumber: number, strokes: number | null) => void;
  onHoleSelect: (holeNumber: number) => void;
  readOnly?: boolean;
}

export function ScorecardGrid({
  holes,
  players,
  scores,
  activeHole,
  onScoreChange,
  onHoleSelect,
  readOnly = false,
}: ScorecardGridProps) {
  const [editingCell, setEditingCell] = useState<{ playerId: string; holeNumber: number } | null>(null);

  const frontNine = holes.filter((h) => h.holeNumber <= 9);
  const backNine = holes.filter((h) => h.holeNumber > 9);

  const getScore = (playerId: string, holeNumber: number) =>
    scores.find((s) => s.playerId === playerId && s.holeNumber === holeNumber);

  const getTotal = (playerId: string, holeRange: HoleInfo[]) =>
    holeRange.reduce((sum, h) => {
      const s = getScore(playerId, h.holeNumber);
      return sum + (s?.strokes ?? 0);
    }, 0);

  const parTotal = (holeRange: HoleInfo[]) =>
    holeRange.reduce((sum, h) => sum + h.par, 0);

  const scoreColor = (strokes: number | null, par: number) => {
    if (strokes === null) return '';
    const diff = strokes - par;
    if (diff <= -2) return 'bg-score-eagle/20 text-score-eagle font-bold'; // Eagle+
    if (diff === -1) return 'bg-score-birdie/20 text-score-birdie font-semibold'; // Birdie
    if (diff === 0) return 'text-surface-200'; // Par
    if (diff === 1) return 'bg-score-bogey/20 text-score-bogey'; // Bogey
    return 'bg-score-double/20 text-score-double'; // Double+
  };

  const handleCellClick = (playerId: string, holeNumber: number) => {
    if (readOnly) return;
    setEditingCell({ playerId, holeNumber });
    onHoleSelect(holeNumber);
  };

  const handleScoreInput = (playerId: string, holeNumber: number, value: string) => {
    const num = parseInt(value);
    if (value === '' || value === '0') {
      onScoreChange(playerId, holeNumber, null);
    } else if (!isNaN(num) && num >= 1 && num <= 15) {
      onScoreChange(playerId, holeNumber, num);
    }
    setEditingCell(null);
  };

  const renderHoleHeaders = (holeRange: HoleInfo[], label: string) => (
    <thead>
      <tr className="bg-surface-700 text-xs">
        <th className="sticky left-0 z-10 bg-surface-700 px-2 py-1 text-left font-medium text-surface-200 w-24">
          {label}
        </th>
        {holeRange.map((h) => (
          <th
            key={h.holeNumber}
            className={`px-1 py-1 text-center font-medium text-surface-200 w-10 cursor-pointer ${
              h.holeNumber === activeHole ? 'bg-golf-500/20' : ''
            }`}
            onClick={() => onHoleSelect(h.holeNumber)}
          >
            {h.holeNumber}
          </th>
        ))}
        <th className="px-2 py-1 text-center font-semibold text-surface-50 bg-surface-600 w-12">
          {label === 'Hole' ? 'OUT' : label === 'Hole ' ? 'IN' : 'TOT'}
        </th>
      </tr>
      <tr className="bg-surface-700 text-xs text-surface-300">
        <td className="sticky left-0 z-10 bg-surface-700 px-2 py-1">Par</td>
        {holeRange.map((h) => (
          <td key={h.holeNumber} className="px-1 py-1 text-center">
            {h.par}
          </td>
        ))}
        <td className="px-2 py-1 text-center font-medium bg-surface-600 text-surface-200">
          {parTotal(holeRange)}
        </td>
      </tr>
    </thead>
  );

  const renderPlayerRow = (player: PlayerInfo, holeRange: HoleInfo[]) => (
    <tr key={player.playerId} className="border-b border-surface-600">
      <td className="sticky left-0 z-10 bg-surface-900 px-2 py-1.5 text-xs font-medium text-surface-100 truncate max-w-24">
        {player.displayName}
        {player.playingHandicap > 0 && (
          <span className="ml-1 text-surface-400">({player.playingHandicap})</span>
        )}
      </td>
      {holeRange.map((h) => {
        const score = getScore(player.playerId, h.holeNumber);
        const isEditing =
          editingCell?.playerId === player.playerId &&
          editingCell?.holeNumber === h.holeNumber;

        return (
          <td
            key={h.holeNumber}
            className={`px-1 py-1.5 text-center text-sm cursor-pointer ${scoreColor(
              score?.strokes ?? null,
              h.par
            )} ${h.holeNumber === activeHole ? 'ring-2 ring-golf-500 ring-inset' : ''}`}
            onClick={() => handleCellClick(player.playerId, h.holeNumber)}
          >
            {isEditing ? (
              <input
                type="number"
                min={1}
                max={15}
                className="w-8 text-center text-sm border-0 bg-surface-800 text-surface-50 focus:outline-none focus:ring-1 focus:ring-golf-500 rounded"
                defaultValue={score?.strokes ?? ''}
                autoFocus
                onBlur={(e) =>
                  handleScoreInput(player.playerId, h.holeNumber, e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScoreInput(
                      player.playerId,
                      h.holeNumber,
                      (e.target as HTMLInputElement).value
                    );
                  }
                  if (e.key === 'Escape') setEditingCell(null);
                }}
              />
            ) : (
              score?.strokes ?? '-'
            )}
          </td>
        );
      })}
      <td className="px-2 py-1.5 text-center text-sm font-semibold bg-surface-800/50 text-surface-50">
        {getTotal(player.playerId, holeRange) || '-'}
      </td>
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      {/* Front Nine */}
      <table className="w-full border-collapse text-sm mb-4">
        {renderHoleHeaders(frontNine, 'Hole')}
        <tbody>
          {players.map((p) => renderPlayerRow(p, frontNine))}
        </tbody>
      </table>

      {/* Back Nine */}
      {backNine.length > 0 && (
        <table className="w-full border-collapse text-sm mb-4">
          {renderHoleHeaders(backNine, 'Hole ')}
          <tbody>
            {players.map((p) => renderPlayerRow(p, backNine))}
          </tbody>
        </table>
      )}

      {/* Totals */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface-700 text-xs font-semibold">
            <th className="px-2 py-1.5 text-left text-surface-200 w-24">Total</th>
            <th className="px-2 py-1.5 text-center text-surface-50">OUT</th>
            <th className="px-2 py-1.5 text-center text-surface-50">IN</th>
            <th className="px-2 py-1.5 text-center text-surface-50">TOTAL</th>
            <th className="px-2 py-1.5 text-center text-surface-50">+/-</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const out = getTotal(p.playerId, frontNine);
            const inn = getTotal(p.playerId, backNine);
            const total = out + inn;
            const totalPar = parTotal(frontNine) + parTotal(backNine);
            const diff = total - totalPar;
            return (
              <tr key={p.playerId} className="border-b border-surface-600">
                <td className="px-2 py-1.5 text-xs font-medium text-surface-100">{p.displayName}</td>
                <td className="px-2 py-1.5 text-center text-surface-200">{out || '-'}</td>
                <td className="px-2 py-1.5 text-center text-surface-200">{inn || '-'}</td>
                <td className="px-2 py-1.5 text-center font-bold text-surface-50">{total || '-'}</td>
                <td className={`px-2 py-1.5 text-center font-medium ${
                  diff < 0 ? 'text-score-birdie' : diff > 0 ? 'text-score-bogey' : ''
                }`}>
                  {total ? (diff > 0 ? `+${diff}` : diff === 0 ? 'E' : diff) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
