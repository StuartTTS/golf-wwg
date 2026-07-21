'use server';

import { randomBytes } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createRoundSchema, createSoloRoundSchema } from '@golf/core';
import { sendEmail, escapeHtml } from '@/lib/email';

/**
 * "Tee It Up Now" (Type A). Start a solo round with no group ceremony: it hangs
 * off the caller's personal group and opens already in progress. See
 * docs/phase1-type-a-spec.md.
 */
export async function createSoloRound(input: { courseId: string; teeBoxId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createSoloRoundSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  // Resolve (or lazily create) the caller's personal group.
  const { data: groupId, error: gErr } = await supabase.rpc(
    'get_or_create_personal_group'
  );
  if (gErr || !groupId) {
    console.error('Personal group error:', gErr);
    return { error: 'Could not start round' };
  }

  // Course handicap from profile index + selected tee slope (same math as createRound).
  const [{ data: profile }, { data: teeBox }] = await Promise.all([
    supabase.from('profiles').select('current_handicap_index').eq('id', user.id).single(),
    supabase.from('tee_boxes').select('slope_rating').eq('id', parsed.data.teeBoxId).single(),
  ]);
  const idx = profile?.current_handicap_index ?? null;
  const courseHcp =
    idx != null && teeBox ? Math.round(idx * (teeBox.slope_rating / 113)) : null;

  // Create the round already in progress — solo has no RSVP/upcoming stage.
  const today = new Date().toISOString().slice(0, 10);
  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      group_id: groupId,
      course_id: parsed.data.courseId,
      tee_box_id: parsed.data.teeBoxId,
      round_date: today,
      round_type: 'solo',
      status: 'in_progress',
      scoring_mode: 'shared',
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !round) {
    console.error('Create solo round error:', error);
    return { error: 'Could not start round' };
  }

  // Add the sole player (the creator).
  const { error: rpError } = await supabase.from('round_players').insert({
    round_id: round.id,
    user_id: user.id,
    tee_box_id: parsed.data.teeBoxId,
    handicap_index_at_round: idx,
    course_handicap: courseHcp,
    playing_handicap: courseHcp,
    status: 'playing',
  });
  if (rpError) {
    console.error('Add solo player error:', rpError);
    return { error: 'Could not start round' };
  }

  return { success: true, roundId: round.id };
}

// ---- Confirmation & lock/unlock (see docs/round-confirmation-lock.md) ------

/** Tier 1: confirm a single scorecard (self / flight scorer / scorekeeper / Commish). */
export async function confirmScorecard(roundPlayerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase.rpc('confirm_scorecard', {
    p_round_player_id: roundPlayerId,
  });
  if (error) {
    console.error('Confirm scorecard error:', error);
    return { error: 'Could not confirm scorecard' };
  }
  return { success: true };
}

/** Unlock a single scorecard to correct an error (mirror of confirm authority). */
export async function unlockScorecard(roundPlayerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase.rpc('unlock_scorecard', {
    p_round_player_id: roundPlayerId,
  });
  if (error) {
    console.error('Unlock scorecard error:', error);
    return { error: 'Could not unlock scorecard' };
  }
  return { success: true };
}

/** Tier 3: Commish final sign-off. Auto-confirms open cards → round counts. */
export async function finalizeRound(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase.rpc('finalize_round', { p_round_id: roundId });
  if (error) {
    console.error('Finalize round error:', error);
    return {
      error: String(error.message ?? '').includes('Only the Commish')
        ? 'Only the Commish can finalize this round'
        : 'Could not finalize round',
    };
  }
  return { success: true };
}

/** Reopen a finalized round (Commish). Cards stay locked until individually unlocked. */
export async function unfinalizeRound(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { error } = await supabase.rpc('unfinalize_round', { p_round_id: roundId });
  if (error) {
    console.error('Unfinalize round error:', error);
    return { error: 'Could not reopen round' };
  }
  return { success: true };
}

export async function createRound(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = createRoundSchema.safeParse({
    groupId: formData.get('groupId'),
    courseId: formData.get('courseId'),
    teeBoxId: formData.get('teeBoxId'),
    roundDate: formData.get('roundDate'),
    teeTime: formData.get('teeTime') || undefined,
    scoringMode: formData.get('scoringMode') || undefined,
    scorekeeperId: formData.get('scorekeeperId') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      group_id: parsed.data.groupId,
      course_id: parsed.data.courseId,
      tee_box_id: parsed.data.teeBoxId,
      round_date: parsed.data.roundDate,
      tee_time: parsed.data.teeTime ?? null,
      status: 'upcoming',
      scoring_mode: parsed.data.scoringMode ?? 'shared',
      scorekeeper_id: parsed.data.scorekeeperId ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }

  // Read selected player IDs from the wizard
  const selectedPlayerIds = formData.getAll('playerIds') as string[];
  const selectedSet = new Set(selectedPlayerIds);

  // Fetch slope rating from the round's default tee box for handicap calculations
  const { data: defaultTeeBox } = await supabase
    .from('tee_boxes')
    .select('slope_rating')
    .eq('id', parsed.data.teeBoxId)
    .single();
  const slopeRating = defaultTeeBox?.slope_rating ?? null;

  // Fetch handicap indices for all selected players (including creator)
  const allPlayerIds = selectedSet.has(user.id)
    ? selectedPlayerIds
    : [user.id, ...selectedPlayerIds];
  const { data: playerProfiles } = await supabase
    .from('profiles')
    .select('id, current_handicap_index')
    .in('id', allPlayerIds);
  const handicapMap = new Map<string, number | null>();
  for (const p of playerProfiles ?? []) {
    handicapMap.set(p.id, p.current_handicap_index);
  }

  // Helper: compute course handicap from handicap index and slope
  const calcCourseHandicap = (handicapIndex: number | null | undefined): number | null => {
    if (handicapIndex == null || slopeRating == null) return null;
    return Math.round(handicapIndex * (slopeRating / 113));
  };

  // Add creator as a player
  const creatorHandicap = handicapMap.get(user.id) ?? null;
  const creatorCourseHandicap = calcCourseHandicap(creatorHandicap);
  await supabase.from('round_players').insert({
    round_id: round.id,
    user_id: user.id,
    tee_box_id: parsed.data.teeBoxId,
    handicap_index_at_round: creatorHandicap,
    course_handicap: creatorCourseHandicap,
    playing_handicap: creatorCourseHandicap,
    status: 'registered',
  });

  // Add all other selected players as round_players directly
  const otherSelectedIds = selectedPlayerIds.filter((id) => id !== user.id);
  if (otherSelectedIds.length > 0) {
    const otherPlayers = otherSelectedIds.map((userId) => {
      const hcpIndex = handicapMap.get(userId) ?? null;
      const courseHcp = calcCourseHandicap(hcpIndex);
      return {
        round_id: round.id,
        user_id: userId,
        tee_box_id: parsed.data.teeBoxId,
        handicap_index_at_round: hcpIndex,
        course_handicap: courseHcp,
        playing_handicap: courseHcp,
        status: 'registered' as const,
      };
    });
    await supabase.from('round_players').insert(otherPlayers);

    // Auto-accept any pre-existing pending invitations for selected players
    // (e.g. from a previous round creation that was re-done)
    const { data: selectedEmails } = await supabase
      .from('profiles')
      .select('email')
      .in('id', otherSelectedIds);

    if (selectedEmails && selectedEmails.length > 0) {
      await supabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('round_id', round.id)
        .eq('type', 'round')
        .eq('status', 'pending')
        .in('email', selectedEmails.map((p) => p.email).filter(Boolean));
    }
  }

  // Fetch all group members (excluding creator) for invitations + notifications
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, profiles(email)')
    .eq('group_id', parsed.data.groupId)
    .neq('user_id', user.id);

  // Only create invitations for members NOT already selected as players
  const unselectedMembers = (members ?? []).filter(
    (m) => !selectedSet.has(m.user_id)
  );

  // Fetch shared context for email + push notifications
  const { data: course } = await supabase
    .from('courses')
    .select('name')
    .eq('id', parsed.data.courseId)
    .single();

  const { data: group } = await supabase
    .from('groups')
    .select('name')
    .eq('id', parsed.data.groupId)
    .single();

  const { data: organizer } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const courseName = course?.name ?? 'the course';
  const groupName = group?.name ?? 'your group';
  const organizerName = organizer?.display_name ?? 'Someone';
  const roundDate = new Date(parsed.data.roundDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  if (unselectedMembers.length > 0) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitations = unselectedMembers.map((m) => ({
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

    // Send RSVP emails to unselected members
    if (createdInvites && createdInvites.length > 0) {
      const { data: invitationsWithTokens } = await supabase
        .from('invitations')
        .select('id, email, token')
        .in('id', createdInvites.map(i => i.id));

      if (invitationsWithTokens && invitationsWithTokens.length > 0) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const safeCourseName = escapeHtml(courseName);
        const safeGroupName = escapeHtml(groupName);
        const safeOrganizerName = escapeHtml(organizerName);
        const safeTeeTime = parsed.data.teeTime ? escapeHtml(parsed.data.teeTime) : '';

        let failCount = 0;
        for (const inv of invitationsWithTokens) {
          const rsvpUrl = `${siteUrl}/rounds/${round.id}/rsvp?token=${inv.token}`;
          try {
            await sendEmail(
              inv.email,
              `Round scheduled: ${courseName} on ${roundDate}`,
              `
                <h2>${safeOrganizerName} scheduled a round!</h2>
                <p><strong>Group:</strong> ${safeGroupName}</p>
                <p><strong>Course:</strong> ${safeCourseName}</p>
                <p><strong>Date:</strong> ${roundDate}</p>
                ${safeTeeTime ? `<p><strong>Tee Time:</strong> ${safeTeeTime}</p>` : ''}
                <p style="margin-top:24px;">
                  <a href="${rsvpUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:white;text-decoration:none;border-radius:6px;">
                    RSVP Now
                  </a>
                </p>
                <p>Or copy this link: ${rsvpUrl}</p>
                <p style="color:#888;font-size:12px;">This invitation expires in 7 days.</p>
              `
            );
          } catch (err) {
            console.error(`Failed to send round notification to ${inv.email}:`, err);
            failCount++;
          }
        }

        if (failCount > 0) {
          return { success: true, roundId: round.id, warning: `Round created but failed to send ${failCount} notification email(s).` };
        }
      }
    }
  }

  // Send push notifications to all group members except creator
  const notifyUserIds = (members ?? []).map(m => m.user_id).filter(id => id !== user.id);
  if (notifyUserIds.length > 0) {
    try {
      const { sendPushToUsers } = await import('@/lib/push');
      await sendPushToUsers(notifyUserIds, {
        title: 'New Round Scheduled',
        body: `${organizerName} scheduled a round at ${courseName} on ${roundDate}`,
        url: `/rounds/${round.id}`,
      });
    } catch (err) {
      console.error('Push notification error:', err);
    }
  }

  return { success: true, roundId: round.id };
}

export async function addPlayerToRound(roundId: string, userId: string, teeBoxId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  // Get player's current handicap
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_handicap_index')
    .eq('id', userId)
    .single();

  // Get tee box info for course handicap calculation
  const { data: teeBox } = await supabase
    .from('tee_boxes')
    .select('slope_rating, course_rating')
    .eq('id', teeBoxId)
    .single();

  let courseHandicap: number | null = null;
  if (profile?.current_handicap_index && teeBox) {
    courseHandicap = Math.round(
      profile.current_handicap_index * (teeBox.slope_rating / 113)
    );
  }

  const { error } = await supabase.from('round_players').insert({
    round_id: roundId,
    user_id: userId,
    tee_box_id: teeBoxId,
    handicap_index_at_round: profile?.current_handicap_index ?? null,
    course_handicap: courseHandicap,
    playing_handicap: courseHandicap, // Will be adjusted per game format
    status: 'registered',
  });

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function removePlayerFromRound(roundId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  const { error } = await supabase
    .from('round_players')
    .delete()
    .eq('round_id', roundId)
    .eq('user_id', userId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }
  return { success: true };
}

export async function startRound(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  const { error } = await supabase
    .from('rounds')
    .update({ status: 'in_progress' })
    .eq('id', roundId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }

  // Update all registered players to 'playing'
  await supabase
    .from('round_players')
    .update({ status: 'playing' })
    .eq('round_id', roundId)
    .in('status', ['registered', 'confirmed']);

  // Send push notifications to all players (exclude the user who started the round)
  const { data: roundPlayers } = await supabase
    .from('round_players')
    .select('user_id')
    .eq('round_id', roundId)
    .not('user_id', 'is', null);

  if (roundPlayers && roundPlayers.length > 0) {
    const playerIds = roundPlayers.map(p => p.user_id!).filter(id => id !== user.id);
    if (playerIds.length > 0) {
      try {
        const { sendPushToUsers } = await import('@/lib/push');
        await sendPushToUsers(playerIds, {
          title: 'Round Started!',
          body: 'A round you\'re playing in has started. Open the scorecard.',
          url: `/rounds/${roundId}/scorecard`,
        });
      } catch (err) {
        console.error('Push notification error:', err);
      }
    }
  }

  return { success: true };
}

export async function completeRound(roundId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  const { error } = await supabase
    .from('rounds')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', roundId);

  if (error) {
    console.error('Action error:', error);
    return { error: 'An error occurred. Please try again.' };
  }

  // Update all playing players to 'completed'
  await supabase
    .from('round_players')
    .update({ status: 'completed' })
    .eq('round_id', roundId)
    .eq('status', 'playing');

  return { success: true };
}

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
    .select('id, round_id, group_id, email, status, expires_at')
    .eq('token', token)
    .eq('type', 'round')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!invitation || !invitation.round_id) {
    return { error: 'Invalid or expired invitation' };
  }

  // Verify the authenticated user's email matches the invitation
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { error: 'This invitation was sent to a different email address' };
  }

  // Get round details for tee_box_id and course_id
  const { data: round } = await supabase
    .from('rounds')
    .select('tee_box_id, course_id')
    .eq('id', invitation.round_id)
    .single();

  if (!round) return { error: 'Round not found' };

  // Get player handicap info and preferred tee tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_handicap_index, default_tee_tier')
    .eq('id', user.id)
    .single();

  // Determine the tee box to assign: prefer player's tier, fall back to round default
  let assignedTeeBoxId = round.tee_box_id;
  let assignedSlopeRating: number | null = null;

  if (profile?.default_tee_tier) {
    // Fetch course tee boxes to match player's preferred tier
    const { data: courseTeeBoxes } = await supabase
      .from('tee_boxes')
      .select('id, tier, slope_rating, course_rating')
      .eq('course_id', round.course_id)
      .not('tier', 'is', null)
      .order('tier', { ascending: true });

    if (courseTeeBoxes && courseTeeBoxes.length > 0) {
      const exact = courseTeeBoxes.find(t => t.tier === profile.default_tee_tier);
      const match = exact ?? courseTeeBoxes.reduce((prev, curr) =>
        Math.abs((curr.tier ?? 0) - profile.default_tee_tier!) < Math.abs((prev.tier ?? 0) - profile.default_tee_tier!)
          ? curr : prev
      );
      assignedTeeBoxId = match.id;
      assignedSlopeRating = match.slope_rating;
    }
  }

  // If we didn't get slope from tier matching, fetch slope from the assigned tee box
  if (assignedSlopeRating == null) {
    const { data: teeBox } = await supabase
      .from('tee_boxes')
      .select('slope_rating, course_rating')
      .eq('id', assignedTeeBoxId)
      .single();
    assignedSlopeRating = teeBox?.slope_rating ?? null;
  }

  let courseHandicap: number | null = null;
  if (profile?.current_handicap_index != null && assignedSlopeRating != null) {
    courseHandicap = Math.round(
      profile.current_handicap_index * (assignedSlopeRating / 113)
    );
  }

  // Add player to round first (upsert in case they were already invited)
  const { error: insertError } = await supabase.from('round_players').upsert({
    round_id: invitation.round_id,
    user_id: user.id,
    tee_box_id: assignedTeeBoxId,
    handicap_index_at_round: profile?.current_handicap_index ?? null,
    course_handicap: courseHandicap,
    playing_handicap: courseHandicap,
    status: 'registered',
  }, { onConflict: 'round_id,user_id' });

  if (insertError) {
    console.error('Failed to add player to round:', insertError);
    return { error: 'Failed to join round' };
  }

  // Mark invitation as accepted only after player was successfully added
  await supabase
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id);

  return { success: true, roundId: invitation.round_id };
}

export async function addGuestToRound(roundId: string, guestName: string, guestHandicap: number | null, teeBoxId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!guestName?.trim()) return { error: 'Guest name is required' };

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  // Must be round creator or group admin
  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  // Calculate course handicap for guest
  let courseHandicap: number | null = null;
  if (guestHandicap != null) {
    const { data: teeBox } = await supabase
      .from('tee_boxes')
      .select('slope_rating')
      .eq('id', teeBoxId)
      .single();
    if (teeBox) {
      courseHandicap = Math.round(guestHandicap * (teeBox.slope_rating / 113));
    }
  }

  const { data: roundPlayer, error } = await supabase.from('round_players').insert({
    round_id: roundId,
    user_id: null,
    guest_name: guestName.trim(),
    guest_handicap_index: guestHandicap,
    tee_box_id: teeBoxId,
    handicap_index_at_round: guestHandicap,
    course_handicap: courseHandicap,
    playing_handicap: courseHandicap,
    status: 'registered',
  } as any).select('id').single();

  if (error) {
    console.error('Add guest error:', error);
    return { error: 'Failed to add guest player' };
  }

  return { success: true, roundPlayerId: roundPlayer.id };
}

export async function removeGuestFromRound(roundId: string, roundPlayerId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, group_id')
    .eq('id', roundId)
    .single();
  if (!round) return { error: 'Round not found' };

  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Not authorized' };

  const { error } = await supabase
    .from('round_players')
    .delete()
    .eq('id', roundPlayerId)
    .eq('round_id', roundId)
    .is('user_id', null); // Only allow deleting guest players

  if (error) {
    console.error('Remove guest error:', error);
    return { error: 'Failed to remove guest' };
  }

  return { success: true };
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

/**
 * Commish (round creator) or group admin designates the scorer for a tee-time
 * group (flight). Pass scorerId = null for "each player self-scores".
 */
export async function setFlightScorer(
  teeTimeGroupId: string,
  scorerId: string | null
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: group } = await supabase
    .from('tee_time_groups')
    .select('id, round_id, rounds(created_by, group_id)')
    .eq('id', teeTimeGroupId)
    .single();
  if (!group) return { error: 'Group not found' };

  const round = (group as any).rounds;
  let authorized = round.created_by === user.id;
  if (!authorized) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', round.group_id)
      .eq('user_id', user.id)
      .single();
    authorized = membership?.role === 'admin';
  }
  if (!authorized) return { error: 'Only the Commish can set a scorer' };

  const { error } = await supabase
    .from('tee_time_groups')
    .update({ scorer_id: scorerId })
    .eq('id', teeTimeGroupId);

  if (error) {
    console.error('Set flight scorer error:', error);
    return { error: 'Failed to set scorer' };
  }

  return { success: true };
}
