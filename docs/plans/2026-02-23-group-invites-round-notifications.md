# Group Invites & Round Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken group invitation acceptance, add round notification emails with RSVP, and integrate Microsoft Graph API for email delivery.

**Architecture:** Server actions handle invite/RSVP logic, Supabase Edge Functions send emails via Microsoft Graph API, existing `invitations` table supports both group and round invite types. RSVP pages are thin server components that delegate to client components for interactivity.

**Tech Stack:** Next.js 15 server actions, Supabase Edge Functions (Deno), Microsoft Graph API, Supabase RLS policies, Zod validation

---

## Task 1: Fix Group Invitation Acceptance Bug

**Files:**
- Modify: `apps/web/src/lib/actions/auth.ts:220-258` (acceptInvite function)

**Step 1: Fix acceptInvite to add user to group_members**

The current `acceptInvite()` marks the invitation as accepted but never inserts into `group_members`. Also, if no rows match the update (bad token, expired), Supabase doesn't error — it silently updates 0 rows.

Replace the entire `acceptInvite` function:

```typescript
export async function acceptInvite(token: string): Promise<AuthActionResult & { groupId?: string }> {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid invite token' };
  }

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit({
    key: `invite:${ip}`,
    maxAttempts: 10,
    windowSeconds: 3600,
  });
  if (!allowed) {
    return { error: 'Too many attempts. Please try again later.' };
  }

  const supabase = await createServerSupabaseClient();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { error: 'You must be logged in to accept an invite' };
  }

  const userId = sessionData.session.user.id;

  // Fetch the invitation first to get group_id and validate
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, group_id, status, expires_at')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invitation) {
    return { error: 'Invalid or expired invitation' };
  }

  // Mark as accepted
  const { error: updateError } = await supabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id);

  if (updateError) {
    return { error: 'Failed to accept invitation' };
  }

  // Add user to group_members
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: invitation.group_id,
      user_id: userId,
      role: 'member',
    });

  if (memberError) {
    // If unique constraint violation, user is already a member — that's fine
    if (!memberError.code?.includes('23505')) {
      console.error('Failed to add member:', memberError);
      return { error: 'Failed to join group' };
    }
  }

  return { success: true, groupId: invitation.group_id };
}
```

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS (return type is compatible — extends AuthActionResult)

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions/auth.ts
git commit -m "fix: add user to group_members when accepting invitation"
```

---

## Task 2: Fix Invite Redirect and Post-Accept Navigation

**Files:**
- Modify: `apps/web/src/app/(auth)/invite/[token]/page.tsx:75` (redirect parameter)
- Modify: `apps/web/src/app/(auth)/invite/[token]/invite-actions.tsx:28` (post-accept redirect)

**Step 1: Fix redirect parameter mismatch**

The invite page sends `returnTo` but login reads `redirect`. In `invite/[token]/page.tsx` line 75, change:

```typescript
// OLD:
redirect(`/login?returnTo=/invite/${token}`);

// NEW:
redirect(`/login?redirect=/invite/${token}`);
```

**Step 2: Update InviteActions to redirect to group page**

In `invite-actions.tsx`, the component needs the groupId to redirect. Update the component:

```typescript
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { acceptInvite, declineInvite } from '@/lib/actions/auth';

interface InviteActionsProps {
  token: string;
  groupId: string;
}

export default function InviteActions({ token, groupId }: InviteActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/groups/${result.groupId ?? groupId}`);
      router.refresh();
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      const result = await declineInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push('/home');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-golf border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleAccept}
          className="w-full bg-golf-600 hover:bg-golf-500 text-white font-semibold h-12 rounded-golf-lg"
          disabled={isPending}
        >
          {isPending ? 'Processing...' : 'Accept Invite'}
        </Button>
        <Button
          onClick={handleDecline}
          variant="ghost"
          className="w-full text-surface-400 hover:text-surface-300"
          disabled={isPending}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
```

**Step 3: Pass groupId to InviteActions in the parent page**

In `invite/[token]/page.tsx`, update the InviteActions render (around line 130):

```typescript
// OLD:
<InviteActions token={token} />

// NEW:
<InviteActions token={token} groupId={invite.group_id} />
```

**Step 4: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/(auth)/invite/
git commit -m "fix: correct invite redirect param and navigate to group after accept"
```

---

## Task 3: Database Migration — Add Invited/Declined Status to round_players

**Files:**
- Create: `supabase/migrations/00007_round_player_invite_status.sql`

**Step 1: Write the migration**

The current `round_players.status` CHECK constraint allows: `registered`, `confirmed`, `playing`, `completed`, `withdrawn`. We need to add `invited` and `declined` for the RSVP flow.

```sql
-- Add 'invited' and 'declined' to round_players status check constraint
ALTER TABLE round_players DROP CONSTRAINT IF EXISTS round_players_status_check;
ALTER TABLE round_players ADD CONSTRAINT round_players_status_check
  CHECK (status IN ('invited', 'registered', 'confirmed', 'declined', 'playing', 'completed', 'withdrawn'));

-- RLS: Allow users to insert themselves as a round player when accepting a round invitation
-- (They must have a valid pending invitation for this round)
CREATE POLICY "Users can join round via invitation"
  ON round_players FOR INSERT
  WITH CHECK (
    round_players.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.round_id = round_players.round_id
        AND invitations.type = 'round'
        AND invitations.email = (SELECT email FROM profiles WHERE id = auth.uid())
        AND invitations.status = 'pending'
    )
  );

-- RLS: Allow users to update their own round_player status (for RSVP accept/decline)
CREATE POLICY "Users can update own round player status"
  ON round_players FOR UPDATE
  USING (round_players.user_id = auth.uid());
```

**Step 2: Commit**

```bash
git add supabase/migrations/00007_round_player_invite_status.sql
git commit -m "feat: add invited/declined status to round_players for RSVP flow"
```

---

## Task 4: Round RSVP Server Actions

**Files:**
- Modify: `apps/web/src/lib/actions/rounds.ts` (add acceptRoundInvite, declineRoundInvite, notifyGroupMembers)

**Step 1: Add RSVP server actions**

Append to `apps/web/src/lib/actions/rounds.ts`:

```typescript
import { randomBytes } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';

export async function acceptRoundInvite(token: string) {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid token' };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Fetch the invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, round_id, group_id, status, expires_at')
    .eq('token', token)
    .eq('type', 'round')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invitation || !invitation.round_id) {
    return { error: 'Invalid or expired invitation' };
  }

  // Get round details for tee_box_id
  const { data: round } = await supabase
    .from('rounds')
    .select('tee_box_id')
    .eq('id', invitation.round_id)
    .single();

  if (!round) return { error: 'Round not found' };

  // Get player handicap info
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_handicap_index')
    .eq('id', user.id)
    .single();

  const { data: teeBox } = await supabase
    .from('tee_boxes')
    .select('slope_rating, course_rating')
    .eq('id', round.tee_box_id)
    .single();

  let courseHandicap: number | null = null;
  if (profile?.current_handicap_index && teeBox) {
    courseHandicap = Math.round(
      profile.current_handicap_index * (teeBox.slope_rating / 113)
    );
  }

  // Mark invitation as accepted
  await supabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id);

  // Add player to round (upsert in case they were already invited)
  const { error: insertError } = await supabase.from('round_players').upsert({
    round_id: invitation.round_id,
    user_id: user.id,
    tee_box_id: round.tee_box_id,
    handicap_index_at_round: profile?.current_handicap_index ?? null,
    course_handicap: courseHandicap,
    playing_handicap: courseHandicap,
    status: 'registered',
  }, { onConflict: 'round_id,user_id' });

  if (insertError) {
    console.error('Failed to add player to round:', insertError);
    return { error: 'Failed to join round' };
  }

  return { success: true, roundId: invitation.round_id };
}

export async function declineRoundInvite(token: string) {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid token' };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, round_id')
    .eq('token', token)
    .eq('type', 'round')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invitation) {
    return { error: 'Invalid or expired invitation' };
  }

  await supabase
    .from('invitations')
    .update({ status: 'declined' })
    .eq('id', invitation.id);

  return { success: true };
}
```

**Step 2: Update createRound to send invitations to all group members**

Modify the `createRound` function — after creating the round and adding the creator, create invitation records for all other group members and trigger the notification edge function:

```typescript
// After the existing "Add creator as a player" block, add:

// Fetch all group members (excluding creator)
const { data: members } = await supabase
  .from('group_members')
  .select('user_id, profiles(email)')
  .eq('group_id', parsed.data.groupId)
  .neq('user_id', user.id);

if (members && members.length > 0) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create invitation records for each member
  const invitations = members.map((m) => ({
    type: 'round' as const,
    group_id: parsed.data.groupId,
    round_id: round.id,
    email: (m.profiles as any)?.email ?? '',
    token: randomBytes(32).toString('hex'),
    invited_by: user.id,
    status: 'pending' as const,
    expires_at: expiresAt.toISOString(),
  }));

  const { data: createdInvites } = await supabase
    .from('invitations')
    .insert(invitations)
    .select('id');

  // Trigger notification emails (fire-and-forget)
  if (createdInvites) {
    supabase.functions.invoke('send-round-notification', {
      body: { roundId: round.id, invitationIds: createdInvites.map(i => i.id) },
    }).catch((err) => console.error('Failed to send round notifications:', err));
  }
}
```

**Step 3: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions/rounds.ts
git commit -m "feat: add round RSVP actions and auto-invite group members on round create"
```

---

## Task 5: RSVP Page UI

**Files:**
- Create: `apps/web/src/app/(dashboard)/rounds/[roundId]/rsvp/page.tsx`

**Step 1: Create the RSVP page**

This is a server component that fetches invitation + round details, then renders a client component for the accept/decline buttons.

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RsvpActions from './rsvp-actions';

interface RsvpPageProps {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function RsvpPage({ params, searchParams }: RsvpPageProps) {
  const { roundId } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Invalid Link</h1>
        <p className="mt-2 text-sm text-surface-300">This RSVP link is missing a token.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/rounds/${roundId}/rsvp?token=${token}`);
  }

  // Fetch invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, status, expires_at, round_id')
    .eq('token', token)
    .eq('type', 'round')
    .single();

  if (!invitation || invitation.round_id !== roundId) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Invalid Invitation</h1>
        <p className="mt-2 text-sm text-surface-300">
          This RSVP link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Already Responded</h1>
        <p className="mt-2 text-sm text-surface-300">
          You have already {invitation.status} this round invitation.
        </p>
      </div>
    );
  }

  // Fetch round details
  const { data: round } = await supabase
    .from('rounds')
    .select(`
      id, round_date, tee_time, status,
      courses(name),
      profiles!rounds_created_by_fkey(display_name),
      groups(name)
    `)
    .eq('id', roundId)
    .single();

  if (!round) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold text-surface-50">Round Not Found</h1>
        <p className="mt-2 text-sm text-surface-300">This round no longer exists.</p>
      </div>
    );
  }

  const course = round.courses as any;
  const organizer = round.profiles as any;
  const group = round.groups as any;

  // Fetch who already accepted
  const { data: acceptedPlayers } = await supabase
    .from('round_players')
    .select('profiles(display_name)')
    .eq('round_id', roundId)
    .in('status', ['registered', 'confirmed']);

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      <div className="text-center">
        <p className="text-sm text-surface-300">You're invited to a round</p>
        <h1 className="mt-2 text-2xl font-bold text-surface-50">
          {course?.name ?? 'Golf Round'}
        </h1>
      </div>

      <div className="rounded-golf border border-surface-600/50 bg-surface-700/50 p-5 space-y-3">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Group</dt>
            <dd className="mt-1 text-sm text-surface-100">{group?.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Date</dt>
            <dd className="mt-1 text-sm text-surface-100">
              {new Date(round.round_date).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
            </dd>
          </div>
          {round.tee_time && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Tee Time</dt>
              <dd className="mt-1 text-sm text-surface-100">{round.tee_time}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400">Organized by</dt>
            <dd className="mt-1 text-sm text-surface-100">{organizer?.display_name}</dd>
          </div>
        </dl>

        {acceptedPlayers && acceptedPlayers.length > 0 && (
          <div className="pt-3 border-t border-surface-600/50">
            <dt className="text-xs font-medium uppercase tracking-wide text-surface-400 mb-2">
              Playing ({acceptedPlayers.length})
            </dt>
            <div className="flex flex-wrap gap-2">
              {acceptedPlayers.map((p: any, i: number) => (
                <span key={i} className="text-xs bg-golf-900/40 text-golf-400 px-2 py-1 rounded-full">
                  {p.profiles?.display_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <RsvpActions token={token} roundId={roundId} />
    </div>
  );
}
```

**Step 2: Create the RsvpActions client component**

Create: `apps/web/src/app/(dashboard)/rounds/[roundId]/rsvp/rsvp-actions.tsx`

```typescript
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { acceptRoundInvite, declineRoundInvite } from '@/lib/actions/rounds';

interface RsvpActionsProps {
  token: string;
  roundId: string;
}

export default function RsvpActions({ token, roundId }: RsvpActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptRoundInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/rounds/${result.roundId ?? roundId}/scorecard`);
      router.refresh();
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      const result = await declineRoundInvite(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push('/home');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-golf border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleAccept}
          className="w-full bg-golf-600 hover:bg-golf-500 text-white font-semibold h-12 rounded-golf-lg"
          disabled={isPending}
        >
          {isPending ? 'Joining...' : "I'm In!"}
        </Button>
        <Button
          onClick={handleDecline}
          variant="ghost"
          className="w-full text-surface-400 hover:text-surface-300"
          disabled={isPending}
        >
          Can't Make It
        </Button>
      </div>
    </div>
  );
}
```

**Step 3: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/rounds/[roundId]/rsvp/
git commit -m "feat: add round RSVP page with accept/decline flow"
```

---

## Task 6: Microsoft Graph Email Utility (BLOCKED — needs Azure AD setup)

**Files:**
- Create: `supabase/functions/_shared/email.ts`

**Step 1: Create shared email utility**

```typescript
// Microsoft Graph API email sender using client credentials flow

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  // Return cached token if still valid (with 5min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  const tenantId = Deno.env.get('AZURE_TENANT_ID')!;
  const clientId = Deno.env.get('AZURE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET')!;

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Graph token: ${response.status} ${text}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  htmlBody: string
): Promise<void> {
  const token = await getGraphToken();
  const mailFrom = Deno.env.get('AZURE_MAIL_FROM')!;

  const recipients = Array.isArray(to) ? to : [to];

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailFrom}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: recipients.map((email) => ({
            emailAddress: { address: email },
          })),
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph sendMail failed: ${response.status} ${text}`);
  }
}
```

**Step 2: Commit**

```bash
git add supabase/functions/_shared/email.ts
git commit -m "feat: add Microsoft Graph email utility for edge functions"
```

---

## Task 7: Refactor send-invitation Edge Function (BLOCKED — needs Azure AD setup)

**Files:**
- Modify: `supabase/functions/send-invitation/index.ts`

**Step 1: Replace Resend with Graph API**

Replace the Resend `fetch` call (lines 84-104) with:

```typescript
import { sendEmail } from '../_shared/email.ts';

// Replace the Resend block with:
await sendEmail(
  invitation.email,
  `${inviter.display_name} invited you to join ${group.name} on Golf WWG`,
  `
    <h2>You've been invited to join ${group.name}!</h2>
    <p>${inviter.display_name} has invited you to join their golf group.</p>
    <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:white;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
    <p>Or copy this link: ${inviteUrl}</p>
    <p>This invitation expires in 7 days.</p>
  `
);
```

Remove the `RESEND_API_KEY` check — Graph API is always available when configured.

**Step 2: Commit**

```bash
git add supabase/functions/send-invitation/index.ts
git commit -m "refactor: switch send-invitation from Resend to Microsoft Graph"
```

---

## Task 8: Round Notification Edge Function (BLOCKED — needs Azure AD setup)

**Files:**
- Create: `supabase/functions/send-round-notification/index.ts`

**Step 1: Create the edge function**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';

interface RequestBody {
  roundId: string;
  invitationIds: string[];
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const { roundId, invitationIds } = (await req.json()) as RequestBody;

    // Verify caller is authenticated
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch round details
    const { data: round } = await supabase
      .from('rounds')
      .select(`
        round_date, tee_time,
        courses(name),
        groups(name),
        profiles!rounds_created_by_fkey(display_name)
      `)
      .eq('id', roundId)
      .single();

    if (!round) {
      return new Response(JSON.stringify({ error: 'Round not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch invitations with tokens
    const { data: invitations } = await supabase
      .from('invitations')
      .select('id, email, token')
      .in('id', invitationIds);

    if (!invitations || invitations.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000';
    const course = round.courses as any;
    const group = round.groups as any;
    const organizer = round.profiles as any;
    const roundDate = new Date(round.round_date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    let sentCount = 0;
    for (const inv of invitations) {
      const rsvpUrl = `${siteUrl}/rounds/${roundId}/rsvp?token=${inv.token}`;
      try {
        await sendEmail(
          inv.email,
          `Round scheduled: ${course?.name} on ${roundDate}`,
          `
            <h2>${organizer?.display_name} scheduled a round!</h2>
            <p><strong>Group:</strong> ${group?.name}</p>
            <p><strong>Course:</strong> ${course?.name}</p>
            <p><strong>Date:</strong> ${roundDate}</p>
            ${round.tee_time ? `<p><strong>Tee Time:</strong> ${round.tee_time}</p>` : ''}
            <p style="margin-top:24px;">
              <a href="${rsvpUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:white;text-decoration:none;border-radius:6px;">
                RSVP Now
              </a>
            </p>
            <p>Or copy this link: ${rsvpUrl}</p>
            <p style="color:#888;font-size:12px;">This invitation expires in 7 days.</p>
          `
        );
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${inv.email}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/send-round-notification/
git commit -m "feat: add send-round-notification edge function"
```

---

## Task 9: Round Detail Page — RSVP Status Panel

**Files:**
- Modify: `apps/web/src/app/(dashboard)/rounds/[roundId]/scorecard/page.tsx` (or the round detail page)

**Step 1: Add RSVP status panel**

On the round detail page, fetch invitation statuses and show who accepted, declined, and hasn't responded:

```typescript
// Fetch RSVP status
const { data: roundInvitations } = await supabase
  .from('invitations')
  .select('email, status, profiles!invitations_email_fkey(display_name)')
  .eq('round_id', roundId)
  .eq('type', 'round');
```

Render a status panel showing:
- Accepted (green badges)
- Declined (red badges)
- Pending (gray badges)

This task depends on reading the exact structure of the round detail page to integrate properly. The implementation should match the existing page patterns.

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/rounds/
git commit -m "feat: show RSVP status panel on round detail page"
```

---

## Dependency Graph

```
Task 1 (fix acceptInvite) ──→ Task 2 (fix redirect + navigation)
                                        │
Task 3 (DB migration) ────────→ Task 4 (RSVP server actions) ──→ Task 5 (RSVP page)
                                        │
                                        └──→ Task 9 (RSVP status panel)

Task 6 (Graph email utility) ──→ Task 7 (refactor send-invitation)
                               └──→ Task 8 (send-round-notification)
```

**Tasks 1-5, 9**: No Azure AD dependency — can start immediately.
**Tasks 6-8**: BLOCKED until Azure AD app registration is complete.

---

## Azure AD Setup Checklist (manual — user does this)

1. Go to Azure Portal → Entra ID → App registrations → New registration
2. Name: "Golf WWG Email" (or similar)
3. Supported account types: Single tenant
4. After creation, note the **Application (client) ID** and **Directory (tenant) ID**
5. Go to API permissions → Add permission → Microsoft Graph → Application → `Mail.Send`
6. Click "Grant admin consent"
7. Go to Certificates & secrets → New client secret → Copy the **Value**
8. Set Supabase secrets:
   ```bash
   npx supabase secrets set AZURE_TENANT_ID=your-tenant-id
   npx supabase secrets set AZURE_CLIENT_ID=your-client-id
   npx supabase secrets set AZURE_CLIENT_SECRET=your-secret-value
   npx supabase secrets set AZURE_MAIL_FROM=your-mailbox@yourdomain.com
   npx supabase secrets set SITE_URL=https://golf-wwg.vercel.app
   ```
