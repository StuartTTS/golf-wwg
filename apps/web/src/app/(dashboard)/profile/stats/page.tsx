'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface StatsSummary {
  totalRounds: number;
  averageScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  fairwayHitPct: number | null;
  girPct: number | null;
  averagePutts: number | null;
  averagePuttsPerGir: number | null;
  parOrBetterPct: number | null;
  birdiesPer18: number | null;
  bogeysPer18: number | null;
  doublesPlusPer18: number | null;
  scramblePct: number | null;
  averageDrivingDistance: number | null;
}

interface ScoringByPar {
  par: number;
  average: number;
  birdieOrBetterPct: number;
  parPct: number;
  bogeyPct: number;
  doublePlusPct: number;
}

interface TrendPoint {
  date: string;
  value: number;
}

interface StatsData {
  summary: StatsSummary;
  scoringByPar: ScoringByPar[];
  scoringTrend: TrendPoint[];
  puttingTrend: TrendPoint[];
  firTrend: TrendPoint[];
  girTrend: TrendPoint[];
}

type TimePeriod = 'all' | 'last10' | 'last20' | 'year';

function StatCard({
  label,
  value,
  subtext,
  highlight,
}: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: 'green' | 'red' | 'blue';
}) {
  const colorClass =
    highlight === 'green'
      ? 'text-golf-600'
      : highlight === 'red'
      ? 'text-red-400'
      : highlight === 'blue'
      ? 'text-blue-600'
      : 'text-surface-50';

  return (
    <div className="p-3 bg-surface-800 rounded-lg border border-surface-500">
      <p className="text-[10px] text-surface-300 uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className={`text-xl font-bold mt-0.5 ${colorClass}`}>{value}</p>
      {subtext && <p className="text-[10px] text-surface-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

function TrendChart({
  data,
  label,
  formatValue,
  color,
}: {
  data: TrendPoint[];
  label: string;
  formatValue: (v: number) => string;
  color: string;
}) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-surface-400 text-center py-4">
        Not enough data for trend
      </p>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div>
      <p className="text-xs font-semibold text-surface-300 uppercase tracking-wide mb-2">
        {label}
      </p>
      <div className="flex items-end gap-[2px] h-24">
        {data.map((point, idx) => {
          const height = ((point.value - min) / range) * 100;
          const barHeight = Math.max(4, height);

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              <div className="hidden group-hover:block absolute -top-6 bg-surface-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {formatValue(point.value)}
              </div>
              <div
                className={`w-full ${color} rounded-t-sm min-h-[4px] transition-all hover:opacity-80`}
                style={{ height: `${barHeight}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-surface-400">
          {data[0]
            ? new Date(data[0].date).toLocaleDateString('en-US', {
                month: 'short',
                year: '2-digit',
              })
            : ''}
        </span>
        <span className="text-[9px] text-surface-400">
          {data[data.length - 1]
            ? new Date(data[data.length - 1].date).toLocaleDateString('en-US', {
                month: 'short',
                year: '2-digit',
              })
            : ''}
        </span>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();

  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('all');

  useEffect(() => {
    async function fetchStats() {
      if (!supabase || !user) return;

      try {
        setLoading(true);

        // Fetch all scores for the player with round info
        const { data: scoresData } = await supabase
          .from('scores')
          .select(`
            round_id,
            hole_number,
            strokes,
            putts,
            fairway_hit,
            gir,
            rounds (
              id,
              round_date,
              status
            )
          `)
          .eq('player_id', user.id)
          .eq('rounds.status', 'completed');

        // Fetch hole par data via round_players -> tee_box -> holes
        const { data: roundPlayersData } = await supabase
          .from('round_players')
          .select(`
            round_id,
            tee_box_id,
            tee_boxes:tee_box_id (
              holes (
                hole_number,
                par
              )
            )
          `)
          .eq('user_id', user.id);

        // Build a map of round_id + hole_number -> par
        const parMap: Record<string, number> = {};
        (roundPlayersData ?? []).forEach((rp: any) => {
          const holes = rp.tee_boxes?.holes ?? [];
          holes.forEach((h: any) => {
            parMap[`${rp.round_id}_${h.hole_number}`] = h.par;
          });
        });

        const allScores = (scoresData ?? [])
          .filter((s: any) => s.rounds && s.strokes !== null)
          .map((s: any) => ({
            ...s,
            par: parMap[`${s.round_id}_${s.hole_number}`] ?? null,
          }));

        // Group by round
        const roundMap: Record<string, any[]> = {};
        allScores.forEach((s: any) => {
          const rid = s.round_id;
          if (!roundMap[rid]) roundMap[rid] = [];
          roundMap[rid].push(s);
        });

        const roundEntries = Object.entries(roundMap);

        // Apply period filter
        let filteredRounds = roundEntries;
        if (period === 'last10') {
          filteredRounds = roundEntries.slice(-10);
        } else if (period === 'last20') {
          filteredRounds = roundEntries.slice(-20);
        } else if (period === 'year') {
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          filteredRounds = roundEntries.filter(([_, scores]) => {
            const date = scores[0]?.rounds?.round_date;
            return date && new Date(date) >= yearAgo;
          });
        }

        const filteredScores = filteredRounds.flatMap(([_, scores]) => scores);
        const roundTotals = filteredRounds.map(([_, scores]) => ({
          date: scores[0]?.rounds?.round_date ?? '',
          total: scores.reduce((sum: number, s: any) => sum + (s.strokes ?? 0), 0),
        }));

        // Calculate stats
        const totalRounds = filteredRounds.length;
        const avgScore =
          roundTotals.length > 0
            ? roundTotals.reduce((sum, r) => sum + r.total, 0) / roundTotals.length
            : null;
        const bestScore =
          roundTotals.length > 0
            ? Math.min(...roundTotals.map((r) => r.total))
            : null;
        const worstScore =
          roundTotals.length > 0
            ? Math.max(...roundTotals.map((r) => r.total))
            : null;

        // FIR%
        const fairwayEligible = filteredScores.filter(
          (s: any) => s.fairway_hit !== null && s.par >= 4
        );
        const fairwayHits = fairwayEligible.filter(
          (s: any) => s.fairway_hit === true
        );
        const firPct =
          fairwayEligible.length > 0
            ? (fairwayHits.length / fairwayEligible.length) * 100
            : null;

        // GIR%
        const girEligible = filteredScores.filter(
          (s: any) => s.gir !== null
        );
        const girHits = girEligible.filter(
          (s: any) => s.gir === true
        );
        const girPct =
          girEligible.length > 0
            ? (girHits.length / girEligible.length) * 100
            : null;

        // Average putts
        const puttsScores = filteredScores.filter(
          (s: any) => s.putts !== null
        );
        const avgPutts =
          puttsScores.length > 0
            ? puttsScores.reduce((sum: number, s: any) => sum + s.putts, 0) /
              puttsScores.length
            : null;

        // Scoring distribution
        let birdies = 0;
        let pars = 0;
        let bogeys = 0;
        let doublesPlus = 0;
        let totalHoles = 0;

        filteredScores.forEach((s: any) => {
          if (s.strokes !== null && s.par) {
            totalHoles++;
            const diff = s.strokes - s.par;
            if (diff <= -1) birdies++;
            else if (diff === 0) pars++;
            else if (diff === 1) bogeys++;
            else if (diff >= 2) doublesPlus++;
          }
        });

        const holesPerRound = 18;
        const birdiesPer18 =
          totalHoles > 0 ? (birdies / totalHoles) * holesPerRound : null;
        const bogeysPer18 =
          totalHoles > 0 ? (bogeys / totalHoles) * holesPerRound : null;
        const doublesPlusPer18 =
          totalHoles > 0 ? (doublesPlus / totalHoles) * holesPerRound : null;
        const parOrBetterPct =
          totalHoles > 0
            ? ((birdies + pars) / totalHoles) * 100
            : null;

        // Scoring by par
        const parGroups: Record<number, any[]> = {};
        filteredScores.forEach((s: any) => {
          if (s.strokes !== null && s.par) {
            const par = s.par;
            if (!parGroups[par]) parGroups[par] = [];
            parGroups[par].push(s);
          }
        });

        const scoringByPar: ScoringByPar[] = [3, 4, 5].map((par) => {
          const group = parGroups[par] ?? [];
          if (group.length === 0) {
            return {
              par,
              average: par,
              birdieOrBetterPct: 0,
              parPct: 0,
              bogeyPct: 0,
              doublePlusPct: 0,
            };
          }
          const total = group.length;
          const avg =
            group.reduce((sum: number, s: any) => sum + s.strokes, 0) / total;
          const bobs = group.filter(
            (s: any) => s.strokes <= par - 1
          ).length;
          const parsCount = group.filter(
            (s: any) => s.strokes === par
          ).length;
          const bogeysCount = group.filter(
            (s: any) => s.strokes === par + 1
          ).length;
          const dpCount = group.filter(
            (s: any) => s.strokes >= par + 2
          ).length;

          return {
            par,
            average: avg,
            birdieOrBetterPct: (bobs / total) * 100,
            parPct: (parsCount / total) * 100,
            bogeyPct: (bogeysCount / total) * 100,
            doublePlusPct: (dpCount / total) * 100,
          };
        });

        // Trends
        const scoringTrend: TrendPoint[] = roundTotals
          .filter((r) => r.date)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((r) => ({ date: r.date, value: r.total }));

        setData({
          summary: {
            totalRounds,
            averageScore: avgScore,
            bestScore,
            worstScore,
            fairwayHitPct: firPct,
            girPct,
            averagePutts: avgPutts,
            averagePuttsPerGir: null,
            parOrBetterPct,
            birdiesPer18,
            bogeysPer18,
            doublesPlusPer18,
            scramblePct: null,
            averageDrivingDistance: null,
          },
          scoringByPar,
          scoringTrend,
          puttingTrend: [],
          firTrend: [],
          girTrend: [],
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [supabase, user, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-golf-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-surface-300">Unable to load statistics</p>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/profile')}
            className="text-sm text-surface-300 hover:text-surface-100 flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Profile
          </button>
          <h1 className="text-2xl font-bold text-surface-50">Statistics</h1>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as TimePeriod)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="last10">Last 10 Rounds</SelectItem>
            <SelectItem value="last20">Last 20 Rounds</SelectItem>
            <SelectItem value="year">Past Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-surface-300">
        Based on {summary.totalRounds} round{summary.totalRounds !== 1 ? 's' : ''}
      </p>

      {/* Scoring averages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scoring</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Average"
            value={summary.averageScore?.toFixed(1) ?? '-'}
          />
          <StatCard
            label="Best"
            value={summary.bestScore?.toString() ?? '-'}
            highlight="green"
          />
          <StatCard
            label="Worst"
            value={summary.worstScore?.toString() ?? '-'}
            highlight="red"
          />
          <StatCard
            label="Par or Better"
            value={summary.parOrBetterPct ? `${summary.parOrBetterPct.toFixed(0)}%` : '-'}
          />
        </div>
      </Card>

      {/* Scoring distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scoring Distribution</CardTitle>
          <CardDescription>Birdies, bogeys, and doubles per 18 holes</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4 grid grid-cols-3 gap-3">
          <StatCard
            label="Birdies / 18"
            value={summary.birdiesPer18?.toFixed(1) ?? '-'}
            highlight="green"
          />
          <StatCard
            label="Bogeys / 18"
            value={summary.bogeysPer18?.toFixed(1) ?? '-'}
            highlight="blue"
          />
          <StatCard
            label="Doubles+ / 18"
            value={summary.doublesPlusPer18?.toFixed(1) ?? '-'}
            highlight="red"
          />
        </div>
      </Card>

      {/* Tee to green */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tee to Green</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <StatCard
            label="Fairways Hit (FIR%)"
            value={summary.fairwayHitPct ? `${summary.fairwayHitPct.toFixed(1)}%` : '-'}
            subtext="Par 4s and 5s"
          />
          <StatCard
            label="Greens in Reg (GIR%)"
            value={summary.girPct ? `${summary.girPct.toFixed(1)}%` : '-'}
            subtext="All holes"
          />
        </div>
      </Card>

      {/* Putting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Putting</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <StatCard
            label="Avg Putts / Hole"
            value={summary.averagePutts?.toFixed(2) ?? '-'}
          />
          <StatCard
            label="Avg Putts / GIR"
            value={summary.averagePuttsPerGir?.toFixed(2) ?? '-'}
          />
        </div>
      </Card>

      {/* Scoring by par */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scoring by Par</CardTitle>
          <CardDescription>Average score and distribution per hole type</CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="space-y-4">
            {data.scoringByPar.map((sp) => (
              <div key={sp.par}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-surface-100">
                    Par {sp.par}
                  </span>
                  <span className="text-sm font-bold text-surface-50">
                    Avg: {sp.average.toFixed(2)}
                  </span>
                </div>
                {/* Stacked bar */}
                <div className="flex h-4 rounded-full overflow-hidden bg-surface-700">
                  {sp.birdieOrBetterPct > 0 && (
                    <div
                      className="bg-score-birdie transition-all"
                      style={{ width: `${sp.birdieOrBetterPct}%` }}
                      title={`Birdie+: ${sp.birdieOrBetterPct.toFixed(0)}%`}
                    />
                  )}
                  {sp.parPct > 0 && (
                    <div
                      className="bg-golf-500 transition-all"
                      style={{ width: `${sp.parPct}%` }}
                      title={`Par: ${sp.parPct.toFixed(0)}%`}
                    />
                  )}
                  {sp.bogeyPct > 0 && (
                    <div
                      className="bg-score-bogey transition-all"
                      style={{ width: `${sp.bogeyPct}%` }}
                      title={`Bogey: ${sp.bogeyPct.toFixed(0)}%`}
                    />
                  )}
                  {sp.doublePlusPct > 0 && (
                    <div
                      className="bg-score-double transition-all"
                      style={{ width: `${sp.doublePlusPct}%` }}
                      title={`Double+: ${sp.doublePlusPct.toFixed(0)}%`}
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-surface-400">
                  <span>Birdie+ {sp.birdieOrBetterPct.toFixed(0)}%</span>
                  <span>Par {sp.parPct.toFixed(0)}%</span>
                  <span>Bogey {sp.bogeyPct.toFixed(0)}%</span>
                  <span>Double+ {sp.doublePlusPct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Scoring trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trends</CardTitle>
        </CardHeader>
        <div className="px-4 pb-4">
          <TrendChart
            data={data.scoringTrend}
            label="Scoring Average"
            formatValue={(v) => v.toString()}
            color="bg-golf-500"
          />
        </div>
      </Card>
    </div>
  );
}
