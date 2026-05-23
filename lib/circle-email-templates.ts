import { CircleUpgradeRequest } from '@/types/circle-upgrade';

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
          width: 48px;
          height: 48px;
          background-color: #F44444;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
          margin-bottom: 16px;
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
          <div class="logo">A</div>
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
            <span class="info-value">${request.documentType ? request.documentType.replace(/_/g, ' ') : 'N/A'}</span>
            
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
          <a href="https://albiz.com" class="cta-button">Visit Albiz</a>
        </div>

        <div class="footer">
          <p>© 2024 Albiz. All rights reserved.</p>
          <p style="margin-top: 8px;">
            If you have any questions, please contact us at 
            <a href="mailto:support@albiz.com" style="color: #F44444;">support@albiz.com</a>
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
          width: 48px;
          height: 48px;
          background-color: #22c55e;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
          margin-bottom: 16px;
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
          color: #22c55e;
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
          background-color: #22c55e;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          margin: 20px 0;
        }
        .cta-button:hover {
          background-color: #16a34a;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">A</div>
          <h1 class="title">Welcome to Circle!</h1>
          <p class="subtitle">Your application has been approved</p>
        </div>

        <div class="status-badge">
          <span>×</span>
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
          <a href="https://albiz.com" class="cta-button">Start Exploring Circle</a>
        </div>

        <div class="section">
          <h2 class="section-title">Next Steps</h2>
          <p style="color: #737373; font-size: 14px; line-height: 1.6;">
            Your account has been automatically upgraded. Simply log in to your 
            Albiz account to start enjoying your Circle member benefits.
          </p>
        </div>

        <div class="footer">
          <p>© 2024 Albiz. All rights reserved.</p>
          <p style="margin-top: 8px;">
            If you have any questions, please contact us at 
            <a href="mailto:support@albiz.com" style="color: #22c55e;">support@albiz.com</a>
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
          width: 48px;
          height: 48px;
          background-color: #ef4444;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
          margin-bottom: 16px;
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
          <div class="logo">A</div>
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
          <a href="https://albiz.com" class="cta-button">Continue on Albiz</a>
        </div>

        <div class="footer">
          <p>© 2024 Albiz. All rights reserved.</p>
          <p style="margin-top: 8px;">
            If you have any questions about this decision, please contact us at 
            <a href="mailto:support@albiz.com" style="color: #F44444;">support@albiz.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
};
