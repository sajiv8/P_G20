import nodemailer from 'nodemailer';
import { logger } from '@rso/shared';

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER, // e.g. rsocampus@gmail.com
    pass: process.env.MAIL_APP_PASSWORD, // App Password
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using the central Gmail transporter.
 */
export async function sendEmailDirect({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const from = process.env.MAIL_FROM || 'RSO Campus <rsocampus@gmail.com>';
  
  if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
    logger.warn({ to, subject }, 'MAIL_USER or MAIL_APP_PASSWORD not set. Email not sent.');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''), // Basic HTML to text fallback
    });
    
    logger.info({ messageId: info.messageId, to, subject }, 'Email sent successfully');
  } catch (error) {
    logger.error({ err: error, to, subject }, 'Failed to send email via Nodemailer');
  }
}
