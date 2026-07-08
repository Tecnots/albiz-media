import { CircleUpgradeRequest } from '@/types/circle-upgrade';

const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://albiz.com';

const ALBIZ_LOGO = `<svg width="48" height="41" viewBox="0 0 121 104" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M71.9121 20.311L59.8833 0L9.15527e-05 103.861H23.2838L71.9121 20.311Z" fill="#FF4444"/>
  <path d="M96.0998 62.0821L83.9408 41.9091L47.9848 103.861H71.9121L96.0998 62.0821Z" fill="#FF4444"/>
  <path d="M120.15 103.861L108.381 83.2972L96.0998 103.861H120.15Z" fill="#FF4444"/>
  <path d="M108.058 83.3157L96.1438 62.4531L84.0538 83.3157L96.1438 103.795L108.058 83.3157Z" fill="#AF1212"/>
  <path d="M47.661 62.4531L60.0422 83.3157L47.661 103.795L35.7549 82.5496L47.661 62.4531Z" fill="#AF1212"/>
</svg>`;

// Email template for Circle upgrade request submission
export const circleUpgradeRequestTemplate = (request: CircleUpgradeRequest) => {
  const subject = 'Circle Upgrade Request Received';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Circle Upgrade Request Received</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background-color: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          display: block;
          margin: 0 auto 16px auto;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          color: #0a0a0a;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 16px;
          color: #737373;
        }
        .section {
          margin: 30px 0;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #0a0a0a;
          margin-bottom: 12px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 8px;
          font-size: 14px;
        }
        .info-label {
          color: #737373;
          font-weight: 500;
        }
        .info-value {
          color: #0a0a0a;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background-color: #fef3c7;
          color: #92400e;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin: 20px 0;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          font-size: 12px;
          color: #737373;
        }
        .cta-button {
          display: inline-block;
          background-color: #F44444;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          margin: 20px 0;
        }
        .cta-button:hover {
          background-color: #d64d3c;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${ALBIZ_LOGO}</div>
          <h1 class="title">Circle Upgrade Request Received</h1>
          <p class="subtitle">Thank you for your interest in joining our exclusive community</p>
        </div>

        <div class="section">
          <h2 class="section-title">Application Details</h2>
          <div class="info-grid">
            <span class="info-label">Name:</span>
            <span class="info-value">${request.fullName}</span>
            
            <span class="info-label">Title:</span>
            <span class="info-value">${request.professionalTitle}</span>
            
            ${request.company ? `
            <span class="info-label">Company:</span>
            <span class="info-value">${request.company}</span>
            ` : ''}
            
            <span class="info-label">Location:</span>
            <span class="info-value">${request.location}</span>
            
            <span class="info-label">Account Type:</span>
            <span class="info-value">${(request.accountType as any) === 'INDIVIDUAL' ? 'Individual' : 'Company'}</span>
            
            <span class="info-label">Document Type:</span>
            <span class="info-value">${(request.documentType || '').replace(/_/g, ' ')}</span>
            
            <span class="info-label">Submitted:</span>
            <span class="info-value">${new Date(request.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div class="status-badge">
          <span>×</span>
          Status: Pending Review
        </div>

        <div class="section">
          <h2 class="section-title">What Happens Next?</h2>
          <p style="color: #737373; font-size: 14px; line-height: 1.6;">
            Our team will carefully review your application and verification documents. 
            This process typically takes 2-3 business days. You'll receive an email 
            notification once a decision has been made.
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${APP_URL}" class="cta-button" style="background-color:#F44444;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;display:inline-block;">Visit Albiz</a>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
          <p style="margin-top: 8px;">
            If you have any questions, please contact us at 
            <a href="mailto:${process.env.SMTP_FROM || 'support@albiz.com'}" style="color: #F44444;">support@albiz.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
};

// Email template for Circle upgrade approval
export const circleUpgradeApprovedTemplate = (request: CircleUpgradeRequest) => {
  const subject = 'Welcome to Circle! Your Application Has Been Approved';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Circle!</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background-color: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          display: block;
          margin: 0 auto 16px auto;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          color: #0a0a0a;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 16px;
          color: #737373;
        }
        .section {
          margin: 30px 0;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #0a0a0a;
          margin-bottom: 12px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background-color: #dcfce7;
          color: #166534;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin: 20px 0;
        }
        .benefits-list {
          list-style: none;
          padding: 0;
        }
        .benefits-list li {
          padding: 8px 0;
          color: #737373;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .benefits-list li::before {
          content: "×";
          color: #F44444;
          font-weight: bold;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          font-size: 12px;
          color: #737373;
        }
        .cta-button {
          display: inline-block;
          background-color: #F44444;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          margin: 20px 0;
        }
        .cta-button:hover {
          background-color: #d64d3c;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${ALBIZ_LOGO}</div>
          <h1 class="title">Welcome to Circle!</h1>
          <p class="subtitle">Your application has been approved</p>
        </div>

        <div class="status-badge">
          <span>✓</span>
          Status: Approved
        </div>

        <div class="section">
          <h2 class="section-title">Congratulations, ${request.fullName}!</h2>
          <p style="color: #737373; font-size: 14px; line-height: 1.6;">
            After careful review of your application and verification documents, 
            we're pleased to welcome you to Circle - our exclusive community of 
            professionals and industry leaders.
          </p>
        </div>

        <div class="section">
          <h2 class="section-title">What You Get as a Circle Member</h2>
          <ul class="benefits-list">
            <li>Exclusive access to Circle-only content and discussions</li>
            <li>Priority support and early access to new features</li>
            <li>Networking opportunities with industry leaders</li>
            <li>Enhanced profile visibility and credibility</li>
            <li>Special events and webinars</li>
          </ul>
        </div>

        <div style="text-align: center;">
          <a href="${APP_URL}" class="cta-button" style="background-color:#F44444;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;display:inline-block;">Start Exploring Circle</a>
        </div>

        <div class="section">
          <h2 class="section-title">Next Steps</h2>
          <p style="color: #737373; font-size: 14px; line-height: 1.6;">
            Your account has been automatically upgraded. Simply log in to your 
            Albiz account to start enjoying your Circle member benefits.
          </p>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
          <p style="margin-top: 8px;">
            If you have any questions, please contact us at 
            <a href="mailto:${process.env.SMTP_FROM || 'support@albiz.com'}" style="color: #F44444;">support@albiz.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
};

// Email template for Circle upgrade rejection
export const circleUpgradeRejectedTemplate = (request: CircleUpgradeRequest, reason?: string) => {
  const subject = 'Circle Upgrade Request Update';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Circle Upgrade Request Update</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background-color: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          display: block;
          margin: 0 auto 16px auto;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          color: #0a0a0a;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 16px;
          color: #737373;
        }
        .section {
          margin: 30px 0;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #0a0a0a;
          margin-bottom: 12px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background-color: #fef2f2;
          color: #991b1b;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin: 20px 0;
        }
        .reason-box {
          background-color: #f8f9fa;
          border-left: 4px solid #ef4444;
          padding: 16px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          font-size: 12px;
          color: #737373;
        }
        .cta-button {
          display: inline-block;
          background-color: #F44444;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          margin: 20px 0;
        }
        .cta-button:hover {
          background-color: #d64d3c;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${ALBIZ_LOGO}</div>
          <h1 class="title">Circle Upgrade Request Update</h1>
          <p class="subtitle">An update on your Circle membership application</p>
        </div>

        <div class="status-badge">
          <span>×</span>
          Status: Not Approved
        </div>

        <div class="section">
          <h2 class="section-title">Application Update</h2>
          <p style="color: #737373; font-size: 14px; line-height: 1.6;">
            Thank you for your interest in joining Circle. After careful review 
            of your application, we regret to inform you that we are unable to 
            approve your request at this time.
          </p>
          
          ${reason ? `
          <div class="reason-box">
            <h3 style="font-size: 14px; font-weight: 600; color: #0a0a0a; margin-bottom: 8px;">Reason:</h3>
            <p style="color: #737373; font-size: 14px; margin: 0;">${reason}</p>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <h2 class="section-title">What You Can Do</h2>
          <p style="color: #737373; font-size: 14px; line-height: 1.6;">
            You're welcome to reapply for Circle membership in the future. 
            Many of our successful Circle members strengthen their profiles 
            and gain more experience before reapplying.
          </p>
        </div>

        <div class="section">
          <h2 class="section-title">Continue with Albiz</h2>
          <p style="color: #737373; font-size: 14px; line-height: 1.6;">
            While you didn't qualify for Circle at this time, you can still 
            enjoy all the features of our standard Albiz platform. Connect 
            with professionals, share your expertise, and grow your network.
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${APP_URL}" class="cta-button" style="background-color:#F44444;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;display:inline-block;">Continue on Albiz</a>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
          <p style="margin-top: 8px;">
            If you have any questions about this decision, please contact us at 
            <a href="mailto:${process.env.SMTP_FROM || 'support@albiz.com'}" style="color: #F44444;">support@albiz.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
};

const sharedStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
  .container { background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; font-size: 12px; color: #737373; }
  .cta { display: inline-block; background-color: #F44444; color: white !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 24px 0; font-size: 14px; }
`;

export const newPostEmailTemplate = (params: {
  recipientName: string;
  authorName: string;
  authorHandle: string;
  postPreview: string;
  postImage?: string;
  postId: number;
}) => {
  const { recipientName, authorName, authorHandle, postPreview, postImage, postId } = params;
  const postUrl = `${APP_URL}/#post-${postId}`;
  const profileUrl = `${APP_URL}/${authorHandle}`;
  const subject = `${authorName} shared a new post`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${authorName}</a>
    just shared a new post on Albiz.
  </p>
  ${postPreview ? `<div style="margin:24px 0;padding:16px 20px;background:#f8f8f8;border-left:3px solid #F44444;border-radius:6px;"><p style="margin:0;font-size:14px;color:#262626;line-height:1.6;">${postPreview}</p></div>` : ''}
  ${postImage ? `<div style="margin:20px 0;border-radius:10px;overflow:hidden;"><img src="${postImage}" alt="Post" style="width:100%;max-height:280px;object-fit:cover;display:block;" /></div>` : ''}
  <div style="text-align:center;"><a href="${postUrl}" class="cta">View Post</a></div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;">
      You're receiving this because you follow ${authorName}.
      <a href="${APP_URL}/settings" style="color:#F44444;">Manage settings</a>
    </p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const newStoryEmailTemplate = (params: {
  recipientName: string;
  authorName: string;
  authorHandle: string;
  storyImage?: string;
}) => {
  const { recipientName, authorName, authorHandle, storyImage } = params;
  const profileUrl = `${APP_URL}/${authorHandle}`;
  const subject = `${authorName} added a new story`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${authorName}</a>
    added a new story on Albiz. Stories disappear after 24 hours — don't miss it.
  </p>
  ${storyImage ? `<div style="margin:24px 0;text-align:center;"><img src="${storyImage}" alt="Story" style="max-width:200px;border-radius:14px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,0.12);" /></div>` : ''}
  <div style="text-align:center;"><a href="${profileUrl}" class="cta">View Story</a></div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;">
      You're receiving this because you follow ${authorName}.
      <a href="${APP_URL}/settings" style="color:#F44444;">Manage settings</a>
    </p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const newFollowEmailTemplate = (params: {
  recipientName: string;
  followerName: string;
  followerHandle: string;
}) => {
  const { recipientName, followerName, followerHandle } = params;
  const APP_URL_LOCAL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const profileUrl = `${APP_URL_LOCAL}/${followerHandle}`;
  const subject = `${followerName} started following you`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${followerName}</a>
    started following you on Albiz.
  </p>
  <div style="text-align:center;"><a href="${profileUrl}" class="cta">View Profile</a></div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;"><a href="${APP_URL_LOCAL}/settings" style="color:#F44444;">Manage notification settings</a></p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const newLikeEmailTemplate = (params: {
  recipientName: string;
  likerName: string;
  likerHandle: string;
  postPreview: string;
  postImage?: string;
  postId: number;
}) => {
  const { recipientName, likerName, likerHandle, postPreview, postImage, postId } = params;
  const APP_URL_LOCAL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const postUrl = `${APP_URL_LOCAL}/#post-${postId}`;
  const profileUrl = `${APP_URL_LOCAL}/${likerHandle}`;
  const subject = `${likerName} liked your post`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${likerName}</a>
    liked your post on Albiz.
  </p>
  ${postPreview ? `<div style="margin:20px 0;padding:14px 18px;background:#f8f8f8;border-left:3px solid #F44444;border-radius:6px;"><p style="margin:0;font-size:14px;color:#262626;line-height:1.6;">${postPreview}</p></div>` : ''}
  ${postImage ? `<div style="margin:16px 0;border-radius:10px;overflow:hidden;"><img src="${postImage}" alt="Post" style="width:100%;max-height:240px;object-fit:cover;display:block;"/></div>` : ''}
  <div style="text-align:center;"><a href="${postUrl}" class="cta">View Post</a></div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;"><a href="${APP_URL_LOCAL}/settings" style="color:#F44444;">Manage notification settings</a></p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const newCommentEmailTemplate = (params: {
  recipientName: string;
  commenterName: string;
  commenterHandle: string;
  commentText: string;
  postPreview: string;
  postId: number;
}) => {
  const { recipientName, commenterName, commenterHandle, commentText, postPreview, postId } = params;
  const APP_URL_LOCAL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const postUrl = `${APP_URL_LOCAL}/#post-${postId}`;
  const profileUrl = `${APP_URL_LOCAL}/${commenterHandle}`;
  const subject = `${commenterName} commented on your post`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${commenterName}</a>
    commented on your post.
  </p>
  <div style="margin:20px 0;padding:14px 18px;background:#f8f8f8;border-left:3px solid #F44444;border-radius:6px;">
    <p style="margin:0 0 8px 0;font-size:12px;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.05em;">Comment</p>
    <p style="margin:0;font-size:14px;color:#262626;line-height:1.6;">${commentText}</p>
  </div>
  ${postPreview ? `<p style="font-size:13px;color:#737373;margin:0 0 20px 0;">On your post: <em>"${postPreview}"</em></p>` : ''}
  <div style="text-align:center;"><a href="${postUrl}" class="cta">View Post</a></div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;"><a href="${APP_URL_LOCAL}/settings" style="color:#F44444;">Manage notification settings</a></p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const newStoryLikeEmailTemplate = (params: {
  recipientName: string;
  likerName: string;
  likerHandle: string;
  storyImage?: string;
}) => {
  const { recipientName, likerName, likerHandle, storyImage } = params;
  const APP_URL_LOCAL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const profileUrl = `${APP_URL_LOCAL}/${likerHandle}`;
  const subject = `${likerName} liked your story`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${likerName}</a>
    liked your story on Albiz.
  </p>
  ${storyImage ? `<div style="margin:24px 0;text-align:center;"><img src="${storyImage}" alt="Story" style="max-width:180px;border-radius:14px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,0.12);"/></div>` : ''}
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;"><a href="${APP_URL_LOCAL}/settings" style="color:#F44444;">Manage notification settings</a></p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const mentionEmailTemplate = (params: {
  recipientName: string;
  authorName: string;
  authorHandle: string;
  contentSnippet: string;
  postUrlPath: string;
}) => {
  const { recipientName, authorName, authorHandle, contentSnippet, postUrlPath } = params;
  const APP_URL_LOCAL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const postUrl = `${APP_URL_LOCAL}${postUrlPath}`;
  const profileUrl = `${APP_URL_LOCAL}/${authorHandle}`;
  const subject = `${authorName} mentioned you on Albiz`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${authorName}</a>
    mentioned you in a post or comment.
  </p>
  <div style="margin:20px 0;padding:14px 18px;background:#f8f8f8;border-left:3px solid #F44444;border-radius:6px;">
    <p style="margin:0;font-size:14px;color:#262626;line-height:1.6;">"${contentSnippet}"</p>
  </div>
  <div style="text-align:center;"><a href="${postUrl}" class="cta">View Post</a></div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;"><a href="${APP_URL_LOCAL}/settings" style="color:#F44444;">Manage notification settings</a></p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const circleUpdateEmailTemplate = (params: {
  recipientName: string;
  authorName: string;
  authorHandle: string;
  authorTitle: string;
  contentSnippet: string;
  postImage?: string;
}) => {
  const { recipientName, authorName, authorHandle, authorTitle, contentSnippet, postImage } = params;
  const APP_URL_LOCAL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const profileUrl = `${APP_URL_LOCAL}/${authorHandle}`;
  const subject = `New Circle Update from ${authorName}`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${sharedStyles}</style></head>
<body><div class="container">
  <div style="text-align:center;margin-bottom:24px;">${ALBIZ_LOGO}</div>
  <p style="font-size:15px;color:#0a0a0a;margin-bottom:4px;">Hi ${recipientName},</p>
  <p style="font-size:15px;color:#525252;margin-top:0;">
    <a href="${profileUrl}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${authorName}</a>
    (${authorTitle}) shared a new update in the Circle.
  </p>
  <div style="margin:20px 0;padding:14px 18px;background:#f8f8f8;border-left:3px solid #F44444;border-radius:6px;">
    <p style="margin:0;font-size:14px;color:#262626;line-height:1.6;">${contentSnippet}</p>
  </div>
  ${postImage ? `<div style="margin:16px 0;border-radius:10px;overflow:hidden;"><img src="${postImage}" alt="Post" style="width:100%;max-height:240px;object-fit:cover;display:block;"/></div>` : ''}
  <div style="text-align:center;"><a href="${APP_URL_LOCAL}/circle" class="cta">View in Circle</a></div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Albiz. All rights reserved.</p>
    <p style="margin-top:8px;font-size:11px;color:#a3a3a3;"><a href="${APP_URL_LOCAL}/settings" style="color:#F44444;">Manage notification settings</a></p>
  </div>
</div></body></html>`;
  return { subject, html };
};

export const editorialNotificationTemplate = (params: {
  recipientName: string;
  type: "revision_requested" | "approved" | "published";
  articleTitle: string;
  appUrl: string;
}) => {
  const { recipientName, type, articleTitle, appUrl } = params;

  const configs = {
    revision_requested: {
      subject: `Revisions requested on "${articleTitle}"`,
      headline: "Revisions requested",
      body: "Your article needs some revisions before it can be approved. Review the editor's notes and resubmit when ready.",
      cta: "View notes",
      ctaUrl: `${appUrl}/authors/my-articles`,
      accent: "#F44444",
    },
    approved: {
      subject: `"${articleTitle}" has been approved`,
      headline: "Article approved",
      body: "Great work! Your article has been approved and is awaiting final publication.",
      cta: "View article",
      ctaUrl: `${appUrl}/authors/my-articles`,
      accent: "#22c55e",
    },
    published: {
      subject: `"${articleTitle}" is now live`,
      headline: "Article published",
      body: "Your article is now live and available to readers.",
      cta: "Read it",
      ctaUrl: appUrl,
      accent: "#0EA5E9",
    },
  };

  const config = configs[type];

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background-color:#f8f9fa}
  .container{background-color:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 10px rgba(0,0,0,.1)}
  .logo{text-align:center;margin-bottom:24px}
  .headline{font-size:22px;font-weight:700;color:#0a0a0a;margin:0 0 8px}
  .body-text{font-size:15px;color:#525252;margin:0 0 24px}
  .article-box{font-size:13px;font-weight:600;color:#0a0a0a;background:#f5f5f5;border-radius:8px;padding:12px 16px;margin-bottom:24px}
  .cta{display:inline-block;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px}
  .footer{margin-top:32px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:12px;color:#a3a3a3}
</style>
</head>
<body>
<div class="container">
  <div class="logo">${ALBIZ_LOGO}</div>
  <p class="headline">${config.headline}</p>
  <p class="body-text">Hi ${recipientName},<br><br>${config.body}</p>
  <div class="article-box">${articleTitle}</div>
  <a href="${config.ctaUrl}" class="cta" style="background-color:${config.accent}">${config.cta}</a>
  <div class="footer">You received this because you submitted an article on Albiz.</div>
</div>
</body>
</html>`;

  return { subject: config.subject, html };
};

export const editorAssignmentTemplate = (params: {
  recipientName: string;
  articleTitle: string;
  authorName: string;
  appUrl: string;
}): { subject: string; html: string } => {
  const { recipientName, articleTitle, authorName, appUrl } = params;
  const subject = `New article assigned: "${articleTitle}"`;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#fafafa;margin:0;padding:32px 16px}
  .container{max-width:540px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #f0f0f0}
  .logo{margin-bottom:28px}
  .headline{font-size:22px;font-weight:700;color:#0a0a0a;margin:0 0 8px}
  .body-text{font-size:15px;color:#525252;margin:0 0 24px}
  .article-box{font-size:13px;font-weight:600;color:#0a0a0a;background:#f5f5f5;border-radius:8px;padding:12px 16px;margin-bottom:24px}
  .cta{display:inline-block;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;background:#0EA5E9}
  .footer{margin-top:32px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:12px;color:#a3a3a3}
</style>
</head>
<body>
<div class="container">
  <div class="logo">${ALBIZ_LOGO}</div>
  <p class="headline">New article assigned to you</p>
  <p class="body-text">Hi ${recipientName},<br><br>${authorName} submitted an article for your review. It's ready for your editorial feedback.</p>
  <div class="article-box">${articleTitle}</div>
  <a href="${appUrl}/editor/queue" class="cta">Open queue</a>
  <div class="footer">You received this because an article was assigned to you on Albiz.</div>
</div>
</body>
</html>`;
  return { subject, html };
};

export const campaignEmailTemplate = (params: {
  recipientName: string;
  subject: string;
  bodyHtml: string;
}): { subject: string; html: string } => {
  const { recipientName, subject, bodyHtml } = params;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#fafafa;margin:0;padding:32px 16px}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #f0f0f0}
  .logo{margin-bottom:28px}
  .greeting{font-size:15px;color:#525252;margin:0 0 20px;line-height:1.6}
  .content{font-size:15px;color:#0a0a0a;line-height:1.7}
  .footer{margin-top:32px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:12px;color:#a3a3a3}
  .footer a{color:#a3a3a3}
</style>
</head>
<body>
<div class="container">
  <div class="logo">${ALBIZ_LOGO}</div>
  <p class="greeting">Hi ${recipientName},</p>
  <div class="content">${bodyHtml}</div>
  <div class="footer">You received this because you are a member of Albiz. <a href="${APP_URL}/settings">Manage preferences</a></div>
</div>
</body>
</html>`;
  return { subject, html };
};

export const scheduledAlertTemplate = (params: {
  recipientName: string;
  title: string;
  body: string;
  url?: string;
}): { subject: string; html: string } => {
  const { recipientName, title, body, url } = params;
  const ctaHref = url ? (url.startsWith("http") ? url : `${APP_URL}${url}`) : APP_URL;
  const subject = title;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#fafafa;margin:0;padding:32px 16px}
  .container{max-width:540px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #f0f0f0}
  .logo{margin-bottom:28px}
  .headline{font-size:22px;font-weight:700;color:#0a0a0a;margin:0 0 8px}
  .body-text{font-size:15px;color:#525252;margin:0 0 24px;line-height:1.6}
  .cta{display:inline-block;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;background:#F44444}
  .footer{margin-top:32px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:12px;color:#a3a3a3}
</style>
</head>
<body>
<div class="container">
  <div class="logo">${ALBIZ_LOGO}</div>
  <p class="headline">${title}</p>
  <p class="body-text">Hi ${recipientName},<br><br>${body}</p>
  <a href="${ctaHref}" class="cta">Open Albiz</a>
  <div class="footer">You received this scheduled notification from Albiz.</div>
</div>
</body>
</html>`;
  return { subject, html };
};
