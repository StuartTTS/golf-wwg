'use server';

import { randomBytes } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createRoundSchema } from '@golf/core';
import { sendEmail, escapeHtml } from '@/lib/email';

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

  // Parse per-player tee assignments (format: "userId:teeBoxId")
  const playerTeeEntries = formData.getAll('playerTeeBoxIds') as string[];
  const playerTeeMap = new Map<string, string>();
  for (const entry of playerTeeEntries) {
    const [userId, teeBoxId] = entry.split(':');
    if (userId && teeBoxId) playerTeeMap.set(userId, teeBoxId);
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

  // Add creator as a player (use per-player tee assignment if available)
  const creatorTeeBoxId = playerTeeMap.get(user.id) ?? parsed.data.teeBoxId;
  await supabase.from('round_players').insert({
    round_id: round.id,
    user_id: user.id,
    tee_box_id: creatorTeeBoxId,
    status: 'registered',
  });

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

    // Send notification emails directly via Microsoft Graph API
    if (createdInvites && createdInvites.length > 0) {
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

      const { data: invitationsWithTokens } = await supabase
        .from('invitations')
        .select('id, email, token')
        .in('id', createdInvites.map(i => i.id));

      if (invitationsWithTokens && invitationsWithTokens.length > 0) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const courseName = course?.name ?? 'the course';
        const groupName = group?.name ?? 'your group';
        const organizerName = organizer?.display_name ?? 'Someone';
        const roundDate = new Date(parsed.data.roundDate).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        });

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
