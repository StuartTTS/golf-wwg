'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function createSettlements(
  roundId: string,
  settlements: { payerId: string; payeeId: string; amount: number }[]
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const rows = settlements.map((s) => ({
    round_id: roundId,
    payer_id: s.payerId,
    payee_id: s.payeeId,
    amount: s.amount,
    status: 'pending' as const,
  }));

  const { error } = await supabase.from('settlements').insert(rows);
  if (error) return { error: error.message };
  return { success: true };
}

export async function markSettled(settlementId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('settlements')
    .update({ status: 'settled' })
    .eq('id', settlementId);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Simplify debts between players.
 * Takes a list of { playerId, amount } where positive = won, negative = lost.
 * Returns simplified settlement transactions.
 */
export function simplifyDebts(
  balances: { playerId: string; amount: number }[]
): { payerId: string; payeeId: string; amount: number }[] {
  const settlements: { payerId: string; payeeId: string; amount: number }[] = [];
  const debtors = balances
    .filter((b) => b.amount < 0)
    .map((b) => ({ ...b, amount: Math.abs(b.amount) }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    if (payment > 0.01) {
      settlements.push({
        payerId: debtors[i].playerId,
        payeeId: creditors[j].playerId,
        amount: Math.round(payment * 100) / 100,
      });
    }
    debtors[i].amount -= payment;
    creditors[j].amount -= payment;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return settlements;
}
