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
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure AD environment variables (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)');
  }

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
  const mailFrom = process.env.AZURE_MAIL_FROM;

  if (!mailFrom) {
    throw new Error('Missing AZURE_MAIL_FROM environment variable');
  }

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
