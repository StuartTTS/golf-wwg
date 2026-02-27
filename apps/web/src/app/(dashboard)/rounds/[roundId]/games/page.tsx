'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/supabase-provider';
import { createGame } from '@/lib/actions/games';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface GamePlayer {
  id: string;
  displayName: string;
  position: number;
  score: string;
  payout: number;
}

interface Game {
  id: string;
  format: string;
  name: string;
  status: 'pending' | 'active' | 'finalized';
  moneyPerUnit: number;
  config: Record<string, unknown>;
  holes: string;
  players: GamePlayer[];
}

interface RoundPlayer {
  userId: string;
  displayName: string;
}

const GAME_TYPE_LABELS: Record<string, string> = {
  nassau: 'Nassau',
  skins: 'Skins',
  wolf: 'Wolf',
  best_ball: 'Best Ball',
  stableford: 'Stableford',
  match_play: 'Match Play',
  bingo_bango_bongo: 'Bingo Bango Bongo',
};

const GAME_TYPES = [
  { value: 'nassau', label: 'Nassau', description: 'Front 9, Back 9, and Overall bets' },
  { value: 'skins', label: 'Skins', description: 'Win the hole outright to collect a skin' },
  { value: 'wolf', label: 'Wolf', description: 'Choose partners or go lone wolf' },
  { value: 'best_ball', label: 'Best Ball', description: 'Team best score on each hole' },
  { value: 'stableford', label: 'Stableford', description: 'Points-based scoring system' },
  { value: 'match_play', label: 'Match Play', description: 'Win individual holes' },
  { value: 'bingo_bango_bongo', label: 'Bingo Bango Bongo', description: 'Points for first on, closest, first in' },
];

// Game-specific configuration options
function GameConfigFields({
  gameType,
  config,
  setConfig,
}: {
  gameType: string;
  config: Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
}) {
  switch (gameType) {
    case 'nassau':
      return (
        <div className="space-y-3">
          <p className="text-xs text-surface-300">Set the wager per bet. Nassau has 3 bets: front 9, back 9, and overall.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Front 9</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={String(config.frontBet ?? '5')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfig({ ...config, frontBet: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Back 9</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={String(config.backBet ?? '5')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfig({ ...config, backBet: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Overall</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={String(config.overallBet ?? '5')}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfig({ ...config, overallBet: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={!!config.autoPresses}
              onChange={(e) => setConfig({ ...config, autoPresses: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Auto press when 2-down
          </label>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.useHandicaps !== false}
              onChange={(e) => setConfig({ ...config, useHandicaps: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Use handicap strokes
          </label>
        </div>
      );

    case 'skins':
      return (
        <div className="space-y-3">
          <p className="text-xs text-surface-300">Each hole is worth one skin. Ties carry over to the next hole (if enabled).</p>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.carryover !== false}
              onChange={(e) => setConfig({ ...config, carryover: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Carry over ties to next hole
          </label>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.useHandicaps !== false}
              onChange={(e) => setConfig({ ...config, useHandicaps: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Use handicap strokes (net skins)
          </label>
        </div>
      );

    case 'wolf':
      return (
        <div className="space-y-3">
          <p className="text-xs text-surface-300">Wolf chooses a partner after each tee shot, or goes lone wolf for double the bet.</p>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={!!config.blindWolf}
              onChange={(e) => setConfig({ ...config, blindWolf: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Allow blind wolf (declare before anyone tees off)
          </label>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.useHandicaps !== false}
              onChange={(e) => setConfig({ ...config, useHandicaps: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Use handicap strokes
          </label>
        </div>
      );

    case 'best_ball':
      return (
        <div className="space-y-3">
          <p className="text-xs text-surface-300">Teams compete using the best score from each team on every hole.</p>
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Team Size</label>
            <div className="flex gap-2">
              {[2, 3, 4].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setConfig({ ...config, teamSize: size })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    (config.teamSize ?? 2) === size
                      ? 'bg-golf-600 text-white'
                      : 'bg-surface-700 text-surface-100 hover:bg-surface-600'
                  }`}
                >
                  {size}v{size}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.useHandicaps !== false}
              onChange={(e) => setConfig({ ...config, useHandicaps: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Use handicap strokes
          </label>
        </div>
      );

    case 'stableford':
      return (
        <div className="space-y-3">
          <p className="text-xs text-surface-300">Points-based scoring: double bogey+ = 0, bogey = 1, par = 2, birdie = 3, eagle = 4, albatross = 5.</p>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={!!config.modifiedStableford}
              onChange={(e) => setConfig({ ...config, modifiedStableford: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Modified Stableford (negative points for bogey+)
          </label>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.useHandicaps !== false}
              onChange={(e) => setConfig({ ...config, useHandicaps: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Use handicap strokes
          </label>
        </div>
      );

    case 'match_play':
      return (
        <div className="space-y-3">
          <p className="text-xs text-surface-300">Win holes to earn points. Most holes won at the end takes the match.</p>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.useHandicaps !== false}
              onChange={(e) => setConfig({ ...config, useHandicaps: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Use handicap strokes
          </label>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={!!config.nassauStyle}
              onChange={(e) => setConfig({ ...config, nassauStyle: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Match can end early (e.g. 5 & 3)
          </label>
        </div>
      );

    case 'bingo_bango_bongo':
      return (
        <div className="space-y-3">
          <p className="text-xs text-surface-300">
            3 points per hole: <strong>Bingo</strong> (first on green),{' '}
            <strong>Bango</strong> (closest to pin once all on),{' '}
            <strong>Bongo</strong> (first to hole out).
          </p>
          <label className="flex items-center gap-2 text-sm text-surface-100">
            <input
              type="checkbox"
              checked={config.useHandicaps !== false}
              onChange={(e) => setConfig({ ...config, useHandicaps: e.target.checked })}
              className="h-4 w-4 rounded border-surface-500 text-golf-600 focus:ring-golf-500"
            />
            Use handicap strokes
          </label>
        </div>
      );

    default:
      return null;
  }
}

function AddGameModal({
  roundId,
  roundPlayers,
  onClose,
  onCreated,
}: {
  roundId: string;
  roundPlayers: RoundPlayer[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [gameType, setGameType] = useState('');
  const [buyIn, setBuyIn] = useState('5');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [holes, setHoles] = useState('all');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectType = (type: string) => {
    setGameType(type);
    setConfig({});
    setStep('config');
  };

  const handleCreate = async () => {
    if (!gameType) return;

    try {
      setCreating(true);
      setError(null);

      const result = await createGame({
        roundId,
        format: gameType,
        name: GAME_TYPE_LABELS[gameType] ?? gameType,
        config,
        moneyPerUnit: parseFloat(buyIn) || 0,
        holes,
        playerIds: roundPlayers.map((p) => p.userId),
      });

      if (result.error) {
        setError(result.error);
        setCreating(false);
        return;
      }

      onCreated();
      onClose();
    } catch (err) {
      setError('Failed to create game. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <Card className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>
              {step === 'type' ? 'Choose Game Type' : GAME_TYPE_LABELS[gameType]}
            </CardTitle>
            <button
              onClick={onClose}
              className="text-surface-400 hover:text-surface-200 p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4 overflow-y-auto flex-1">
          {/* Step 1: Select game type */}
          {step === 'type' && (
            <div className="grid grid-cols-1 gap-2">
              {GAME_TYPES.map((gt) => (
                <button
                  key={gt.value}
                  onClick={() => handleSelectType(gt.value)}
                  className="text-left p-3 rounded-lg border border-surface-500 hover:border-golf-500 hover:bg-golf-900/20 transition-colors"
                >
                  <p className="text-sm font-medium text-surface-50">{gt.label}</p>
                  <p className="text-xs text-surface-300">{gt.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Configure game options */}
          {step === 'config' && (
            <>
              <GameConfigFields
                gameType={gameType}
                config={config}
                setConfig={setConfig}
              />

              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1">
                  Wager per unit ($)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={buyIn}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBuyIn(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1">
                  Holes
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: 'All 18' },
                    { value: 'front', label: 'Front 9' },
                    { value: 'back', label: 'Back 9' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setHoles(opt.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        holes === opt.value
                          ? 'bg-golf-600 text-white'
                          : 'bg-surface-700 text-surface-100 hover:bg-surface-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-surface-400">
                All {roundPlayers.length} round players will be added to this game.
              </p>

              {error && (
                <div className="rounded-md bg-red-900/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep('type')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={creating}
                  onClick={handleCreate}
                >
                  {creating ? 'Creating...' : 'Create Game'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function GameCard({ game, roundId }: { game: Game; roundId: string }) {
  const leader = game.players[0];

  return (
    <Link href={`/rounds/${roundId}/games/${game.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-surface-50">{game.name}</h3>
              <Badge
                variant={game.status === 'active' ? 'default' : 'secondary'}
              >
                {game.status === 'active' ? 'Live' : game.status}
              </Badge>
            </div>
            {game.moneyPerUnit > 0 && (
              <span className="text-sm font-medium text-surface-50">
                ${game.moneyPerUnit}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-surface-300 mb-3">
            <span>{GAME_TYPE_LABELS[game.format] || game.format}</span>
            {game.holes !== 'all' && (
              <>
                <span>&middot;</span>
                <span className="capitalize">{game.holes} 9</span>
              </>
            )}
            <span>&middot;</span>
            <span>{game.players.length} players</span>
          </div>

          {/* Standings preview */}
          {game.players.length > 0 && (
            <div className="space-y-2">
              {game.players.slice(0, 3).map((player, idx) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                        w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                        ${idx === 0 ? 'bg-gold-500/20 text-gold-500' : 'bg-surface-700 text-surface-200'}
                      `}
                    >
                      {player.position}
                    </span>
                    <span className="text-surface-100">{player.displayName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-surface-50 font-medium">{player.score}</span>
                    {player.payout !== 0 && (
                      <span
                        className={`text-xs font-semibold ${
                          player.payout > 0 ? 'text-golf-600' : 'text-red-400'
                        }`}
                      >
                        {player.payout > 0 ? '+' : ''}${player.payout}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {game.players.length > 3 && (
                <p className="text-xs text-surface-400 text-center">
                  +{game.players.length - 3} more players
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function GamesPage() {
  const params = useParams<{ roundId: string }>();
  const router = useRouter();
  const { supabase } = useSupabase();
  const roundId = params.roundId;

  const [games, setGames] = useState<Game[]>([]);
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGame, setShowAddGame] = useState(false);

  const fetchData = async () => {
    if (!supabase || !roundId) return;

    try {
      setLoading(true);

      // Fetch games with correct column names
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select(`
          id,
          format,
          name,
          status,
          money_per_unit,
          config,
          holes,
          results,
          game_players (
            player_id,
            playing_handicap,
            profiles:profiles!game_players_player_id_fkey (
              id,
              display_name
            )
          )
        `)
        .eq('round_id', roundId)
        .order('created_at');

      if (gamesError) throw gamesError;

      setGames(
        (gamesData ?? []).map((g: any) => ({
          id: g.id,
          format: g.format,
          name: g.name || GAME_TYPE_LABELS[g.format] || g.format,
          status: g.status,
          moneyPerUnit: g.money_per_unit ?? 0,
          config: g.config ?? {},
          holes: g.holes ?? 'all',
          players: (g.game_players ?? []).map((gp: any) => ({
            id: gp.profiles?.id ?? gp.player_id,
            displayName: gp.profiles?.display_name ?? 'Unknown',
            position: 0,
            score: '-',
            payout: 0,
          })),
        }))
      );

      // Fetch round players for the add game modal
      const { data: playersData } = await supabase
        .from('round_players')
        .select('user_id, profiles:profiles!round_players_user_id_fkey(id, display_name)')
        .eq('round_id', roundId);

      setRoundPlayers(
        (playersData ?? []).map((rp: any) => ({
          userId: rp.user_id,
          displayName: rp.profiles?.display_name ?? 'Unknown',
        }))
      );
    } catch (err) {
      console.error('Failed to load games:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase, roundId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-golf-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/rounds/${roundId}`}
            className="text-sm text-surface-300 hover:text-surface-100 mb-1 inline-block"
          >
            &larr; Back to Round
          </Link>
          <h1 className="text-2xl font-bold text-surface-50">Games</h1>
          <p className="text-sm text-surface-300">
            {games.length === 0
              ? 'No games yet — add one to start competing'
              : `${games.length} game${games.length !== 1 ? 's' : ''} active`}
          </p>
        </div>
        <Button onClick={() => setShowAddGame(true)}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Game
        </Button>
      </div>

      {games.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-700 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-surface-300 mb-4">
              Spice up your round with a friendly wager
            </p>
            <Button onClick={() => setShowAddGame(true)}>Add Your First Game</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} roundId={roundId} />
          ))}
        </div>
      )}

      {showAddGame && (
        <AddGameModal
          roundId={roundId}
          roundPlayers={roundPlayers}
          onClose={() => setShowAddGame(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
