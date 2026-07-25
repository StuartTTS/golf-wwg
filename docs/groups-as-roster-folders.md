# Groups as Personal Roster Folders — Design

How Groups organize the Roster, and how they feed game setup **without adding
friction**. Companion to `roster-design.md`, `gameid-join-roles.md`, and the
Game Time flow.

---

## The model

- **Roster** = your master list of *people* (registered or unlinked contacts).
- **Group** = a **named, personal folder** — a saved subset of your roster
  ("Sunday Crew", "Night League", "Ryder Cup 2026").
  - **Owner-scoped / private.** Your groups are yours, like labels on phone
    contacts. My "Sunday Crew" ≠ yours. No invites, no sync, no shared state.
  - **Multi-membership.** A roster player can be in any number of groups.
  - **Can include unlinked contacts** (people not on the app), because members
    are roster entries, not registered users.

A group is essentially a **saved selection over the roster**.

---

## Core principle: a Group is a *default*, never a *constraint*

Groups exist to remove setup friction, not add it. When starting a game, a group
**pre-fills a sensible lineup**, and then everything is one tap to change.

### Start Game — player selection
Pick the source, then adjust:

```
Start Game → Players from:  [ Sunday Crew ▾ ]   (or “Full roster”, or “Start empty”)

Players  (12 of 12 selected)                 [ + Add player ]
 ☑ Mike    ☑ Chris   ☑ Dave
 ☑ Steve   ☑ Rob     ☐ Tom     ← tap to drop for this game
 ☑ Paul    ☑ Alex    ☑ Jim
 ☑ Rich    ☑ Kevin   ☑ Greg
```

1. **Pick source** — a **Group** (pre-selects its members) **or** the **full
   Roster** (all roster players listed) **or** start empty. Groups are optional.
2. **Pre-filled + selected** — from a group, its members come in checked. Zero
   setup for the normal week.
3. **Someone out?** Uncheck them. **Non-destructive** — they stay in the group
   for next time; they're just not in *this* game.
4. **＋ Add player** pulls from three sources, in order of likelihood:
   - already in the group (there by default),
   - the **rest of your roster** (the occasional who plays once a month),
   - **new player** (name + optional handicap) — created as a roster entry on the
     fly, so next time they're a one-tap add.

### Two conveniences
- **Editing a game never touches the group.** The group is the durable list; the
  game is this week's slice of it.
- **Promote occasional → regular.** If someone starts showing up every week, "Add
  to Sunday Crew" from their roster entry — now they're pre-selected going forward.

---

## Schema (migration `00027`)

```sql
roster_groups(id, owner_id → profiles, name, created_at, updated_at)
  unique (owner_id, lower(name))            -- one "Sunday Crew" per owner
roster_group_members(roster_group_id → roster_groups, roster_player_id → roster_players)
  primary key (roster_group_id, roster_player_id)   -- multi-membership
```
Owner-only RLS on both. Group membership references **roster entries**, so it can
hold unlinked contacts. Deleting a group or a roster player just drops the link.

---

## How groups feed the flows

- **Game Time (Type B):** pick a group → field pre-fills → edit → foursomes →
  games → GameID.
- **Cup (Type C):** a group ("Ryder Cup 2026") is the player pool the teams are
  drawn from.

The game/cup's actual participants are **`round_players`** (stamped with
`roster_player_id`) — separate from group membership, which is why unchecking
someone in setup doesn't disturb the group.

---

## Relationship to the existing (shared) `groups` table

Heads-up / transition note: the app already has a **`groups`** table that is a
*shared* entity — it hosts rounds and is the RLS/permission boundary (plus the
auto "personal group" from `00023`). That's a different job from these personal
folders.

- The personal folders here (`roster_groups`) are **new and distinct** — no
  migration risk to the existing shared groups.
- As **GameID/join-by-code** takes over "who can access a round" (participants +
  code, not group membership), the shared `groups` become vestigial and can be
  reconciled/retired over time. The personal folders are the go-forward "Groups."
- **Open decision (naming):** during transition there are two "Groups." For now
  the personal folders surface within the **Roster** experience; the legacy
  Manage → Groups stays until we retire it. Final call TBD.

---

## Build order

1. **`roster_groups` data + actions + roster-page UI** (create groups, assign
   roster players, multi-membership) — the foundation. ← building now
2. **Start-Game player picker** (source = Group / full Roster / empty →
   pre-fill → uncheck → ＋Add) — lands with the Game Time setup flow.
3. Reconcile/retire the legacy shared `groups`.
