import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RateLimitConfig {
  /** Unique key identifying the action + actor (e.g., "login:192.168.1.1" or "forgot-password:user@email.com") */
  key: string;
  /** Maximum number of attempts allowed in the window */
  maxAttempts: number;
  /** Time window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit({
  key,
  maxAttempts,
  windowSeconds,
}: RateLimitConfig): Promise<RateLimitResult> {
  const supabase = await createServerSupabaseClient();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Count recent attempts
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('timestamp', windowStart);

  const attempts = count ?? 0;
  const allowed = attempts < maxAttempts;

  if (allowed) {
    // Record this attempt
    await supabase.from('rate_limits').insert({ key });
  }

  // Occasionally clean up old entries (1 in 100 chance)
  if (Math.random() < 0.01) {
    await supabase.rpc('cleanup_rate_limits');
  }

  return {
    allowed,
    remaining: Math.max(0, maxAttempts - attempts - (allowed ? 1 : 0)),
  };
}
