# Product Tiers — Early Strategy Note

**Status: EARLY / placeholder.** A living note to capture the tiered product idea
(Basic / Mid / Top) so feature decisions can be tagged by tier as we design. Not a
committed plan — pricing, exact tier names, and the feature split are all TBD.

> Guiding principle so far: **identity and core play are free/basic; convenience,
> reach, and organizer power become paid.** Anything with a per-use external cost
> (SMS, and later things like live GHIN or premium course data) naturally lands in
> a paid tier.

---

## Tiers (working shape)

| Tier | Rough intent |
|------|--------------|
| **Basic** (free) | Solo tracking + join games. The full "Tee It Up Now" experience, scoring, stats, and joining someone else's game by code. |
| **Mid** | Organizer features — run Game Time games, roster, foursomes, share/copy invites. |
| **Top** | Power organizer + integrations — Cup/tournament running, integrated SMS-to-roster, and future paid integrations. |

Exact line placement is fluid; this table is a straw man to react to, not a decision.

---

## Candidate paid features (as they come up)

- **Integrated SMS-to-roster** — the app texts invites/GameIDs to roster members
  directly (vs. the free copy-invite / native share). Needs phone numbers on roster
  entries + an SMS provider (e.g. Twilio) + per-message billing → a paid feature.
  See `roster-design.md`, `gameid-join-roles.md`.
- **Cup / tournament mode** (Type C) — multi-round team events; high value, low
  frequency → a candidate top-tier / organizer feature. See `type-c-cup-notes.md`.
- **(future)** Live GHIN handicap sync, premium course-data providers — anything
  with licensing / per-lookup cost.

---

## What this means for building now

- **Don't hard-code tier gates yet.** Keep building features behind the existing
  functionality flags; add a tier/entitlement layer later once the split is real.
- **Tag features by likely tier** in their design docs as we go, so the eventual
  entitlement work is a mapping exercise, not an archaeology dig.
- **Free tier must stay genuinely useful** — solo tracking + joining games — so the
  network grows (joiners become organizers who upgrade).

---

## Open questions (later)

- Tier names + count (3 tiers? per-event one-off unlock vs. subscription?).
- Where exactly Game Time (Type B) sits — free with limits, or mid-tier.
- Billing model: subscription, per-event, per-organizer, or per-SMS credits.
