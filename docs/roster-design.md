# Persistent Player Roster — Draft Design (for review)

**Status: DRAFT.** Phase 2 (Type B "Game Time") foundation. The roster is the
reusable list of people you play with, so you can add them to games in a tap and
(as Commish) pre-build foursomes that joiners later claim. Companion to
`gameid-join-roles.md` and `next-steps.md`.

> Today there is **no roster**: guests live only inside a single round
> (`round_players.guest_name`), with no cross-round identity. This design adds a
> persistent, owner-scoped roster and links round participation back to it.

---

## What it must do

1. A user keeps a personal list of players they've played with (their **roster**).
2. Roster entries can be **linked** to a real account or **unlinked** (a person
   who isn't on the app yet — name + handicap, maybe an email/GHIN later).
3. Add roster players to a round/game in one tap.
4. As Commish, **pre-build foursomes** from the roster; a joiner claims their slot
   by matching identity (email) when they enter the GameID.
5. Give guests a **cross-round identity** so stats can follow a person across
   rounds once they're on the app.

---

## Decisions proposed (please confirm)

| # | Decision | Proposed |
|---|----------|----------|
| D1 | **Ownership** | ✅ **Individual-owned** ("my roster"), `owner_id → profiles`. Confirmed — not everyone is friends with everyone, so a shared roster would leak contacts. Group-shared is deferred. |
| D2 | **Linked vs unlinked** | One table; `linked_user_id` nullable. Linked = a real profile; unlinked = a name/handicap/email-only contact. |
| D3 | **Handicap source of truth** | Linked → always the profile's live `current_handicap_index`. Unlinked → the roster's own `handicap_index`. |
| D4 | **Round linkage** | Add `round_players.roster_player_id` so every participation (registered *or* guest) points back to the persistent roster identity. |
| D5 | **Populating it** | ✅ **Opt-in prompt at join**: when you enter a GameID, offer to add your playing partners to your roster. Plus passive "Recent players" suggestions. Never a silent auto-add. |

---

## Schema (draft — next migration ~`00025`)

```sql
CREATE TABLE roster_players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- whose roster
  linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,          -- real account, if any
  display_name   TEXT NOT NULL,                                            -- owner's label / nickname
  email          TEXT,                                                     -- claim/invite matching
  handicap_index NUMERIC(4,1),                                             -- authoritative only when unlinked
  ghin_id        TEXT,                                                     -- reserved (future GHIN import)
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One entry per registered friend per owner.
CREATE UNIQUE INDEX idx_roster_owner_linked
  ON roster_players(owner_id, linked_user_id) WHERE linked_user_id IS NOT NULL;

-- Dedup unlinked contacts by email per owner.
CREATE UNIQUE INDEX idx_roster_owner_email
  ON roster_players(owner_id, lower(email)) WHERE email IS NOT NULL AND linked_user_id IS NULL;

CREATE INDEX idx_roster_owner ON roster_players(owner_id);

-- Link round participation (registered OR guest) to the persistent identity.
ALTER TABLE round_players
  ADD COLUMN roster_player_id UUID REFERENCES roster_players(id) ON DELETE SET NULL;
```

**Deletes:** owner deleted → roster cascades; linked profile deleted → entry stays
but goes unlinked (keeps the name); roster entry deleted → past `round_players`
keep their history, just lose the back-link.

---

## RLS

Owner-only, since a roster is personal:

```sql
ALTER TABLE roster_players ENABLE ROW LEVEL SECURITY;
-- SELECT / INSERT / UPDATE / DELETE all gated on owner_id = auth.uid().
```

No new exposure: linked entries reference profiles, whose handicap is already
world-readable (`profiles` SELECT is public). Unlinked entries are visible only to
the owner. Being on someone's roster grants that person no access to your data.

---

## How it plugs in

**Add to a round.** `addRosterPlayerToRound(roundId, rosterPlayerId)`:
- Linked entry → insert `round_players` with `user_id = linked_user_id`, live
  handicap from the profile, and `roster_player_id` stamped.
- Unlinked entry → insert as a **guest** (`user_id NULL`, `guest_name`,
  `guest_handicap_index` from the roster), also stamping `roster_player_id`.
This reuses the existing guest plumbing; the only new thing is the back-link.

**Commish pre-builds foursomes → joiner claims (ties to `gameid-join-roles.md`).**
- The Commish adds roster entries to the round and arranges flights. Unlinked
  entries carry an `email`.
- A joiner signs up + enters the GameID. **Match by email**: if the joiner's email
  equals the `email` on a roster-linked slot in that round, they **claim** it —
  set `round_players.user_id = joiner`, and **link the roster entry**
  (`linked_user_id = joiner`) so future rounds recognize them.
- No email match → the joiner lands in the "unassigned" pool for the Commish to
  place (per the join doc).

**Populating via the join prompt (primary).** When a user joins a game by GameID
and is placed, show an optional, opt-in step:

> **"Add your playing partners to your roster?"** — lists the other participants
> (their **foursome** by default, pre-checked; a "show whole field" toggle to add
> anyone in the game). Multi-select; skips anyone already on their roster.

On confirm: registered participants → **linked** entries (`linked_user_id`);
guests → **unlinked** entries (copy name + handicap). This is how a joiner builds
their roster passively, without manual entry, right after playing with people.

Adding is **one-directional and private** — a contacts model. The added person is
not notified and gains nothing; there is no new data exposure since profiles are
already world-readable. (So no consent step is needed — you're adding to *your*
private list, not theirs.) The prompt can also fire at **round end** for anyone
who wasn't a joiner (e.g. the Commish picking up new co-players), but join time is
the primary trigger.

**Recent-players suggestions (passive fallback).** `suggestRecentPlayers()` —
registered co-players from the owner's past rounds not already on the roster:
```sql
SELECT DISTINCT rp2.user_id
FROM round_players rp1
JOIN round_players rp2 ON rp2.round_id = rp1.round_id AND rp2.user_id <> rp1.user_id
WHERE rp1.user_id = auth.uid()
  AND rp2.user_id NOT IN (SELECT linked_user_id FROM roster_players
                          WHERE owner_id = auth.uid() AND linked_user_id IS NOT NULL);
```
Bootstraps an empty roster from history. (Guest-only co-players aren't suggested —
no identity to key on.)

---

## Server actions (sketch)

- `getRoster()` — owner's entries (+ suggestions).
- `addRosterPlayer({ displayName, email?, handicapIndex?, linkedUserId? })`
- `updateRosterPlayer(id, patch)` / `removeRosterPlayer(id)`
- `addRosterPlayerToRound(roundId, rosterPlayerId)`
- `linkRosterToUser(rosterPlayerId, userId)` — used by the claim flow.

---

## Future (noted, not designed here)

- **History merge:** when an unlinked entry becomes linked, reassign past guest
  `round_players` (same `roster_player_id`) to the new `user_id` so stats
  consolidate. `roster_player_id` makes this possible.
- **GHIN import** populates `handicap_index` / `ghin_id` (blocked; see
  `course-data-providers.md`).
- **Group-shared rosters** (a club's shared player pool).
- **Cup teams** (Phase 3) are built from roster entries.

---

## Resolved

- **Ownership (D1)** — individual-owned; group-shared deferred.
- **Population (D5)** — opt-in join-time prompt to add playing partners, + passive
  suggestions.

## Open questions for review

1. **Join-prompt scope** — default to pre-checking your **foursome** (opt-out), with
   a toggle to reveal the whole field? (Proposed: yes — avoids rostering strangers
   from a big field you never actually played with.)
2. **Claiming by email** — is email the right match key, or do you want the Commish
   to also be able to hand a joiner a specific slot manually (no email needed)?
3. **Unlinked handicap trust** — for a Commish-entered handicap on an unlinked
   player, do we let the player override it once they claim the slot?
4. **Guest naming collision** — allow two roster entries with the same
   `display_name` (e.g., two "Mike"s)? (Proposed: yes; dedup only on email /
   linked_user_id, not name.)
