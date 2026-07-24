'use client';

import { useEffect, useState } from 'react';
import { ensureRoundShareCode } from '@/lib/actions/rounds';
import { Button } from '@/components/ui';

/**
 * Commish "Share" — get-or-create the round's share code and offer copy / native
 * share of a prefilled invite. Identity is email; reach is a text the Commish
 * sends themselves (premium integrated SMS is later). See docs/gameid-join-roles.md.
 */
export function ShareGameButton({ roundId }: { roundId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  async function handleOpen() {
    setOpen(true);
    if (code) return;
    setLoading(true);
    setError(null);
    const res = (await ensureRoundShareCode(roundId)) as any;
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setCode(res.code);
  }

  const joinUrl = code && origin ? `${origin}/join?code=${code}` : '';
  const message = code ? `Join my golf game — ${joinUrl} (code: ${code})` : '';

  async function copyInvite() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    if (!message) return;
    try {
      await navigator.share({ text: message });
    } catch {
      /* user cancelled or unsupported */
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        Share
      </Button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative m-4 w-full max-w-sm space-y-4 rounded-2xl bg-surface-800 p-6">
            <h3 className="text-lg font-bold text-surface-50">Invite players</h3>

            {loading && <p className="text-sm text-surface-300">Generating code…</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}

            {code && (
              <>
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400">
                    Game code
                  </p>
                  <p className="text-3xl font-bold tracking-[0.3em] text-golf-400">{code}</p>
                </div>
                {joinUrl && <p className="break-all text-xs text-surface-400">{joinUrl}</p>}
                <div className="flex gap-2">
                  <Button onClick={copyInvite} className="flex-1">
                    {copied ? 'Copied!' : 'Copy invite'}
                  </Button>
                  {canShare && (
                    <Button variant="outline" onClick={nativeShare} className="flex-1">
                      Share…
                    </Button>
                  )}
                </div>
                <p className="text-center text-[11px] text-surface-500">
                  Friends sign up, then join with this code.
                </p>
              </>
            )}

            <button
              onClick={() => setOpen(false)}
              className="w-full pt-1 text-sm text-surface-300 hover:text-surface-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
