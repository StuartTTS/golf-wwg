# Fix Invite System Implementation Plan

**Goal:** Fix all invite flow bugs and add accept/decline UI for group invitations.

**Architecture:** Fix redirect chain bugs, add accept/decline UI for existing users (auto-accept for new), disable Supabase confirmation emails, clean up dead code.

---

## Task 1: Middleware — preserve query params in redirect

**File:** `apps/web/src/lib/supabase/middleware.ts`

**Problem:** When unauthenticated user hits `/rounds/123/rsvp?token=abc`, middleware redirects to `/login?redirect=/rounds/123/rsvp` — the `?token=abc` is lost.

**Fix:** Include full pathname + search params in the redirect value:
```ts
const fullPath = request.nextUrl.pathname + request.nextUrl.search;
const safeRedirect = fullPath.startsWith('/') && !fullPath.startsWith('//') ? fullPath : '/home';
```

---

## Task 2: Invite page — accept/decline UI + redirect fixes

**Files:**
- Modify: `apps/web/src/app/(auth)/invite/[token]/page.tsx`
- Create: `apps/web/src/app/(auth)/invite/[token]/invite-actions.tsx` (client component)
- Modify: `apps/web/src/lib/actions/auth.ts` (add `declineInvite`)

**Changes:**
1. Server page fetches invitation details (group name, inviter name) and renders UI
2. If not authenticated → redirect to register with properly encoded redirect URL
3. If authenticated + `profile_completed === false` → auto-accept (just registered for this invite)
4. If authenticated + profile complete → show group details with Accept/Decline buttons
5. Accept → calls `acceptInvite(token)` → redirect to `/groups/{groupId}`
6. Decline → calls `declineInvite(token)` → redirect to `/home`
7. Pass `groupId` to settings redirect: `/settings?setup=true&groupId={groupId}`

**Fix redirect encoding:**
```ts
// Before (broken):
`/register?redirect=/invite/${token}&email=${email}`
// After (fixed):
`/register?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(email)}`
```

**New `declineInvite` in auth.ts:**
- Verify user is logged in
- Fetch invitation by token (pending, not expired)
- Verify email matches
- Mark status as 'declined'
- Return success

---

## Task 3: Login/register — preserve email param

**Files:**
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`

**Changes:**
- Register "Sign in" link: pass email param to login
- Login "Sign up" link: pass email param to register
- Login page: pre-fill email if param provided

---

## Task 4: Settings — redirect to group after setup

**File:** `apps/web/src/app/(dashboard)/settings/page.tsx`

**Change:** Read `groupId` from query params. After setup save, redirect to `/groups/{groupId}` instead of `/home` (fall back to `/home` if no groupId).

---

## Manual Steps

- **Supabase Dashboard:** Authentication → Email → disable "Enable email confirmations"
- **Dead edge functions:** Consider deleting `supabase/functions/send-invitation/` and `supabase/functions/send-round-notification/` (emails now sent directly from server actions)
