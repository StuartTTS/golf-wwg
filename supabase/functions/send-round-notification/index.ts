import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, escapeHtml } from '../_shared/email.ts';

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
        round_date, tee_time, created_by, group_id,
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

    // Authorize: only the round creator (Commish) or a group admin may send
    // round notifications. Without this, any authenticated user could email
    // RSVP links for arbitrary rounds/invitations.
    let authorized = round.created_by === user.id;
    if (!authorized && round.group_id) {
      const { data: membership } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', round.group_id)
        .eq('user_id', user.id)
        .maybeSingle();
      authorized = membership?.role === 'admin';
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch invitations with tokens — scoped to THIS round so a caller cannot
    // fan out emails for invitations belonging to other rounds/groups.
    const { data: invitations } = await supabase
      .from('invitations')
      .select('id, email, token')
      .eq('round_id', roundId)
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

    const safeCourseName = escapeHtml(course?.name ?? '');
    const safeGroupName = escapeHtml(group?.name ?? '');
    const safeOrganizerName = escapeHtml(organizer?.display_name ?? '');
    const safeTeeTime = round.tee_time ? escapeHtml(round.tee_time) : '';

    let sentCount = 0;
    for (const inv of invitations) {
      const rsvpUrl = `${siteUrl}/rounds/${roundId}/rsvp?token=${inv.token}`;
      try {
        await sendEmail(
          inv.email,
          `Round scheduled: ${course?.name} on ${roundDate}`,
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
