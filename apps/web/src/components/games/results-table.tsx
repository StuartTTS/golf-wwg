'use client';

import type { GameResult, PlayerStanding, TeamStanding } from '@golf/core';

interface ResultsTableProps {
  result: GameResult;
  playerNames: Record<string, string>; // playerId -> displayName
}

export function ResultsTable({ result, playerNames }: ResultsTableProps) {
  const getName = (id: string) => playerNames[id] || id;

  return (
    <div className="space-y-4">
      {/* Player Standings */}
      {result.playerStandings.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Player Standings
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4">Pos</th>
                <th className="pb-2 pr-4">Player</th>
                <th className="pb-2 pr-4 text-right">Gross</th>
                <th className="pb-2 pr-4 text-right">Net</th>
                <th className="pb-2 text-right">Won</th>
              </tr>
            </thead>
            <tbody>
              {result.playerStandings.map((standing: PlayerStanding) => (
                <tr key={standing.playerId} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">
                    {standing.tied ? `T${standing.position}` : standing.position}
                  </td>
                  <td className="py-2 pr-4">{getName(standing.playerId)}</td>
                  <td className="py-2 pr-4 text-right text-slate-600">
                    {standing.totalGross}
                  </td>
                  <td className="py-2 pr-4 text-right">{standing.totalNet}</td>
                  <td className="py-2 text-right">
                    {standing.moneyWon > 0 && (
                      <span className="text-green-600 font-medium">
                        +${standing.moneyWon.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Team Standings */}
      {result.teamStandings.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Team Standings
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4">Pos</th>
                <th className="pb-2 pr-4">Team</th>
                <th className="pb-2 pr-4 text-right">Score</th>
                <th className="pb-2 text-right">Won</th>
              </tr>
            </thead>
            <tbody>
              {result.teamStandings.map((team: TeamStanding) => (
                <tr key={team.teamId} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">
                    {team.tied ? `T${team.position}` : team.position}
                  </td>
                  <td className="py-2 pr-4">{team.teamName}</td>
                  <td className="py-2 pr-4 text-right">{team.totalScore}</td>
                  <td className="py-2 text-right">
                    {team.moneyWon > 0 && (
                      <span className="text-green-600 font-medium">
                        +${team.moneyWon.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payouts */}
      {result.payouts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">
            Payouts
          </h4>
          <div className="space-y-1">
            {result.payouts.map((payout, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-1.5 px-3 rounded bg-green-50"
              >
                <span>{getName(payout.playerId)}</span>
                <span className="font-medium text-green-700">
                  ${payout.amount.toFixed(2)}
                  {payout.description && (
                    <span className="text-xs text-slate-500 ml-1">
                      ({payout.description})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
