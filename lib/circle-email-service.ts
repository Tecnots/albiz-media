import nodemailer from 'nodemailer';
import { CircleUpgradeRequest } from '@/types/circle-upgrade';
import {
  circleUpgradeRequestTemplate,
  circleUpgradeApprovedTemplate,
  circleUpgradeRejectedTemplate,
  newPostEmailTemplate,
  newStoryEmailTemplate,
} from '@/lib/circle-email-templates';

const getTransporter = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465');
  const secure = process.env.SMTP_SECURE !== 'false';

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS must be set in environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  const from = process.env.SMTP_FROM_NAME
    ? `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`
    : process.env.SMTP_FROM || process.env.SMTP_USER;

  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject, html });
  console.log(`Email sent to ${to}: ${subject}`);
};

export const sendCircleUpgradeRequestEmail = async (request: CircleUpgradeRequest & { user: { email: string } }): Promise<void> => {
  try {
    const { subject, html } = circleUpgradeRequestTemplate(request);
    await sendEmail(request.user.email, subject, html);
  } catch (error) {
    console.error('Failed to send Circle upgrade request email:', error);
  }
};

export const sendCircleUpgradeApprovedEmail = async (request: CircleUpgradeRequest & { user: { email: string; name: string } }): Promise<void> => {
  try {
    const { subject, html } = circleUpgradeApprovedTemplate(request);
    await sendEmail(request.user.email, subject, html);
  } catch (error) {
    console.error('Failed to send Circle upgrade approval email:', error);
  }
};

export const sendCircleUpgradeRejectedEmail = async (
  request: CircleUpgradeRequest & { user: { email: string; name: string } },
  reason?: string
): Promise<void> => {
  try {
    const { subject, html } = circleUpgradeRejectedTemplate(request, reason);
    await sendEmail(request.user.email, subject, html);
  } catch (error) {
    console.error('Failed to send Circle upgrade rejection email:', error);
  }
};

export const sendNewPostEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  authorHandle: string;
  postPreview: string;
  postImage?: string;
  postId: number;
}): Promise<void> => {
  try {
    const { subject, html } = newPostEmailTemplate(params);
    await sendEmail(params.recipientEmail, subject, html);
  } catch (error) {
    console.error('Failed to send new post email:', error);
  }
};

export const sendNewStoryEmail = async (params: {
  recipientEmail: string;
  recipientName: string;
  authorName: string;
  authorHandle: string;
  storyImage?: string;
}): Promise<void> => {
  try {
    const { subject, html } = newStoryEmailTemplate(params);
    await sendEmail(params.recipientEmail, subject, html);
  } catch (error) {
    console.error('Failed to send new story email:', error);
  }
};
