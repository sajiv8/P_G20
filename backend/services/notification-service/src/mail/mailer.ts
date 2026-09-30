import nodemailer from 'nodemailer';
import { logger } from '@rso/shared';

// ---------------------------------------------------------------------------
// Gmail SMTP transporter
//
// Uses the Gmail App Password stored in MAIL_APP_PASSWORD. The App Password
// is NOT the regular Google account password — it is a 16-character token
// generated at https://myaccount.google.com/apppasswords after enabling
// 2-Step Verification.
//
// Port 465 with `secure: true` (implicit TLS) is used rather than port 587
// with STARTTLS, because port 465 is the more modern recommendation and
// avoids the TLS negotiation step that STARTTLS requires.
// ---------------------------------------------------------------------------
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // implicit TLS on port 465
  auth: {
    user: process.env.MAIL_USER, // e.g. rsocampus@gmail.com
    pass: process.env.MAIL_APP_PASSWORD, // Gmail App Password (NOT the account password)
  },
  // Connection pooling for better throughput on bursts of emails.
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
});

export async function verifyMailerConnection(): Promise<void> {
  if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
    logger.warn('MAIL_USER or MAIL_APP_PASSWORD not set — email sending is disabled');
    return;
  }
  try {
    await transporter.verify();
    logger.info('Gmail SMTP transport ready (smtp.gmail.com:465)');
  } catch (error) {
    // Log the error message only — never the credentials.
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ errMessage: msg }, 'Gmail SMTP transport verification failed');
  }
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the central Gmail SMTP transporter.
 *
 * The From address MUST match (or be an alias of) the authenticated SMTP
 * account. Gmail silently rewrites the From header to the authenticated
 * account if a mismatch is detected, so consistency here avoids confusion.
 */
export async function sendEmailDirect({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const mailUser = process.env.MAIL_USER || 'rsocampus@gmail.com';
  const from = process.env.MAIL_FROM || `RSO Campus <${mailUser}>`;

  if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
    logger.warn({ to, subject }, 'MAIL_USER or MAIL_APP_PASSWORD not set — email not sent');
    return;
  }

  // Build a clean plain-text version by stripping HTML tags and collapsing
  // whitespace. This is used only when the caller does not provide explicit
  // plain text. Having both text/plain and text/html improves deliverability
  // because spam filters penalise HTML-only messages.
  const plainText = text || html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  try {
    const info = await transporter.sendMail({
      from,
      replyTo: process.env.MAIL_REPLY_TO || mailUser,
      to,
      subject,
      html,
      text: plainText,
      headers: {
        // Signals to mailbox providers that this is a transactional email,
        // not marketing / bulk mail. This is an advisory header only —
        // providers are not obligated to honour it.
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        Precedence: 'transactional',
      },
    });

    logger.info({
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    }, 'Email sent successfully');
  } catch (error) {
    // Log enough to diagnose without leaking credentials.
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ errMessage: msg, to, subject }, 'Failed to send email');
  }
}
