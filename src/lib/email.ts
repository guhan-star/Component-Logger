/**
 * Stark Industries WMC — Transactional Email Service
 * 
 * Powered by Resend REST API (https://resend.com)
 * Supports Email Verification, Password Recovery, and Security Alerts.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export function getAppBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * Sends a transactional email using Resend REST API.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || 'Stark Industries WMC <onboarding@resend.dev>';
  const isProduction = process.env.NODE_ENV === 'production';

  if (!apiKey) {
    if (isProduction) {
      console.error('[Email CRITICAL] RESEND_API_KEY is not configured in production environment variables.');
      return {
        success: false,
        error: 'Transactional email service is not configured. Please contact system administrator.',
      };
    }

    // In development and testing: log cleanly without claiming false external delivery
    console.log('----------------------------------------------------');
    console.log(`[SIMULATED EMAIL] To: ${to}`);
    console.log(`[SIMULATED EMAIL] Subject: ${subject}`);
    console.log(`[SIMULATED EMAIL] Preview: ${text || html.slice(0, 160)}...`);
    console.log('----------------------------------------------------');

    return {
      success: true,
      simulated: true,
      messageId: `simulated-${Date.now()}`,
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      }),
      signal: AbortSignal.timeout(8000), // 8-second timeout
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Email Error] Resend API returned error:', data);
      return {
        success: false,
        error: data?.message || `Failed to send email (${response.status})`,
      };
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error: any) {
    console.error('[Email Error] Exception while sending email:', error?.message || error);
    return {
      success: false,
      error: error?.message || 'Network error communicating with email provider.',
    };
  }
}

/**
 * Formats a Stark Industries themed Email Verification message
 */
export function buildVerificationEmail(userName: string, rawToken: string, recipientEmail: string): { subject: string; html: string; text: string } {
  const baseUrl = getAppBaseUrl();
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(recipientEmail)}`;

  const subject = 'Verify your Stark Industries WMC Account';
  const text = `Hello ${userName},\n\nPlease verify your email address by visiting this link:\n${verificationUrl}\n\nThis verification link expires in 24 hours.\n\nStark Industries Warehouse Management & Control`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="background-color: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px;">
    <div style="border-bottom: 1px solid #30363d; padding-bottom: 20px; margin-bottom: 24px;">
      <span style="color: #f59e0b; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Stark Industries WMC</span>
      <h1 style="color: #ffffff; font-size: 20px; margin: 8px 0 0 0; font-weight: 600;">Email Verification Required</h1>
    </div>
    
    <p style="color: #c9d1d9; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      Greetings ${userName},
      <br><br>
      Thank you for registering on <strong>Stark Industries Warehouse Management & Control</strong>. Please verify your email address to complete your credentials setup and enable full platform collaboration.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationUrl}" style="background-color: #f59e0b; color: #000000; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">
        Verify Email Address &rarr;
      </a>
    </div>

    <p style="color: #8b949e; font-size: 12px; line-height: 1.5; margin-top: 32px; border-top: 1px solid #21262d; padding-top: 20px;">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${verificationUrl}" style="color: #58a6ff; word-break: break-all;">${verificationUrl}</a>
      <br><br>
      This link is single-use and will expire in 24 hours. If you did not create this account, please ignore this email.
    </p>
  </div>
</body>
</html>
`;

  return { subject, html, text };
}

/**
 * Formats a Stark Industries themed Password Reset message
 */
export function buildPasswordResetEmail(userName: string, rawToken: string, recipientEmail: string): { subject: string; html: string; text: string } {
  const baseUrl = getAppBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(recipientEmail)}`;

  const subject = 'Reset your Stark Industries WMC Password';
  const text = `Hello ${userName},\n\nWe received a request to reset your password. Use the following link to choose a new password:\n${resetUrl}\n\nThis reset link expires in 1 hour and can only be used once.\n\nStark Industries Warehouse Management & Control`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="background-color: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px;">
    <div style="border-bottom: 1px solid #30363d; padding-bottom: 20px; margin-bottom: 24px;">
      <span style="color: #f59e0b; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Stark Industries Security</span>
      <h1 style="color: #ffffff; font-size: 20px; margin: 8px 0 0 0; font-weight: 600;">Password Reset Request</h1>
    </div>
    
    <p style="color: #c9d1d9; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      Greetings ${userName},
      <br><br>
      A password reset request was initiated for your Stark Industries WMC account. Click the button below to specify your new password:
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">
        Reset Security Password &rarr;
      </a>
    </div>

    <p style="color: #8b949e; font-size: 12px; line-height: 1.5; margin-top: 32px; border-top: 1px solid #21262d; padding-top: 20px;">
      If you did not request this password reset, no action is needed; your current password remains secure.<br><br>
      Direct link:<br>
      <a href="${resetUrl}" style="color: #58a6ff; word-break: break-all;">${resetUrl}</a>
      <br><br>
      This link is single-use, expires in 1 hour, and resetting your password will automatically revoke all existing sessions across all devices for your protection.
    </p>
  </div>
</body>
</html>
`;

  return { subject, html, text };
}
