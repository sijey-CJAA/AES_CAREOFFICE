export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailDeliveryResult {
  sent: true;
  provider: 'gmail_webhook' | 'resend';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildVerificationCodeEmail(params: {
  recipientName?: string | null;
  resourceLabel?: string | null;
  code: string;
  expiresMinutes: number;
}): { subject: string; html: string; text: string } {
  const greeting = params.recipientName?.trim()
    ? `Hello ${escapeHtml(params.recipientName.trim())},`
    : 'Hello,';
  const greetingText = params.recipientName?.trim()
    ? `Hello ${params.recipientName.trim()},`
    : 'Hello,';
  const recordName = params.resourceLabel?.trim() || 'Shared Guidance Record';
  const safeRecordName = escapeHtml(recordName);
  const safeCode = escapeHtml(params.code);

  const subject = `${params.code} is your AES CareOffice verification code`;
  const text = [
    greetingText,
    '',
    `Use this temporary 6-digit verification code to view the shared record (${recordName}) from Ambulong Elementary School Care Office:`,
    '',
    `Verification Code: ${params.code}`,
    '',
    `This code expires in ${params.expiresMinutes} minutes and can only be used once. No account or password is required.`,
    '',
    'If you did not request this code, you can safely ignore this email.',
  ].join('\n');

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
    <div style="background: #15803d; color: #ffffff; padding: 18px 24px; border-radius: 10px 10px 0 0;">
      <div style="font-size: 18px; font-weight: 700;">AES CareOffice</div>
      <div style="font-size: 12px; opacity: 0.9;">Ambulong Elementary School — Secure Record Sharing</div>
    </div>
    <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 10px 10px; background: #ffffff;">
      <p style="margin-top: 0;">${greeting}</p>
      <p>Use the temporary verification code below to open the view-only record shared with you (<strong>${safeRecordName}</strong>):</p>
      <div style="text-align: center; margin: 24px 0; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;">
        <div style="font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">6-Digit Verification Code</div>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 0.25em; color: #14532d; margin-top: 6px;">${safeCode}</div>
      </div>
      <p style="font-size: 13px; color: #475569;">
        This code expires in <strong>${params.expiresMinutes} minutes</strong> and works once. No account sign-up or password is required.
      </p>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
        If you did not request access to this record, please ignore this message.
      </p>
    </div>
  </div>`;

  return { subject, html, text };
}

export function buildInvitationLinkEmail(params: {
  recipientName?: string | null;
  resourceLabel?: string | null;
  resourceType: string;
  inviteUrl: string;
  expiresAtIso: string;
}): { subject: string; html: string; text: string } {
  const greeting = params.recipientName?.trim()
    ? `Hello ${escapeHtml(params.recipientName.trim())},`
    : 'Hello,';
  const greetingText = params.recipientName?.trim()
    ? `Hello ${params.recipientName.trim()},`
    : 'Hello,';
  const recordName = params.resourceLabel?.trim() || 'Guidance Record';
  const safeRecordName = escapeHtml(recordName);
  const safeUrl = escapeHtml(params.inviteUrl);
  const expiryDisplay = new Date(params.expiresAtIso).toUTCString();

  const subject = `AES CareOffice shared a view-only ${params.resourceType} record with you`;
  const text = [
    greetingText,
    '',
    `The Ambulong Elementary School Care Office has shared a confidential view-only ${params.resourceType} record with you: ${recordName}.`,
    '',
    `Open Private Link: ${params.inviteUrl}`,
    '',
    'How to open (no account or login required):',
    '1. Click the private link above.',
    '2. Enter this email address to receive a temporary 6-digit verification code in Gmail.',
    '3. Enter the 6-digit code to view the authorized record.',
    '',
    `Access expires: ${expiryDisplay}`,
    'This link is strictly private and only works for your invited email address.',
  ].join('\n');

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
    <div style="background: #15803d; color: #ffffff; padding: 18px 24px; border-radius: 10px 10px 0 0;">
      <div style="font-size: 18px; font-weight: 700;">AES CareOffice</div>
      <div style="font-size: 12px; opacity: 0.9;">Ambulong Elementary School — Secure Record Sharing</div>
    </div>
    <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 10px 10px; background: #ffffff;">
      <p style="margin-top: 0;">${greeting}</p>
      <p>The Ambulong Elementary School Care Office has shared a view-only <strong>${escapeHtml(params.resourceType)}</strong> record with you:</p>
      <div style="padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-weight: 700; margin-bottom: 20px;">
        ${safeRecordName}
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${safeUrl}" style="display: inline-block; background: #15803d; color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 8px;">
          Open Shared Record
        </a>
      </div>
      <p style="font-size: 13px; color: #475569;">
        <strong>No sign-up or password required.</strong> When you open the link, simply enter your email address and confirm the 6-digit code sent to your inbox.
      </p>
      <p style="font-size: 12px; color: #64748b; word-break: break-all;">
        If the button does not work, copy and paste this link into your browser:<br />
        <a href="${safeUrl}" style="color: #15803d;">${safeUrl}</a>
      </p>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
        Access expires: ${escapeHtml(expiryDisplay)}
      </p>
    </div>
  </div>`;

  return { subject, html, text };
}

export async function sendCareOfficeEmail(payload: EmailPayload): Promise<EmailDeliveryResult> {
  const gmailWebhookUrl = (Deno.env.get('GMAIL_WEBHOOK_URL') ?? '').trim();
  const gmailWebhookSecret = (Deno.env.get('GMAIL_WEBHOOK_SECRET') ?? '').trim();

  // Transport 1: Pure Gmail via Google Apps Script Web App (zero third-party sign-up, HTTPS 443)
  if (gmailWebhookUrl) {
    if (!gmailWebhookSecret) {
      throw new Error('Server email configuration incomplete: GMAIL_WEBHOOK_SECRET is missing.');
    }

    const res = await fetch(gmailWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        secret: gmailWebhookSecret,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    const rawText = await res.text();
    let parsed: { ok?: boolean; error?: string } | null = null;
    try {
      parsed = JSON.parse(rawText) as { ok?: boolean; error?: string };
    } catch {
      parsed = null;
    }

    if (!res.ok || (parsed && parsed.ok === false)) {
      throw new Error(
        parsed?.error || `Gmail bridge failed with status ${res.status}. Verify your Google Apps Script deployment.`
      );
    }

    if (!parsed || parsed.ok !== true) {
      throw new Error(
        'Gmail bridge did not return a valid JSON confirmation. Ensure your Google Apps Script Web App is deployed with access set to "Anyone".'
      );
    }

    return { sent: true, provider: 'gmail_webhook' };
  }

  // Transport 2 (Optional): Resend HTTP API
  const resendApiKey = (Deno.env.get('RESEND_API_KEY') ?? '').trim();
  if (resendApiKey) {
    const emailFrom = (Deno.env.get('EMAIL_FROM') ?? 'AES CareOffice <onboarding@resend.dev>').trim();
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Email delivery failed (${res.status}): ${detail}`);
    }

    return { sent: true, provider: 'resend' };
  }

  throw new Error(
    'Email delivery is not configured yet on the Edge Function. Set GMAIL_WEBHOOK_URL and GMAIL_WEBHOOK_SECRET in Supabase secrets (see docs/SHARED_ACCESS_GUIDE.md).'
  );
}

