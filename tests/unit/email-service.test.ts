import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  sendEmail,
  buildVerificationEmail,
  buildPasswordResetEmail,
  getAppBaseUrl,
} from '@/lib/email';

describe('Unit Tests: Transactional Email Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.APP_URL;
  });

  it('determines the correct application base URL', () => {
    process.env.APP_URL = 'https://custom-domain.stark.com/';
    expect(getAppBaseUrl()).toBe('https://custom-domain.stark.com');
  });

  it('builds a secure, styled verification email with valid single-use link', () => {
    const rawToken = '64-character-mock-token-abc123xyz789';
    const email = 'pepper@stark.com';
    const { subject, html, text } = buildVerificationEmail('Pepper Potts', rawToken, email);

    expect(subject).toContain('Verify your Stark Industries WMC Account');
    expect(html).toContain('Pepper Potts');
    expect(html).toContain('Verify Email Address');
    expect(html).toContain(encodeURIComponent(rawToken));
    expect(text).toContain('expires in 24 hours');
  });

  it('builds a secure password reset email with valid single-use link', () => {
    const rawToken = 'reset-token-sample-456';
    const email = 'rhodey@stark.com';
    const { subject, html, text } = buildPasswordResetEmail('James Rhodes', rawToken, email);

    expect(subject).toContain('Reset your Stark Industries WMC Password');
    expect(html).toContain('James Rhodes');
    expect(html).toContain('Reset Security Password');
    expect(html).toContain(encodeURIComponent(rawToken));
    expect(text).toContain('expires in 1 hour');
  });

  it('reports honest provider error when RESEND_API_KEY is missing in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const result = await sendEmail({
        to: 'target@test.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transactional email service is not configured');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('simulates delivery in development and test environments cleanly', async () => {
    const result = await sendEmail({
      to: 'dev@test.com',
      subject: 'Dev Test Email',
      html: '<p>Simulated Content</p>',
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.messageId).toContain('simulated-');
  });
});
