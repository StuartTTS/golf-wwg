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

interface HandicapEntry {
  date: string;
  handicapIndex: number;
}

interface Differential {
  roundId: string;
  date: string;
  courseName: string;
  teeBoxName: string;
  grossScore: number;
  courseRating: number;
  slope: number;
  differential: number;
  isUsed: boolean;
}

interface HandicapData {
  currentHandicap: number | null;
  lowHandicap: number | null;
  highHandicap: number | null;
  totalRounds: number;
  eligibleRounds: number;
  usedDifferentials: number;
  history: HandicapEntry[];
  differentials: Differential[];
}

export default function HandicapPage() {
  const router = useRouter();
  const { supabase, user } = useSupabase();

  const [data, setData] = useState<HandicapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHandicapData() {
      if (!supabase || !user) return;

      try {
        setLoading(true);

        // Fetch profile with handicap
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_handicap_index')
          .eq('id', user.id)
          .single();

        // Fetch handicap history
        const { data: historyData } = await supabase
          .from('handicap_records')
          .select('calculated_at, handicap_index')
          .eq('user_id', user.id)
          .order('calculated_at', { ascending: false })
          .limit(50);

        // Fetch score differentials
        const { data: diffData } = await supabase
          .from('handicap_records')
          .select(`
            id,
            handicap_index,
            calculated_at,
            round_id,
            rounds (
              id,
              round_date,
              courses ( name )
            )
          `)
          .eq('user_id', user.id)
          .order('calculated_at', { ascending: false })
          .limit(20);

        const history: HandicapEntry[] = (historyData ?? []).map((h: any) => ({
          date: h.calculated_at,
          handicapIndex: h.handicap_index,
        }));

        const differentials: Differential[] = (diffData ?? []).map(
          (d: any) => ({
            roundId: d.round_id,
            date: d.rounds?.round_date ?? '',
            courseName: d.rounds?.courses?.name ?? 'Unknown',
            teeBoxName: '',
            grossScore: 0,
            courseRating: 0,
            slope: 0,
            differential: d.handicap_index,
            isUsed: true,
          })
        );

        const handicapValues = history.map((h) => h.handicapIndex);

        setData({
          currentHandicap: profile?.current_handicap_index ?? null,
          lowHandicap:
            handicapValues.length > 0 ? Math.min(...handicapValues) : null,
          highHandicap:
            handicapValues.length > 0 ? Math.max(...handicapValues) : null,
          totalRounds: differentials.length,
          eligibleRounds: differentials.length,
          usedDifferentials: differentials.filter((d) => d.isUsed).length,
          history,
          differentials,
        });
      } catch (err) {
        console.error('Failed to load handicap data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHandicapData();
  }, [supabase, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Unable to load handicap data</p>
      </div>
    );
  }

  // Prepare chart data (simple bar representation)
  const chartEntries = [...data.history].reverse().slice(-20);
  const maxHandicap = chartEntries.length > 0
    ? Math.max(...chartEntries.map((e) => e.handicapIndex))
    : 36;
  const minHandicap = chartEntries.length > 0
    ? Math.min(...chartEntries.map((e) => e.handicapIndex))
    : 0;
  const range = maxHandicap - minHandicap || 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/profile')}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Profile
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Handicap Index</h1>
      </div>

      {/* Current handicap */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Current
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {data.currentHandicap !== null
                ? data.currentHandicap.toFixed(1)
                : 'N/A'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Low
            </p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {data.lowHandicap !== null ? data.lowHandicap.toFixed(1) : '-'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              High
            </p>
            <p className="text-3xl font-bold text-red-500 mt-1">
              {data.highHandicap !== null ? data.highHandicap.toFixed(1) : '-'}
            </p>
          </div>
        </Card>
      </div>

      {/* Handicap trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Handicap Trend</CardTitle>
          <CardDescription>
            Your handicap index over time
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          {chartEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Not enough rounds to show trend
            </p>
          ) : (
            <div className="space-y-1">
              {/* Y-axis labels and bars */}
              <div className="flex items-end gap-1 h-40">
                {chartEntries.map((entry, idx) => {
                  const height =
                    ((entry.handicapIndex - minHandicap) / range) * 100;
                  const barHeight = Math.max(4, 100 - height);

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <div className="text-[9px] text-gray-500 mb-1">
                        {entry.handicapIndex.toFixed(1)}
                      </div>
                      <div
                        className="w-full bg-green-500 rounded-t-sm min-h-[4px] transition-all"
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex gap-1">
                {chartEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-[8px] text-gray-400 truncate"
                  >
                    {idx === 0 ||
                    idx === chartEntries.length - 1 ||
                    idx === Math.floor(chartEntries.length / 2)
                      ? new Date(entry.date).toLocaleDateString('en-US', {
                          month: 'short',
                        })
                      : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Calculation details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calculation Details</CardTitle>
          <CardDescription>
            Based on best {data.usedDifferentials} of {data.eligibleRounds}{' '}
            eligible rounds
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-500 mb-3 p-3 bg-gray-50 rounded-lg">
            <p>
              <strong>Formula:</strong> Handicap Index = (Average of lowest
              differentials) x 0.96
            </p>
            <p className="mt-1">
              <strong>Differential:</strong> (113 / Slope) x (Gross Score -
              Course Rating)
            </p>
          </div>

          {data.usedDifferentials > 0 && data.differentials.length > 0 && (
            <div className="space-y-1 mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Differentials Used in Calculation
              </p>
              {data.differentials
                .filter((d) => d.isUsed)
                .map((diff) => (
                  <div
                    key={diff.roundId}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-gray-700">{diff.courseName}</span>
                    <span className="font-mono text-gray-900 font-medium">
                      {diff.differential.toFixed(1)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Card>

      {/* Full differential history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Differential History</CardTitle>
          <CardDescription>
            All {data.differentials.length} scoring records
          </CardDescription>
        </CardHeader>
        <div className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">
                    Date
                  </th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">
                    Course
                  </th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500">
                    Score
                  </th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500">
                    Rating/Slope
                  </th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500">
                    Diff
                  </th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-500">
                    Used
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.differentials.map((diff) => (
                  <tr
                    key={diff.roundId}
                    className={`border-b border-gray-100 ${
                      diff.isUsed ? 'bg-green-50' : ''
                    }`}
                  >
                    <td className="py-2 px-2 text-gray-600">
                      {new Date(diff.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2 px-2 text-gray-900 font-medium">
                      {diff.courseName}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-gray-900">
                      {diff.grossScore}
                    </td>
                    <td className="py-2 px-2 text-center text-gray-600">
                      {diff.courseRating}/{diff.slope}
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-medium text-gray-900">
                      {diff.differential.toFixed(1)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {diff.isUsed && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Used
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.differentials.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No score differentials recorded yet. Complete some rounds to start
              tracking your handicap.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
