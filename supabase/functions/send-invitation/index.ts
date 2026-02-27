import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, escapeHtml } from '../_shared/email.ts';

interface RequestBody {
  invitationId: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Verify authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { invitationId } = (await req.json()) as RequestBody;

    // Create a client with the user's JWT to respect RLS
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the user's identity
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for actual operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get invitation details
    const { data: invitation, error } = await supabase
      .from('invitations')
      .select(`
        *,
        groups (name),
        profiles!invitations_invited_by_fkey (display_name)
      `)
      .eq('id', invitationId)
      .single();

    if (error || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is a group admin for this invitation's group
    const { data: membership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', invitation.group_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Not authorized to send invitations for this group' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const group = invitation.groups as any;
    const inviter = invitation.profiles as any;
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000';
    const inviteUrl = `${siteUrl}/invite/${invitation.token}`;

    const safeGroupName = escapeHtml(group.name);
    const safeInviterName = escapeHtml(inviter.display_name);
    await sendEmail(
      invitation.email,
      `${inviter.display_name} invited you to join ${group.name} on Golf WWG`,
      `
        <h2>You've been invited to join ${safeGroupName}!</h2>
        <p>${safeInviterName} has invited you to join their golf group.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:white;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
        <p>Or copy this link: ${inviteUrl}</p>
        <p>This invitation expires in 7 days.</p>
      `
    );

    return new Response(
      JSON.stringify({ success: true, inviteUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
