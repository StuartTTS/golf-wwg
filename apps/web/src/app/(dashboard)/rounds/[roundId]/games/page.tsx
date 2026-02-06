'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from '@/providers/supabase-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GamePlayer {
  id: string;
  displayName: string;
  position: number;
  score: string;
  payout: number;
}

interface Game {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'completed' | 'pending';
  buyIn: number;
  players: GamePlayer[];
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

function AddGameModal({
  roundId,
  onClose,
  onCreated,
}: {
  roundId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { supabase } = useSupabase();
  const [gameType, setGameType] = useState('');
  const [buyIn, setBuyIn] = useState('5');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!gameType || !supabase) return;

    try {
      setCreating(true);
      const { error } = await supabase.from('games').insert({
        round_id: roundId,
        format: gameType,
        name: GAME_TYPE_LABELS[gameType] ?? gameType,
        money_per_unit: parseFloat(buyIn) || 0,
        status: 'active',
      });

      if (error) throw error;
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create game:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Add Game</CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </CardHeader>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Game Type
            </label>
            <div className="grid grid-cols-1 gap-2">
              {GAME_TYPES.map((gt) => (
                <button
                  key={gt.value}
                  onClick={() => setGameType(gt.value)}
                  className={`
                    text-left p-3 rounded-lg border transition-colors
                    ${
                      gameType === gt.value
                        ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <p className="text-sm font-medium text-gray-900">{gt.label}</p>
                  <p className="text-xs text-gray-500">{gt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buy-in ($)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={buyIn}
              onChange={(e) => setBuyIn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="0"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!gameType || creating}
              onClick={handleCreate}
            >
              {creating ? 'Creating...' : 'Create Game'}
            </Button>
          </div>
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
              <h3 className="font-semibold text-gray-900">{game.name}</h3>
              <Badge
                variant={game.status === 'active' ? 'default' : 'secondary'}
              >
                {game.status === 'active' ? 'Live' : game.status}
              </Badge>
            </div>
            {game.buyIn > 0 && (
              <span className="text-sm font-medium text-gray-600">
                ${game.buyIn}
              </span>
            )}
          </div>

          {/* Standings preview */}
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
                      ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}
                    `}
                  >
                    {player.position}
                  </span>
                  <span className="text-gray-700">{player.displayName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 font-medium">{player.score}</span>
                  {player.payout !== 0 && (
                    <span
                      className={`text-xs font-semibold ${
                        player.payout > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {player.payout > 0 ? '+' : ''}${player.payout}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {game.players.length > 3 && (
              <p className="text-xs text-gray-400 text-center">
                +{game.players.length - 3} more players
              </p>
            )}
          </div>
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
  const [loading, setLoading] = useState(true);
  const [showAddGame, setShowAddGame] = useState(false);

  const fetchGames = async () => {
    if (!supabase || !roundId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('games')
        .select(`
          id,
          type,
          name,
          status,
          buy_in,
          game_players (
            player_id,
            position,
            score,
            payout,
            profiles (
              id,
              display_name
            )
          )
        `)
        .eq('round_id', roundId)
        .order('created_at');

      if (error) throw error;

      setGames(
        (data ?? []).map((g: any) => ({
          id: g.id,
          type: g.type,
          name: g.name,
          status: g.status,
          buyIn: g.buy_in,
          players: (g.game_players ?? [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((gp: any) => ({
              id: gp.profiles.id,
              displayName: gp.profiles.display_name,
              position: gp.position,
              score: gp.score,
              payout: gp.payout ?? 0,
            })),
        }))
      );
    } catch (err) {
      console.error('Failed to load games:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [supabase, roundId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Games</h1>
          <p className="text-sm text-gray-500">
            {games.length === 0
              ? 'No games yet - add one to start competing'
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
            <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">
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

      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/rounds/${roundId}/scorecard`)}
        >
          Back to Scorecard
        </Button>
      </div>

      {showAddGame && (
        <AddGameModal
          roundId={roundId}
          onClose={() => setShowAddGame(false)}
          onCreated={fetchGames}
        />
      )}
    </div>
  );
}
