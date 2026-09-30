import nodemailer from 'nodemailer';
import { logger } from '@rso/shared';

const isResend = process.env.EMAIL_PROVIDER === 'resend';

// Create reusable transporter object using the configured SMTP transport
const transporter = nodemailer.createTransport(
  isResend
    ? {
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: process.env.RESEND_API_KEY,
        },
      }
    : {
        service: 'gmail',
        auth: {
          user: process.env.MAIL_USER, // e.g. rsocampus@gmail.com
          pass: process.env.MAIL_APP_PASSWORD, // App Password
        },
      }
);

export async function verifyMailerConnection(): Promise<void> {
  try {
    await transporter.verify();
    logger.info({ provider: isResend ? 'resend' : 'gmail' }, 'SMTP transport ready');
  } catch (error) {
    logger.error({ err: error, provider: isResend ? 'resend' : 'gmail' }, 'SMTP transport unavailable');
  }
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the central transporter.
 */
export async function sendEmailDirect({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const defaultFrom = isResend ? 'RSO Campus <noreply@rso.hnasiaexport.com>' : 'RSO Campus <rsocampus@gmail.com>';
  const from = process.env.MAIL_FROM || defaultFrom;
  
  if (isResend && !process.env.RESEND_API_KEY) {
    logger.warn({ to, subject }, 'RESEND_API_KEY not set. Email not sent.');
    return;
  } else if (!isResend && (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD)) {
    logger.warn({ to, subject }, 'MAIL_USER or MAIL_APP_PASSWORD not set. Email not sent.');
    return;
  }

  // Improve plain text fallback by adding newlines before converting
  const cleanText = text || html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>?/gm, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: cleanText,
    });
    
    logger.info({ 
      messageId: info.messageId, 
      accepted: info.accepted, 
      rejected: info.rejected 
    }, 'Email sent successfully via Nodemailer');
  } catch (error) {
    logger.error({ err: error, to, subject }, 'Failed to send email via Nodemailer');
  }
}
