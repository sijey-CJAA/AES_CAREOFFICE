/**
 * AES CareOffice — Pure Gmail Delivery Bridge (Google Apps Script)
 *
 * Allows the Supabase Edge Function to send 6-digit Gmail verification codes
 * and private sharing links directly from your own Gmail account over HTTPS,
 * with ZERO third-party email service sign-ups.
 *
 * Setup (2 minutes):
 *   1. Open https://script.google.com while signed into your AES Guidance Gmail.
 *   2. Click "New project", delete the placeholder code, and paste this file.
 *   3. Go to Project Settings (gear icon) -> Script Properties -> Add property:
 *        Property: WEBHOOK_SECRET
 *        Value:    <pick any long random secret string>
 *   4. Click Deploy -> New deployment -> Type: Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *      Authorize Gmail permission when Google prompts you.
 *   5. Copy the Web App URL (ends with /exec) and set both Supabase secrets:
 *        npx supabase secrets set GMAIL_WEBHOOK_URL="https://script.google.com/macros/s/.../exec" GMAIL_WEBHOOK_SECRET="<same secret>" --project-ref qrsjdtayhufppajokegu
 */

function doPost(e) {
  try {
    var expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!expectedSecret) {
      return jsonOut({ ok: false, error: 'WEBHOOK_SECRET Script Property is not configured.' });
    }

    var body = JSON.parse(e.postData.contents || '{}');
    if (!body.secret || body.secret !== expectedSecret) {
      return jsonOut({ ok: false, error: 'Unauthorized request.' });
    }

    var to = String(body.to || '').trim();
    var subject = String(body.subject || '').trim();
    var text = String(body.text || '');
    var html = String(body.html || '');

    if (!to || to.indexOf('@') === -1 || !subject) {
      return jsonOut({ ok: false, error: 'Missing required email fields.' });
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: text,
      htmlBody: html || undefined,
      name: 'AES CareOffice'
    });

    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

