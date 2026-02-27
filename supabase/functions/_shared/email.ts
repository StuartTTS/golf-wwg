// Microsoft Graph API email sender using client credentials flow

/**
 * Escape a string for safe inclusion in HTML content.
 * Prevents HTML injection when interpolating user-controlled values into email templates.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
