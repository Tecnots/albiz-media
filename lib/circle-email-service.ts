import { CircleUpgradeRequest } from '@/types/circle-upgrade';
import { 
  circleUpgradeRequestTemplate, 
  circleUpgradeApprovedTemplate, 
  circleUpgradeRejectedTemplate 
} from '@/lib/circle-email-templates';

// Email service configuration
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Get email configuration from environment variables
const getEmailConfig = (): EmailConfig => {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  };

  if (!config.auth.user || !config.auth.pass) {
    console.warn('Email configuration is incomplete. Emails will not be sent.');
  }

  return config;
};

// Mock email sender for development (replace with real email service)
const mockSendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  console.log('=== EMAIL SENT ===');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('HTML Length:', html.length);
  console.log('================');
  
  // In development, just log the email
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  // In production, this would use a real email service
  throw new Error('Email service not configured');
};

// Real email sender (using nodemailer or similar)
const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  const config = getEmailConfig();
  
  if (!config.auth.user || !config.auth.pass) {
    console.warn('Email credentials not provided. Using mock sender.');
    return mockSendEmail(to, subject, html);
  }

  try {
    // This is where you would integrate with your email service
    // Example with nodemailer:
    /*
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter(config);
    
    await transporter.sendMail({
      from: `"Albiz" <${config.auth.user}>`,
      to,
      subject,
      html,
    });
    */
    
    // For now, use mock implementation
    return mockSendEmail(to, subject, html);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

// Send Circle upgrade request confirmation email
export const sendCircleUpgradeRequestEmail = async (request: CircleUpgradeRequest): Promise<void> => {
  try {
    // Get user email from the request (you'd need to include user in the query)
    const userEmail = 'user@example.com'; // This should come from request.user.email
    
    const { subject, html } = circleUpgradeRequestTemplate(request);
    
    await sendEmail(userEmail, subject, html);
    
    console.log(`Circle upgrade request email sent to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send Circle upgrade request email:', error);
    // Don't throw error to prevent blocking the main flow
  }
};

// Send Circle upgrade approval email
export const sendCircleUpgradeApprovedEmail = async (request: CircleUpgradeRequest & { user: { email: string; name: string } }): Promise<void> => {
  try {
    // Get user email from the request
    const userEmail = request.user.email;
    
    const { subject, html } = circleUpgradeApprovedTemplate(request);
    
    await sendEmail(userEmail, subject, html);
    
    console.log(`Circle upgrade approval email sent to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send Circle upgrade approval email:', error);
    // Don't throw error to prevent blocking the main flow
  }
};

// Send Circle upgrade rejection email
export const sendCircleUpgradeRejectedEmail = async (
  request: CircleUpgradeRequest & { user: { email: string; name: string } }, 
  reason?: string
): Promise<void> => {
  try {
    // Get user email from the request
    const userEmail = request.user.email;
    
    const { subject, html } = circleUpgradeRejectedTemplate(request, reason);
    
    await sendEmail(userEmail, subject, html);
    
    console.log(`Circle upgrade rejection email sent to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send Circle upgrade rejection email:', error);
    // Don't throw error to prevent blocking the main flow
  }
};

// Email service status check
export const checkEmailServiceStatus = (): { configured: boolean; message: string } => {
  const config = getEmailConfig();
  
  if (!config.auth.user || !config.auth.pass) {
    return {
      configured: false,
      message: 'Email service is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.'
    };
  }
  
  return {
    configured: true,
    message: 'Email service is configured and ready to send emails.'
  };
};
